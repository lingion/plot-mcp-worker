# plot-mcp-worker

`plot-mcp-worker` is a Cloudflare Worker that exposes an MCP server for plotting and diagram-generation tools backed by an upstream Plot API.

## Features

- MCP interface for math plotting tools
- Single-function, multi-function, and custom-series plotting
- JSON and direct PNG-link variants
- Force diagram SVG generation
- Interactive 3D shape viewer link generation
- Simple Worker deployment with configurable upstream API base

## MCP Tools

### Health
- `health`

### Plotting
- `plot`
- `plot_json`
- `plot_png_link`
- `plot_multi`
- `plot_multi_json`
- `plot_multi_png_link`
- `plot_series`
- `plot_series_json`
- `plot_series_png_link`

### Diagram / 3D helpers
- `force_diagram_link`
- `shape3d_link`

## Project Structure

```text
plot-mcp-worker/
├── src/index.js        # Worker entry + MCP tool handlers
├── wrangler.toml       # Cloudflare Worker config
├── package.json        # local dev dependency manifest
└── README.md
```

## Local Development

```bash
npm install
npx wrangler dev --local --port 8790
```

Health endpoint:

```bash
curl http://127.0.0.1:8790/healthz
```

## Deployment

```bash
npx wrangler deploy
```

Default route in this project:

- `plot-mcp.qdp.qzz.io/*`

Configured upstream base:

- `https://lingion.pythonanywhere.com`

## Notes

- Plot PNG endpoints are proxied through Worker helper routes.
- Force diagrams are generated as inline SVG.
- 3D shape links return embeddable HTML pages powered by Plotly.
