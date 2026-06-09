// GlobalMap v1.0Delta — local dev server
// Homage to 2600.com
// Usage: node server.js            (or PORT=8080 node server.js)
// Usage with Claude AI: ANTHROPIC_API_KEY=sk-ant-... node server.js
// Then open: http://localhost:2600

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT = parseInt(process.env.PORT, 10) || 2600;
const STATIC_DIR = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

// ── Full dataset (flat-file, no database required) ────────────────────────
let DATA;
try {
  DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
} catch (e) {
  console.error('FATAL: could not read data.json —', e.message);
  process.exit(1);
}

// Map API route keys → data keys
const ROUTE_MAP = {
  'installations':        DATA.installations        || [],
  'units':                DATA.units                || [],
  'missions':             DATA.missions             || [],
  'airports':             DATA.airports             || [],
  'corporations':         DATA.corporations         || [],
  'banks':                DATA.banks                || [],
  'datacenters':          DATA.data_centers         || [],
  'defense':              DATA.defense_contractors  || [],
  'refineries':           DATA.refineries           || [],
  'universities':         DATA.universities         || [],
  'telecom':              DATA.telecom_providers    || [],
  'network-cities':       DATA.network_cities       || [],
  'visits/summary':       DATA.visits_summary       || {},
};

// ── Simple search filter ──────────────────────────────────────────────────
function filterRows(rows, q) {
  if (!q) return rows;
  const lq = q.toLowerCase();
  return rows.filter(r =>
    Object.values(r).some(v => v && String(v).toLowerCase().includes(lq))
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function sendJSON(res, status, obj) {
  res.writeHead(status, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
  res.end(JSON.stringify(obj));
}

// Collections that accept in-memory POSTs (session-lifetime only — not persisted)
const WRITABLE = new Set(['installations', 'units', 'missions']);

// ── Request handler ────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const [rawPath, qs] = req.url.split('?');
  let urlPath;
  try { urlPath = decodeURIComponent(rawPath); }
  catch (e) { res.writeHead(400, {'Content-Type':'text/plain'}); res.end('400 Bad Request'); return; }
  const params = new URLSearchParams(qs || '');

  // API routes
  if (urlPath.startsWith('/api/') && urlPath !== '/api/claude') {
    const key = urlPath.slice(5);

    // In-memory create (powers the dashboard "+ Add" forms)
    if (req.method === 'POST' && WRITABLE.has(key)) {
      let body = '';
      req.on('data', d => { body += d; if (body.length > 1e6) req.destroy(); });
      req.on('end', () => {
        let row;
        try { row = JSON.parse(body); } catch (e) { sendJSON(res, 400, {error:'bad json'}); return; }
        if (!row || typeof row !== 'object' || Array.isArray(row)) { sendJSON(res, 400, {error:'expected object'}); return; }
        const rows = ROUTE_MAP[key];
        row.id = rows.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
        rows.push(row);
        sendJSON(res, 201, {ok:true, id:row.id});
      });
      return;
    }

    // Dataset summary for the dashboard
    if (key === 'meta') {
      const installs = ROUTE_MAP.installations || [];
      sendJSON(res, 200, {
        installations: installs.length,
        units: (ROUTE_MAP.units || []).length,
        missions: (ROUTE_MAP.missions || []).length,
        countries: [...new Set(installs.map(r => r.country).filter(Boolean))].sort(),
        unique_visitors: (ROUTE_MAP['visits/summary'] || {}).unique_ips || 0,
      });
      return;
    }

    // Special: installations?branch=Embassy
    if (key === 'installations' && params.get('branch') === 'Embassy') {
      const embassies = (ROUTE_MAP.installations || []).filter(r =>
        (r.branch || '').toLowerCase().includes('embassy')
      );
      sendJSON(res, 200, embassies);
      return;
    }

    let data = ROUTE_MAP[key];
    if (data === undefined) {
      sendJSON(res, 404, []);
      return;
    }

    // Search filter (works for any array endpoint)
    if (Array.isArray(data)) {
      const q = params.get('q') || '';
      const country = params.get('country') || '';
      const branch  = params.get('branch')  || '';
      const type    = params.get('type')    || '';
      let rows = data;
      if (q)       rows = filterRows(rows, q);
      if (country) rows = rows.filter(r => (r.country||'').toLowerCase() === country.toLowerCase());
      if (branch)  rows = rows.filter(r => (r.branch||'').toLowerCase().includes(branch.toLowerCase()));
      if (type)    rows = rows.filter(r => (r.type||'').toLowerCase().includes(type.toLowerCase()));
      data = rows;
    }

    sendJSON(res, 200, data);
    return;
  }

  // ── Claude AI proxy ────────────────────────────────────────────────────────
  if (urlPath === '/api/claude' && req.method === 'POST') {
    const apiKey = process.env.ANTHROPIC_API_KEY || req.headers['x-api-key'] || '';
    if (!apiKey) {
      sendJSON(res, 503, {error:'Claude not configured. Either:\n  1. Set env var: ANTHROPIC_API_KEY=sk-ant-... node server.js\n  2. Enter your API key in the Ask Claude panel UI'});
      return;
    }
    let body = '';
    req.on('data', d => { body += d; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(body); } catch(e) { sendJSON(res, 400, {error:'bad json'}); return; }
      if (!parsed || typeof parsed !== 'object') { sendJSON(res, 400, {error:'expected object'}); return; }

      const msgs = [];
      if (Array.isArray(parsed.history)) parsed.history.forEach(m => msgs.push({role:m.role==='user'?'user':'assistant',content:String(m.content||m.text||'')}));
      msgs.push({role:'user',content:String(parsed.message||'')});

      const payload = JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: parsed.system || 'You are an intelligence analyst for a geospatial operations dashboard.',
        messages: msgs
      });

      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const preq = https.request(options, pres => {
        let data = '';
        pres.on('data', d => data += d);
        pres.on('end', () => {
          try {
            const j = JSON.parse(data);
            const reply = j.content?.[0]?.text || j.error?.message || 'No response';
            sendJSON(res, 200, {reply, model: j.model, usage: j.usage});
          } catch(e) { sendJSON(res, 502, {error:'upstream returned invalid JSON'}); }
        });
      });
      preq.on('error', e => sendJSON(res, 502, {error:e.message}));
      preq.write(payload);
      preq.end();
    });
    return;
  }

  // Static files (resolved + contained within STATIC_DIR — no path traversal)
  const reqFile = urlPath === '/' ? 'ops.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.resolve(STATIC_DIR, reqFile);
  if (filePath !== STATIC_DIR && !filePath.startsWith(STATIC_DIR + path.sep)) {
    res.writeHead(403, {'Content-Type':'text/plain'});
    res.end('403 Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, {'Content-Type':'text/plain'});
      res.end('404 Not Found');
      return;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {'Content-Type': mime});
    res.end(data);
  });
});

server.on('error', e => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is already in use. Try: PORT=8080 node server.js` : e.message);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`\n  ██████╗ ██╗      ██████╗ ██████╗  █████╗ ██╗     ███╗   ███╗ █████╗ ██████╗ `);
  console.log(`  ██╔════╝ ██║     ██╔═══██╗██╔══██╗██╔══██╗██║     ████╗ ████║██╔══██╗██╔══██╗`);
  console.log(`  ██║  ███╗██║     ██║   ██║██████╔╝███████║██║     ██╔████╔██║███████║██████╔╝`);
  console.log(`  ██║   ██║██║     ██║   ██║██╔══██╗██╔══██║██║     ██║╚██╔╝██║██╔══██║██╔═══╝ `);
  console.log(`  ╚██████╔╝███████╗╚██████╔╝██████╔╝██║  ██║███████╗██║ ╚═╝ ██║██║  ██║██║     `);
  console.log(`   ╚═════╝ ╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝     `);
  console.log(`\n  v1.0Delta — ${PORT} — homage to 2600.com`);
  console.log(`\n  194 airports · 250 corps · 100 banks · 241 bases · 26 elite units`);
  console.log(`  83 data centers · 60 defense contractors · 100 universities · 65 telecoms`);
  console.log(`\n  Open: \x1b[36mhttp://localhost:${PORT}\x1b[0m\n`);
});
