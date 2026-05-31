# v0.4.0 — Phase 3C: Subplot / Multi-plot Layout

## Added
- **`multi_plot` tool**: multi-panel subplot layout with rows × cols grid
- **Independent cell rendering**: each subplot cell has its own `plotRect`, scale, and `clipPathId`
- **Layout options**: `rows`, `cols`, `gap` (px between cells), `sharedX`, `sharedY`
- **Per-cell spec**: each cell has its own `title`, `series`, `xlabel`, `ylabel`, `y_scale`
- **`renderMultiPlotSvg()`**: composes all cells into a single SVG with global title + legend
- **Global legend**: deduplicates series names across all cells, renders top-right
- **sharedX / sharedY**: computes union domain across all cells for aligned axes

## Architecture
- New `MultiPlotCell` / `MultiPlotResult` types in `plot.ts`
- New `buildSubplot()` normalizes multi-plot input into per-cell `PlotSpec`
- New `renderSubplotCell()` renders one cell with its own clip path
- Existing `renderPlotSvg()` unchanged — single-plot path is fully preserved

## Quality
- **15/15 smoke tests** (existing 14 + multi_plot)
- Visual tests: 2x1 / 1x2 / 2x2 / sharedY / subplot+error bar

---

# v0.3.3 — Error bar refinement

## Added
- **ErrorInput forms**: `error: number` (constant), `error: number[]` (per-point symmetric), `error: { plus, minus }` (asymmetric — each may be number or number[])
- **`normalizeErrorAt()`**: normalizes any ErrorInput to `{ plus, minus } | undefined` per point, used by both bounds calculation and render

## Changed
- **Error bar caps**: now visible on all error bars (line, scatter, bar, grouped bar)
- **Cap width**: `auto = min(14, max(6, barWidth * 0.45))` for bars; `10px` default for line/scatter
- **Opacity**: error bars use `opacity=1` (was `0.7` before)
- **Style**: `strokeWidth=1.5`, `stroke=series.color`

## Fixed
- **Log scale skip**: when `value - minus <= 0` in log scale, the error bar is skipped cleanly; the data point itself is preserved (no fake clamped bar)
- **Grouped bar alignment**: error bars now center on each bar's center, not category center

## Quality
- **14/14 smoke tests** — all above plus 5 new error bar tests
- Visual tests: line/scatter/bar/grouped bar error bars + log skip case

---

# v0.3.2 — Replace proprietary font with Arial Sans

## Changed
- **Primary embedded font**: replaced `Helvetica Neue` (proprietary) with `Arial Sans` (Arial Supplemental — MIT-derived license, 2792 glyphs, full ASCII/math coverage).
- `defaultFontFamily` / `sansSerifFamily` changed to `"Arial"`.
- Font buffer order: `[arialSans, pingFangSubset]` — Arial tried first, PingFang SC falls back for CJK glyphs.

## Quality
- 9/9 regression tests pass.
- `y=2^x` caret glyph confirmed visible in PNG output.

## Note
- Arial Supplemental is a Microsoft font provided with macOS. It has broader Latin glyph coverage than the stripped PingFang SC subset and resolves the `^` glyph issue.
- For fully open-source deployments, replace with Liberation Sans or Noto Sans once network access is available.

---

# v0.3.1 — Font glyph fix + Log scale

## Fixed
- **Missing caret glyph (`^`) in PNG output** — SVG text `y=2^x` was rendering as `y=2 x` because the PingFang SC subset font (136 glyphs) was missing the `^` glyph and resvg-wasm does not per-glyph fallback. Fixed by embedding a system Latin font as the primary font for all SVG→PNG rendering, with PingFang SC subset preserved as CJK fallback.
- **Log scale tick labels** — `10^n` format now uses SVG `<tspan dy>` superscript rendering for clean visual output.
- **Legend label rendering** for expressions such as `y=2^x` — now passes plain text (XML-escaped only) to avoid formatter interference.

## Changed
- `defaultFontFamily` / `sansSerifFamily` changed from `"PingFang SC"` to the embedded system Latin font.
- Font buffer order: `[embeddedLatinFont, pingFangSubset]`.
- Log tick generation: pure `10^p` powers (no linear fallback in log domain).

## Quality
- **9 regression tests** (`scripts/smoke.mjs`) — all above plus caret glyph regression test.
- `y=2^x` scatter+line chart verified in PNG output (log scale).

## ⚠️ Note on Helvetica Neue
Helvetica Neue is a proprietary system font. The embedded TTF is sourced from the local macOS installation. For open-source or public deployments, consider replacing with an open-source Latin font such as **Liberation Sans**, **Noto Sans**, or **DejaVu Sans**.

---

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
