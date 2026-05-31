# v0.2.0 — Unified Capability Model

## Added

### New chart types
- **Histogram** (`plot_series` with `type: "hist"`) — auto-binning + custom bins, count labels
- **Box plot** (`plot_series` with `type: "box"`) — median, Q1/Q3, whiskers, outlier detection
- **Pie chart** (`plot_series` with `type: "pie"`) — donut style with labels and percentages

### Analysis tool
- `analysis` with `action: "describe"` — count, min, max, mean, median, std, variance, Q1, Q3, IQR
- `analysis` with `action: "corr"` — Pearson correlation matrix (hand-written, no dependencies)
- `analysis` with `action: "groupby"` — group-wise statistics

### 3D data visualization
- `geometry_3d` with `kind: "scatter3d"` / `"line3d"` / `"surface3d"` — Plotly CDN HTML output

### Architecture
- **Canonical tool model** — 8 unified tools: `plot`, `plot_series`, `diagram`, `geometry_3d`, `teaching`, `template`, `analysis`, `health`
- **Render format control** — `render: { format: "png" | "svg" | "json" | "link" | "html" }`
- **Frozen type interfaces** — `types.ts` with `RenderOutput`, `ToolInput`, canonical tool names
- **Compat layer** — all 21 legacy tool names preserved and auto-translated to canonical tools

### Quality
- **8 regression tests** (`scripts/smoke.mjs`) — corr, describe, hist, box, pie, legacy, diagram, geometry_3d
- Custom axis labels, title, `y_min`/`y_max` for hist and box plots

## Changed
- `plot` now accepts `render.format` to control output (legacy names still work)
- `diagram` consolidates force/circuit/venn/c-memory under `diagram_type` param
- `geometry_3d` consolidates shape3d + new 3D data viz under `kind` param

## Compatibility
- **All 21 legacy tool names fully supported** — zero breaking changes
- `plot_png_link`, `force_diagram_link`, `shape3d_link`, etc. all continue to work

## Stats verification
- `corr([1,2,3,4,5], [2,4,6,8,10])` → `1.0` ✓
- `describe([1..10])` → mean=5.5, std=3.0277, Q1=3.25, Q3=7.75 ✓
