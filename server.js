// GlobalMap v1.00.02 — local dev server
// Homage to 2600.com
// Usage: node server.js
// Usage with Claude AI: ANTHROPIC_API_KEY=sk-ant-... node server.js
// Then open: http://localhost:2600

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT = 2600;
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

// ── Full dataset (all tables exported from live nsa.db) ───────────────────
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));

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

// ── Request handler ────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const [urlPath, qs] = req.url.split('?');
  const params = new URLSearchParams(qs || '');

  // API routes
  if (urlPath.startsWith('/api/')) {
    const key = urlPath.slice(5);

    // Special: installations?branch=Embassy
    if (key === 'installations' && params.get('branch') === 'Embassy') {
      const embassies = (ROUTE_MAP.installations || []).filter(r =>
        (r.branch || '').toLowerCase().includes('embassy')
      );
      res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
      res.end(JSON.stringify(embassies));
      return;
    }

    let data = ROUTE_MAP[key];
    if (data === undefined) {
      res.writeHead(404, {'Content-Type':'application/json'});
      res.end(JSON.stringify([]));
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

    res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
    res.end(JSON.stringify(data));
    return;
  }

  // ── Claude AI proxy ────────────────────────────────────────────────────────
  if (urlPath === '/api/claude' && req.method === 'POST') {
    const apiKey = process.env.ANTHROPIC_API_KEY || req.headers['x-api-key'] || '';
    if (!apiKey) {
      res.writeHead(503, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
      res.end(JSON.stringify({error:'Claude not configured. Either:\n  1. Set env var: ANTHROPIC_API_KEY=sk-ant-... node server.js\n  2. Enter your API key in the Ask Claude panel UI'}));
      return;
    }
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(body); } catch(e) { res.writeHead(400); res.end('bad json'); return; }

      const msgs = [];
      if (parsed.history) parsed.history.forEach(m => msgs.push({role:m.role,content:m.content||m.text||''}));
      msgs.push({role:'user',content:parsed.message||''});

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
            res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
            res.end(JSON.stringify({reply, model: j.model, usage: j.usage}));
          } catch(e) { res.writeHead(500); res.end(data); }
        });
      });
      preq.on('error', e => { res.writeHead(502); res.end(e.message); });
      preq.write(payload);
      preq.end();
    });
    return;
  }

  // Static files
  let filePath = urlPath === '/' ? '/ops.html' : urlPath;
  filePath = path.join(STATIC_DIR, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, {'Content-Type':'text/plain'});
      res.end('404 Not Found');
      return;
    }
    const ext  = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {'Content-Type': mime});
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  ██████╗ ██╗      ██████╗ ██████╗  █████╗ ██╗     ███╗   ███╗ █████╗ ██████╗ `);
  console.log(`  ██╔════╝ ██║     ██╔═══██╗██╔══██╗██╔══██╗██║     ████╗ ████║██╔══██╗██╔══██╗`);
  console.log(`  ██║  ███╗██║     ██║   ██║██████╔╝███████║██║     ██╔████╔██║███████║██████╔╝`);
  console.log(`  ██║   ██║██║     ██║   ██║██╔══██╗██╔══██║██║     ██║╚██╔╝██║██╔══██║██╔═══╝ `);
  console.log(`  ╚██████╔╝███████╗╚██████╔╝██████╔╝██║  ██║███████╗██║ ╚═╝ ██║██║  ██║██║     `);
  console.log(`   ╚═════╝ ╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝     `);
  console.log(`\n  v1.00.02 — ${PORT} — homage to 2600.com`);
  console.log(`\n  194 airports · 250 corps · 100 banks · 241 bases · 26 elite units`);
  console.log(`  83 data centers · 60 defense contractors · 100 universities · 65 telecoms`);
  console.log(`\n  Open: \x1b[36mhttp://localhost:${PORT}\x1b[0m\n`);
});
