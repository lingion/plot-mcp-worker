# plot-mcp-worker

[中文版](README_CN.md)

Serverless chart rendering engine. Runs on Cloudflare Workers. Outputs PNG/SVG via MCP protocol.

Zero dependencies at runtime. No headless browser. Pure SVG → PNG via resvg-wasm.

---

## Showcase

### 1. Trigonometric Composition

sin, cos, and their sum — auto-detected π-mode x-axis, trig y-special ticks `[-1, -0.5, 0, 0.5, 1]`, auto legend outside plot area.

![Trigonometric Composition](docs/showcase/en/01_trig_composition.png)

```json
{"tool": "plot_multi", "arguments": {
  "exprs": ["sin(x)", "cos(x)", "sin(x)+cos(x)"],
  "labels": ["sin(x)", "cos(x)", "sin(x) + cos(x)"],
  "x_min": -6.283, "x_max": 6.283,
  "title": "Trigonometric Composition"
}}
```

---

### 2. Square Wave — Fourier Series Approximation

Progressively adding odd harmonics to approximate a square wave. 4 series, auto π-axis, math preset.

![Fourier Approximation](docs/showcase/en/02_fourier_approx.png)

```json
{"tool": "plot_multi", "arguments": {
  "exprs": ["sin(x)", "sin(x)+sin(3*x)/3", "sin(x)+sin(3*x)/3+sin(5*x)/5", "sin(x)+sin(3*x)/3+sin(5*x)/5+sin(7*x)/7"],
  "labels": ["1 term", "2 terms", "3 terms", "4 terms"],
  "x_min": -6.283, "x_max": 6.283,
  "title": "Square Wave — Fourier Series Approximation"
}}
```

---

### 3. tan(x) — Discontinuity Detection

Automatic asymptote break detection — no spikes, no vertical lines connecting ±∞. The engine detects sign-flip + large Δy and breaks the path.

![tan(x) Discontinuity](docs/showcase/en/03_tan_discontinuity.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "tan(x)",
  "x_min": -4.712, "x_max": 4.712,
  "title": "tan(x) — Discontinuity Detection"
}}
```

---

### 4. sinc(x) = sin(x)/x

Classic signal processing function with removable singularity handling at x=0.

![sinc Function](docs/showcase/en/04_sinc_function.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "sin(x)/x",
  "x_min": -15, "x_max": 15,
  "title": "sinc(x) = sin(x)/x"
}}
```

---

### 5. 1/(x²-1) — Rational Function with Asymptote Annotations

Vertical asymptote markers at x = ±1. The engine renders pole gaps without artifact spikes.

![Rational Asymptotes](docs/showcase/en/05_rational_asymptotes.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "1/(x^2-1)",
  "x_min": -4, "x_max": 4,
  "title": "1/(x²-1) — Rational Function",
  "annotations": [
    {"kind": "vertical_line", "x": -1, "label": "x = -1", "color": "#f87171"},
    {"kind": "vertical_line", "x":  1, "label": "x = 1",  "color": "#f87171"}
  ]
}}
```

---

### 6. Damped Oscillation

Exponential decay × trig — automatic nice ticks, smooth rendering across 15 units.

![Damped Oscillation](docs/showcase/en/06_damped_oscillation.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "exp(-0.3*x)*sin(2*x)",
  "x_min": 0, "x_max": 15,
  "title": "Damped Oscillation: e^(-0.3x)·sin(2x)"
}}
```

---

### 7. |sin(x)|·cos(x) — Rectified Product

Absolute value composition — non-trivial waveform with sign changes.

![Rectified Product](docs/showcase/en/07_absolute_value.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "abs(sin(x))*cos(x)",
  "x_min": -10, "x_max": 10,
  "title": "|sin(x)|·cos(x) — Rectified Product"
}}
```

---

### 8. Gaussian Mixture Model

Three Gaussians with different means and variances — normal distribution rendering at its finest.

![Gaussian Mixture](docs/showcase/en/08_gaussian_mixture.png)

```json
{"tool": "plot_multi", "arguments": {
  "exprs": ["exp(-x*x/2)/sqrt(2*3.14159)", "0.6*exp(-(x-2)*(x-2)/1.5)/sqrt(2*3.14159*1.5)", "0.4*exp(-(x+1.5)*(x+1.5)/0.8)/sqrt(2*3.14159*0.8)"],
  "labels": ["N(0,1)", "0.6·N(2,1.5)", "0.4·N(-1.5,0.8)"],
  "x_min": -6, "x_max": 8,
  "title": "Gaussian Mixture Model"
}}
```

---

### 9. Decaying Sine with Full Annotation Suite

Area shading, point markers, vertical line, and text labels — all annotation types in one chart.

![Annotated Peaks](docs/showcase/en/09_annotated_peaks.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "sin(x)*exp(-0.1*x)",
  "x_min": 0, "x_max": 20,
  "title": "Decaying Sine with Annotations",
  "annotations": [
    {"kind": "area", "x_min": 4.5, "x_max": 7.5, "label": "1st peak zone", "color": "#60a5fa", "opacity": 0.15},
    {"kind": "area", "x_min": 11, "x_max": 14, "label": "2nd peak zone", "color": "#34d399", "opacity": 0.15},
    {"kind": "point", "x": 5.5, "y": 0.58, "label": "Peak 1", "color": "#fbbf24"},
    {"kind": "point", "x": 12, "y": 0.30, "label": "Peak 2", "color": "#fbbf24"},
    {"kind": "vertical_line", "x": 10, "label": "Half-life ≈ 10", "color": "#f87171"}
  ]
}}
```

---

### 10. Multi-Series Business Chart with Error Bars

Forecast vs Actual vs Target — asymmetric error bars on scatter, clean legend outside plot area.

![Business Error Bars](docs/showcase/en/10_business_error_bars.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "Q1-Q4 Revenue Forecast vs Actual",
  "xlabel": "Quarter", "ylabel": "Revenue (M USD)",
  "series": [
    {"name": "Forecast", "type": "line+scatter", "points": [[1,120],[2,185],[3,310],[4,490]], "color": "#60a5fa", "error": [8,12,20,35]},
    {"name": "Actual",   "type": "line+scatter", "points": [[1,135],[2,178],[3,345],[4,510]], "color": "#f87171", "error": [5,10,15,25]},
    {"name": "Target",   "type": "line",         "points": [[1,150],[2,200],[3,300],[4,450]], "color": "#34d399"}
  ]
}}
```

---

### 11. Grouped Bar Chart with Error Bars

3 models × 4 tests — per-bar error bars, auto-category labels.

![Grouped Bars](docs/showcase/en/11_grouped_bars.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "Performance Benchmarks",
  "xlabel": "Test", "ylabel": "Score",
  "bar_style": "grouped",
  "series": [
    {"name": "Model A", "type": "bar", "points": [[0,92],[1,78],[2,85],[3,95]], "group": "g", "color": "#60a5fa", "error": [2,3,2,1]},
    {"name": "Model B", "type": "bar", "points": [[0,88],[1,82],[2,91],[3,87]], "group": "g", "color": "#f87171", "error": [3,2,1,2]},
    {"name": "Model C", "type": "bar", "points": [[0,95],[1,74],[2,79],[3,90]], "group": "g", "color": "#34d399", "error": [1,4,3,2]}
  ]
}}
```

---

### 12. Stacked Bar Chart

Cloud cost breakdown — compute, storage, network stacked by month.

![Stacked Bars](docs/showcase/en/12_stacked_bars.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "Cloud Infrastructure Costs — Stacked",
  "xlabel": "Month", "ylabel": "Cost ($)",
  "bar_style": "stacked",
  "series": [
    {"name": "Compute", "type": "bar", "points": [[1,3200],[2,3500],[3,4100],[4,4800],[5,5200],[6,5600]], "group": "g", "color": "#60a5fa"},
    {"name": "Storage", "type": "bar", "points": [[1,1200],[2,1400],[3,1600],[4,1900],[5,2200],[6,2500]], "group": "g", "color": "#34d399"},
    {"name": "Network", "type": "bar", "points": [[1,800],[2,900],[3,1100],[4,1300],[5,1500],[6,1800]], "group": "g", "color": "#fbbf24"}
  ]
}}
```

---

### 13. Pie Chart

Team time allocation — donut-style with percentage labels.

![Pie Chart](docs/showcase/en/13_pie_chart.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "Time Allocation — AI Research Team",
  "series": [{"type": "pie", "name": "team", "labels": ["Training","Data Prep","Evaluation","Infra","Meetings","Research"], "values": [35,20,15,12,8,10]}]
}}
```

---

### 14. Histogram

Response latency distribution with auto-binning.

![Histogram](docs/showcase/en/14_histogram.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "Response Latency Distribution",
  "xlabel": "Latency", "ylabel": "Count",
  "series": [{"type": "hist", "name": "latency", "data": [12,15,18,22,25,28,30,32,35,38,41,45,48,52,55,58,62,65,68,72,75,78,82,85,88,92,95,98,102,105,108,112,115,118,122,125,128,132,135,138,142,145,148,152,155,158,162], "bins": 10}]
}}
```

---

### 15. Box Plot

Model accuracy comparison — median, quartiles, whiskers, outliers.

![Box Plot](docs/showcase/en/15_box_plot.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "Model Accuracy Across Datasets",
  "ylabel": "Accuracy (%)",
  "series": [
    {"type": "box", "name": "GPT-4",  "data": [82,85,87,89,90,91,92,93,94,95,97]},
    {"type": "box", "name": "Claude", "data": [80,84,86,88,90,91,92,93,95,96,98]},
    {"type": "box", "name": "Gemini", "data": [75,79,83,85,87,89,90,92,93,94,96]}
  ]
}}
```

---

### 16. Log Scale

Training loss over 10 epochs — y-axis automatically switches to logarithmic tick formatting.

![Log Scale](docs/showcase/en/16_log_scale.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "Training Loss (Log Scale)",
  "xlabel": "Epoch", "ylabel": "Loss",
  "y_scale": "log",
  "series": [{"name": "Loss", "type": "line", "points": [[1,2.5],[2,1.8],[3,0.95],[4,0.42],[5,0.18],[6,0.072],[7,0.031],[8,0.014],[9,0.006],[10,0.003]], "color": "#a78bfa"}]
}}
```

---

### 17. Scatter with Asymmetric Error Bars

Experimental measurements where uncertainty is not symmetric — `error: { plus: [...], minus: [...] }`.

![Scatter Asymmetric](docs/showcase/en/17_scatter_asymmetric.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "Experimental Measurements — Asymmetric Uncertainty",
  "xlabel": "Temperature (K)", "ylabel": "Conductivity (S/m)",
  "series": [{"name": "Measurement", "type": "scatter", "points": [[200,0.12],[250,0.28],[300,0.45],[350,0.67],[400,0.88],[450,1.05],[500,1.22]], "color": "#f472b6", "error": {"plus": [0.02,0.03,0.05,0.08,0.06,0.04,0.03], "minus": [0.01,0.02,0.03,0.05,0.04,0.03,0.02]}}]
}}
```

---

### 18. Transform Pipeline — Raw → Smoothed → Normalized

Three views of the same noisy data: raw scatter, smoothed line (window=3), and min-max normalized.

![Transform Pipeline](docs/showcase/en/18_transform_pipeline.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "Raw → Smoothed → Normalized Pipeline",
  "xlabel": "Sample", "ylabel": "Value",
  "series": [
    {"name": "Raw",        "type": "scatter", "points": [[0,2.1],[1,8.3],[2,4.5],[3,12.1],[4,6.2],[5,15.8],[6,9.1],[7,3.2],[8,11.5],[9,7.8],[10,14.2],[11,5.5]], "color": "#475569"},
    {"name": "Smoothed",   "type": "line",    "points": [[0,2.1],[1,8.3],[2,4.5],[3,12.1],[4,6.2],[5,15.8],[6,9.1],[7,3.2],[8,11.5],[9,7.8],[10,14.2],[11,5.5]], "color": "#60a5fa", "transforms": [{"type": "smooth", "window": 3}]},
    {"name": "Normalized", "type": "line",    "points": [[0,2.1],[1,8.3],[2,4.5],[3,12.1],[4,6.2],[5,15.8],[6,9.1],[7,3.2],[8,11.5],[9,7.8],[10,14.2],[11,5.5]], "color": "#f472b6", "transforms": [{"type": "normalize", "method": "minmax"}]}
  ]
}}
```

---

### 19. 2×2 Subplot Grid

Four different chart types in one figure — line, scatter, function — with shared legend outside the grid.

![Subplot 2x2](docs/showcase/en/19_subplot_2x2.png)

```json
{"tool": "multi_plot", "arguments": {
  "title": "Function Gallery",
  "rows": 2, "cols": 2,
  "plots": [
    {"row": 0, "col": 0, "title": "sin(x)",    "series": [{"type": "line",    "name": "sin(x)",   "points": [[-3.14,0],[-1.57,-1],[0,0],[1.57,1],[3.14,0]],  "color": "#60a5fa"}]},
    {"row": 0, "col": 1, "title": "x²",         "series": [{"type": "line",    "name": "x²",       "points": [[-3,9],[-2,4],[-1,1],[0,0],[1,1],[2,4],[3,9]],   "color": "#f87171"}]},
    {"row": 1, "col": 0, "title": "exp(-x)",    "series": [{"type": "line",    "name": "exp(-x)",  "points": [[-2,7.39],[-1,2.72],[0,1],[1,0.37],[2,0.14]],    "color": "#34d399"}]},
    {"row": 1, "col": 1, "title": "log(x)",     "series": [{"type": "scatter", "name": "log(x)",   "points": [[0.1,-2.3],[0.5,-0.69],[1,0],[2,0.69],[5,1.6]], "color": "#fbbf24"}]}
  ]
}}
```

---

### 20. Teaching Template — Definite Integral

Built-in teaching module: shaded integral region, formula, bounds.

![Teaching Integral](docs/showcase/en/20_teaching_integral.png)

```json
{"tool": "teaching", "arguments": {
  "topic": "definite_integral",
  "params": {"expr": "x^2 - x + 1", "a": 0, "b": 3},
  "title": "∫₀³ (x² - x + 1) dx"
}}
```

---

## Features

### Rendering
- Pure SVG → PNG via resvg-wasm (no headless browser, no puppeteer)
- Dark theme first-class: `#0f172a` card, `#111827` plot area, `#334155` grid
- Chart types: line, scatter, line+scatter, bar, grouped bar, stacked bar, histogram, box plot, pie
- Multi-plot subplot grids (M × N) with shared legend
- Error bars (symmetric array / constant / asymmetric `{plus, minus}`) on line, scatter, and bar
- Annotations: vertical lines, point markers, text labels, shaded areas

### Axis Engine (v0.4.13)
- **Nice ticks**: step selection from 1, 2, 2.5, 5 × 10ⁿ — no ugly values like 0.72 or 1.2
- **Auto π-mode**: trig functions automatically get π-formatted x-axis
- **Trig y-special**: sin/cos gets `[-1, -0.5, 0, 0.5, 1]` instead of arbitrary decimals
- **0-symmetric**: math-style function plots default to symmetric y-axis
- **Discontinuity detection**: sign-flip + large Δy → path break (no vertical spikes)
- **Intent system**: LLM suggests semantic mode, engine owns geometry

### Math
- Expression parser via expr-eval: `sin(x)`, `exp(-0.3*x)*cos(2*x)`, `1/(x^2-1)`
- Piecewise functions
- Up to 20,000 points per series
- Transform pipeline: normalize (minmax/zscore/maxabs), smooth, filter, rolling average, downsample

### MCP Tools

| Tool | Description |
|------|-------------|
| `plot` / `plot_png_link` | Single expression — auto π, trig detection, discontinuity handling |
| `plot_multi` | Multiple expressions on one chart |
| `plot_series` | Explicit data arrays — line/scatter/bar/hist/box/pie + error bars |
| `plot_bar` | Bar chart shorthand |
| `multi_plot` | M×N subplot grid with shared legend |
| `analysis` | Statistics: describe, correlation, groupby |
| `teaching` | Math templates: definite integral, tangent/derivative, Fourier series, projectile, SHM, energy, RC/RLC, parabola |
| `diagram` | Force diagrams, circuit diagrams, Venn diagrams |
| `geometry_3d` | 3D shape rendering |

### Design
- Legend outside plot area (right-side reserved) — never overlaps data
- Math preset (1000×720) vs report preset (1200×720)
- Line halo at 0.30 opacity — readable but invisible to the user
- Font: system sans-serif with PingFang SC subset for CJK

## Deployment

```bash
npx wrangler deploy
```

Requires Cloudflare Workers with a KV namespace for short-link PNG URLs.

## License

MIT
