# GlobalMap v1.00.02

A geospatial intelligence dashboard — interactive Three.js globe with real-world datasets.

**[Live Demo → world.je9.us](https://world.je9.us)**

## Features

- **3D Globe** — WebGL-powered via Three.js, smooth rotation, scroll zoom
- **Full Datasets** — 194 airports, 250 corporations, 100 banks, 241 military installations, 26 elite units, 83 data centers, 60 defense contractors, 100 universities, 65 telecom carriers, 195 countries
- **CSV Import** — drop your own coordinates CSV onto the globe
- **Ask Claude** — built-in AI intelligence analyst (works locally with your own API key)
- **Visit Map** — animated visitor geolocation layer
- **Screen Saver** — globe-as-screen-saver mode

## Run Locally

```bash
git clone https://github.com/LIBCSYS/je9GlobalMap.git
cd je9GlobalMap
node server.js
```

Open: [http://localhost:2600](http://localhost:2600)

*(Port 2600 — homage to 2600.com)*

## Run with Claude AI enabled

```bash
ANTHROPIC_API_KEY=sk-ant-... node server.js
```

Or enter your API key directly in the **Ask Claude** panel after opening the app.

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
