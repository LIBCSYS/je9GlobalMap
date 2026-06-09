# GlobalMap v1.0Delta

A geospatial intelligence dashboard — interactive Three.js globe with real-world datasets, served by a zero-dependency Node.js server.

**[Live Demo → world.je9.us](https://world.je9.us)**

## Features

- **3D Globe** — WebGL-powered via Three.js, auto-rotation, scroll zoom, click-a-row-to-focus pin highlighting, label density slider
- **Full Datasets** — 194 airports, 250 corporations, 100 banks, 241 military installations, 26 elite units, 83 data centers, 60 defense contractors, 61 refineries, 100 universities, 65 telecom carriers, 195 countries
- **CSV Import** — drop your own coordinates CSV onto the globe
- **Ask Claude** — built-in AI intelligence analyst (works locally with your own Anthropic API key)
- **Visit Map** — animated visitor geolocation layer (ships with demo data)
- **Screen Saver** — globe-as-screen-saver mode (`screensaver.html`)

## Run Locally

```bash
git clone https://github.com/LIBCSYS/je9GlobalMap.git
cd je9GlobalMap
node server.js
```

Open: [http://localhost:2600](http://localhost:2600)

*(Port 2600 — homage to 2600.com. Override with `PORT=8080 node server.js`.)*

## Run with Claude AI enabled

```bash
ANTHROPIC_API_KEY=sk-ant-... node server.js
```

Or enter your API key directly in the **Ask Claude** panel after opening the app — the key is kept in your browser's localStorage and only sent to the local server, which forwards it to the Anthropic API.

## Pages

| Page | Purpose |
|------|---------|
| `/` (`ops.html`) | Main dashboard — globe, datasets, search/filter tables |
| `index.html` | Animated landing page with Zulu clock |
| `world.html` | Standalone globe with ally/adversary/neutral city markers |
| `visits.html` / `map.html` | Visitor-location globe |
| `screensaver.html` | Fullscreen globe, cursor hidden |

## API

All endpoints return JSON and serve from the flat-file dataset (`data.json`):

```
GET /api/installations?q=&country=&branch=    GET /api/banks?q=
GET /api/units?q=&country=                    GET /api/datacenters?q=
GET /api/airports?q=                          GET /api/defense?q=
GET /api/corporations?q=                      GET /api/refineries?q=
GET /api/universities?q=&country=&type=       GET /api/telecom?q=&type=
GET /api/network-cities                       GET /api/visits/summary
GET /api/meta                                 POST /api/claude
```

`POST /api/installations|units|missions` adds rows **in-memory only** (lost on restart) — this powers the dashboard's "+ Add" forms.

## CSV Import Format

| Column | Required | Notes |
|--------|----------|-------|
| `lat` | yes | Latitude (-90 to 90) |
| `lng` or `lon` | yes | Longitude (-180 to 180) |
| `name` | no | Pin label line 1 |
| `desc` or `description` | no | Pin label line 2 |

## Stack

- Zero npm dependencies — Node.js built-ins only (`http`, `https`, `fs`, `path`)
- Three.js r128 (CDN)
- Flat-file dataset (`data.json`) — no database required

## License

MIT
