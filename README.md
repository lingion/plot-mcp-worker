# plot-mcp-worker

[中文版](README_CN.md)

A serverless chart rendering engine running on Cloudflare Workers. It exposes an MCP (Model Context Protocol) server that lets any AI agent generate publication-quality PNG/SVG charts from a single JSON call — no headless browser, no server, no storage bucket.

Charts are rendered as SVG, then rasterized to PNG via [resvg-wasm](https://github.com/nicbarker/resvg-js). CJK text (GB2312 + punctuation + math symbols, 7500+ glyphs) is handled through an opentype.js text-to-path pipeline that embeds font outlines directly into the SVG, ensuring correct rendering regardless of client fonts.

**Live endpoint:** `https://plot-mcp.qdp.qzz.io/mcp`

---

## Showcase

### 1. Trigonometric Composition

![Trigonometric Composition](docs/showcase/en/01_trig_composition.png)

```json
{"tool": "plot_multi", "arguments": {
  "exprs": ["sin(x)", "cos(x)", "sin(x)+cos(x)"],
  "labels": ["sin(x)", "cos(x)", "sin(x) + cos(x)"],
  "x_min": -6.283, "x_max": 6.283,
  "title": "Trigonometric Composition"
}}
```

### 2. Square Wave — Fourier Series Approximation

![Fourier Approximation](docs/showcase/en/02_fourier_approx.png)

```json
{"tool": "plot_multi", "arguments": {
  "exprs": ["sin(x)", "sin(x)+sin(3*x)/3", "sin(x)+sin(3*x)/3+sin(5*x)/5", "sin(x)+sin(3*x)/3+sin(5*x)/5+sin(7*x)/7"],
  "labels": ["1 term", "2 terms", "3 terms", "4 terms"],
  "x_min": -6.283, "x_max": 6.283,
  "title": "Square Wave — Fourier Series Approximation"
}}
```

### 3. tan(x) — Discontinuity Detection

![tan(x) Discontinuity](docs/showcase/en/03_tan_discontinuity.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "tan(x)",
  "x_min": -4.712, "x_max": 4.712,
  "title": "tan(x) — Discontinuity Detection"
}}
```

### 4. sinc(x) = sin(x)/x

![sinc Function](docs/showcase/en/04_sinc_function.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "sin(x)/x",
  "x_min": -15, "x_max": 15,
  "title": "sinc(x) = sin(x)/x"
}}
```

### 5. 1/(x²-1) — Rational Function with Asymptote Annotations

![Rational Asymptotes](docs/showcase/en/05_rational_asymptotes.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "1/(x^2-1)",
  "x_min": -4, "x_max": 4,
  "title": "1/(x²-1) — Rational Function",
  "annotations": [
    {"kind": "vertical_line", "x": -1, "label": "x = -1", "color": "#f87171"},
    {"kind": "vertical_line", "x": 1, "label": "x = 1", "color": "#f87171"}
  ]
}}
```

### 6. Damped Oscillation: e^(-0.3x)·sin(2x)

![Damped Oscillation](docs/showcase/en/06_damped_oscillation.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "exp(-0.3*x)*sin(2*x)",
  "x_min": 0, "x_max": 20,
  "title": "Damped Oscillation: e^(-0.3x)·sin(2x)"
}}
```

### 7. |sin(x)|·cos(x) — Rectified Product

![Absolute Value](docs/showcase/en/07_absolute_value.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "abs(sin(x))*cos(x)",
  "x_min": -6.283, "x_max": 6.283,
  "title": "|sin(x)|·cos(x) — Rectified Product"
}}
```

### 8. Gaussian Mixture Model

![Gaussian Mixture](docs/showcase/en/08_gaussian_mixture.png)

```json
{"tool": "plot_multi", "arguments": {
  "exprs": ["exp(-x*x/2)/sqrt(2*3.14159)", "0.6*exp(-(x-2)*(x-2)/4.5)/sqrt(2*3.14159*1.5)", "0.4*exp(-(x+1.5)*(x+1.5)/1.6)/sqrt(2*3.14159*0.8)"],
  "labels": ["N(0,1)", "0.6·N(2,1.5)", "0.4·N(-1.5,0.8)"],
  "x_min": -6, "x_max": 6,
  "title": "Gaussian Mixture Model"
}}
```

### 9. Decaying Sine with Full Annotation Suite

![Annotated Peaks](docs/showcase/en/09_annotated_peaks.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "exp(-0.2*x)*sin(3*x)",
  "x_min": 0, "x_max": 15,
  "title": "Decaying Sine + Full Annotation Suite",
  "annotations": [
    {"kind": "point", "x": 0.52, "label": "1st peak"},
    {"kind": "shaded_area", "x_min": 5, "x_max": 8, "label": "focus zone"}
  ]
}}
```

### 10. Multi-Series Business Chart with Error Bars

![Business Error Bars](docs/showcase/en/10_business_error_bars.png)

### 11. Grouped Bar Chart with Error Bars

![Grouped Bars](docs/showcase/en/11_grouped_bars.png)

### 12. Stacked Bar Chart

![Stacked Bars](docs/showcase/en/12_stacked_bars.png)

### 13. Pie Chart

![Pie Chart](docs/showcase/en/13_pie_chart.png)

### 14. Histogram

![Histogram](docs/showcase/en/14_histogram.png)

### 15. Box Plot

![Box Plot](docs/showcase/en/15_box_plot.png)

### 16. Log Scale

![Log Scale](docs/showcase/en/16_log_scale.png)

### 17. Scatter with Asymmetric Error Bars

![Scatter Asymmetric](docs/showcase/en/17_scatter_asymmetric.png)

### 18. Transform Pipeline — Raw → Smoothed → Normalized

![Transform Pipeline](docs/showcase/en/18_transform_pipeline.png)

### 19. 2×2 Subplot Grid

![Subplot 2x2](docs/showcase/en/19_subplot_2x2.png)

### 20. Teaching Template — Definite Integral

![Teaching Integral](docs/showcase/en/20_teaching_integral.png)

---

## Features

### Chart Types

| Type | Description |
|------|-------------|
| Function plot | Single expression `f(x)` — auto-detected trig/π mode, discontinuity handling |
| Multi-expression | Multiple `f(x)` curves on one chart with auto legend |
| Scatter / Line | Explicit `(x, y)` data arrays with optional error bars |
| Bar / Grouped / Stacked | Categorical bar charts with error bars |
| Histogram | Automatic binning from raw data |
| Box plot | Per-group distribution with whiskers, median, outliers |
| Pie chart | Labeled slices with percentage display |
| Subplot grid | M×N layout with shared axes and per-cell series |

### Axis Engine

The axis system uses an intent-driven architecture: the caller (typically an LLM) suggests a semantic mode, and the engine computes the actual tick values, labels, and bounds.

- **Nice ticks**: Steps from `{1, 2, 2.5, 5} × 10ⁿ` — no values like 0.72 or 1.3
- **Auto π-mode**: Trigonometric expressions automatically get `−2π, −π, 0, π, 2π` x-axis labels
- **Trig y-special**: sin/cos plots get `[-1, -0.5, 0, 0.5, 1]` ticks instead of arbitrary decimals
- **0-symmetric**: Function plots default to a y-axis centered on zero
- **Discontinuity detection**: Sign-flip + large Δy triggers path breaks — no vertical spikes in tan(x), 1/x, etc.

### CJK Text Rendering

Chinese and other CJK text is rendered via an opentype.js text-to-path pipeline:

1. The SVG is generated with `<text>` elements as usual
2. Before rasterization, `pathifyCjkText()` finds all `<text>` elements containing CJK characters
3. Each is converted to `<path>` using opentype.js `font.getPath()`, embedding the actual glyph outlines
4. resvg then rasterizes the path-based SVG — no font matching needed

The font subset covers **7,556 characters**: full GB2312 (6,763 CJK + symbols), ASCII, fullwidth punctuation (·——、。，：；！？""''【】《》…), and math symbols (αβγπ∫∑√∞≤≥±).

### Data Transforms

A pipeline system processes series data before rendering:

| Transform | Description |
|-----------|-------------|
| `normalize` | Min-max, z-score, or max-abs normalization |
| `smooth` | Moving average with configurable window |
| `filter` | Range-based filtering on x or y |
| `rolling` | Rolling statistics (mean, median, std) |
| `downsample` | Reduce point count via min-max or LTTB |

### Annotations

Rich annotation layer for marking up plots:

- **Vertical lines** with labels (asymptotes, thresholds)
- **Point markers** with text labels (peaks, zeros, events)
- **Shaded areas** with labels (regions of interest)
- **Text labels** at arbitrary coordinates

### MCP Tools

The server exposes these tools via the MCP protocol (JSON-RPC over HTTP POST):

#### Plotting

| Tool | Description |
|------|-------------|
| `plot` / `plot_png_link` | Single expression — auto π, trig, discontinuity |
| `plot_multi` / `plot_multi_png_link` | Multiple expressions on one chart |
| `plot_series` / `plot_series_png_link` | Explicit data arrays — scatter/bar/hist/box/pie + error bars |
| `plot_bar` / `plot_bar_json` | Bar chart shorthand |
| `multi_plot` | M×N subplot grid with shared legend |

#### Diagrams

| Tool | Description |
|------|-------------|
| `force_diagram_link` | Free-body / force diagram |
| `force_analysis_link` | Force analysis with axes, components, resultant |
| `force_analysis_template_link` | Pre-built mechanics templates (incline, hanging mass, etc.) |
| `circuit_diagram_link` | Circuit schematic with common components |
| `circuit_template_link` | Pre-built circuit templates (series, parallel, etc.) |
| `venn_diagram_link` | 2-set or 3-set Venn diagram |
| `c_memory_diagram_link` | C-language memory layout / pointer diagram |
| `shape3d_link` | Interactive 3D shape viewer |

#### Teaching

| Tool | Description |
|------|-------------|
| `teaching_template` | Single teaching visualization (definite integral, tangent, projectile, SHM, etc.) |
| `teaching_sequence` | Coordinated multi-figure teaching sequence |

#### Analysis

| Tool | Description |
|------|-------------|
| `analysis` | Statistical operations: `describe`, `corr`, `groupby` |

### Design System

- **Dark theme default**: `#0f172a` card, `#111827` plot area, `#334155` grid at 0.35 opacity
- **Color palette**: `#60a5fa, #f87171, #34d399, #fbbf24, #a78bfa, #22d3ee, #fb923c, #f472b6`
- **Legend**: Placed outside plot area (right-side reserved) — never overlaps data
- **Layout presets**: Math (1000×720) for functions, Report (1200×720) for data charts
- **Line halo**: 0.30 opacity dark stroke behind each line — readable on any background without visual clutter

---

## Quick Start

### Using with an MCP Client

Any MCP-compatible client (Claude Desktop, OpenClaw, Cursor, etc.) can connect by adding this to the MCP server configuration:

```json
{
  "mcpServers": {
    "plot": {
      "url": "https://plot-mcp.qdp.qzz.io/mcp"
    }
  }
}
```

Then ask your AI to plot something:

> "Plot sin(x) from -2π to 2π with grid lines"

The AI will call the `plot_png_link` tool and return a direct PNG URL.

### Direct API Calls

You can also call the MCP endpoint directly:

```bash
# Plot a function
curl -X POST https://plot-mcp.qdp.qzz.io/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "plot_png_link",
      "arguments": {
        "expr": "sin(x)*exp(-0.1*x)",
        "title": "Damped Sine Wave",
        "x_min": -10,
        "x_max": 30,
        "grid": true
      }
    }
  }'
```

Response:
```json
{
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"ok\":true,\"data\":{\"png_url\":\"https://plot-mcp.qdp.qzz.io/png?d=...\"}}"
    }]
  }
}
```

The `png_url` points to a rendered PNG image (1000×720, dark theme). URLs are compressed and may use short links for large payloads.

### SVG Output

For SVG instead of PNG, use the `/plot` endpoint:

```bash
# Decode the compressed payload from a png_url, then:
curl "https://plot-mcp.qdp.qzz.io/plot?d=<compressed_payload>"
```

---

## Self-Hosting

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- A [Cloudflare](https://dash.cloudflare.com/) account (free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### 1. Clone and Install

```bash
git clone https://github.com/lingion/plot-mcp-worker.git
cd plot-mcp-worker
npm install
```

### 2. Create KV Namespace

The service uses Cloudflare KV for two purposes:
- **Short links**: PNG URLs that exceed 3,600 characters are stored as KV short links
- **Font storage**: CJK font subset is loaded from KV at runtime (keeps the Worker bundle under CF's 3MB gzip limit)

```bash
npx wrangler kv namespace create SHORT_LINKS
```

Update `wrangler.toml` with the returned namespace ID:

```toml
[[kv_namespaces]]
binding = "SHORT_LINKS"
id = "<your-namespace-id>"
```

### 3. Upload CJK Font (Optional)

For Chinese/Japanese/Korean text rendering, upload the font subset to KV:

```bash
# If you have the font subset file:
npx wrangler kv key put "font:arial-unicode-cn-gb2312" \
  --namespace-id <your-namespace-id> \
  --path path/to/font-subset.ttf \
  --remote
```

Without this, CJK characters will render as boxes. ASCII and Latin text work without the font.

### 4. Deploy

```bash
npx wrangler deploy
```

The Worker will be available at `https://<your-subdomain>.workers.dev/mcp`.

### 5. Custom Domain (Optional)

Add a route in `wrangler.toml`:

```toml
[[routes]]
pattern = "plot-mcp.yourdomain.com/*"
zone_name = "yourdomain.com"
```

### Configuration

All configuration is in `wrangler.toml` and `src/constants.ts`:

| Constant | Default | Description |
|----------|---------|-------------|
| `DEFAULT_WIDTH` | 1000 | Canvas width (px) for math preset |
| `DEFAULT_HEIGHT` | 720 | Canvas height (px) |
| `DEFAULT_FONT_FAMILY` | `ArialUnicodeCN` | Font family for CJK |
| `DEFAULT_BG` | `safe-dark` | Dark theme card |
| `DEFAULT_GRID` | true | Show grid lines |
| `DEFAULT_PALETTE` | 8 colors | Line color cycle |

### Local Development

```bash
npx wrangler dev
# Server starts at http://127.0.0.1:8787
```

---

## Architecture

```
MCP Request (JSON-RPC)
    │
    ▼
┌──────────────────┐
│   Router (index)  │  Parse tool name → dispatch
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   Plot Builder   │  normalize args → build spec
│   (plot.ts)       │  detect trig, pi-mode, layout
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   SVG Renderer   │  Generate SVG string
│   (render.ts)     │  - Axes, ticks, grid, labels
│                   │  - Data series (path, rect, etc.)
│                   │  - Legend, annotations
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  CJK Pathify     │  <text> → <path> for CJK chars
│  (opentype.js)    │  Font loaded from KV, cached in memory
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  PNG Rasterizer  │  resvg-wasm SVG → PNG
│                   │  Returns image/png response
└──────────────────┘
```

Key design decisions:
- **No headless browser**: SVG is built as a string, rasterized by resvg-wasm (Rust → WASM)
- **Font embedding via path**: CJK glyphs are pre-converted to SVG paths, avoiding font-matching issues in the WASM runtime
- **KV for large assets**: Font file (2.5MB) is stored in KV, loaded once per Worker isolate, cached in memory
- **Bundle size**: ~1MB gzip (under CF free tier's 3MB limit)

---

## Dependencies

| Package | Purpose |
|---------|---------|
| [`@resvg/resvg-wasm`](https://github.com/nicbarker/resvg-js) | SVG → PNG rasterization (Rust via WASM) |
| [`opentype.js`](https://opentype.js.org/) | CJK text-to-path conversion |
| [`expr-eval`](https://github.com/silentmatt/expr-eval) | Math expression parser for `f(x)` plots |

No other runtime dependencies. Total bundle: ~1MB gzipped.

---

## License

MIT
