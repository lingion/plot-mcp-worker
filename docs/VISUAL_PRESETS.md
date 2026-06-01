# Visual Preset Specification

> **Status**: Locked as of v0.4.12 (2026-06-01)
> **Purpose**: Prevent future feature work from regressing default visual quality

## Preset System

There are two layout presets: `"default"` and `"math"`. The preset is set at spec-build time in `plot.ts`, not at render time.

| Preset | Trigger | Canvas | Aspect | Legend |
|--------|---------|--------|--------|--------|
| `math` | `buildSinglePlot`, `buildMultiPlot` (expr/function) | 1000×720 | `auto` (unless explicit `equal`) | Outside plot, right side |
| `default` | `buildSeriesPlot`, `buildBarChart`, `buildSubplot` | 1200×720 | none (data-driven) | Outside plot, right side |

## Color Token Table (Dark Theme — the ONLY default)

These are hardcoded in `render.ts`. Do NOT change without visual regression testing.

| Token | Value | Usage |
|-------|-------|-------|
| figureBg | `transparent` | SVG root background |
| cardBg | `#0f172a` @ 0.92 | Outer card fill |
| plotBg | `#111827` @ 0.82 | Plot area fill |
| plotBorder | `#334155` @ 0.5 | Plot area stroke |
| gridLine | `#334155` @ 0.35 | Grid lines |
| axisLine | `#475569` @ 1.0 | X/Y axis lines |
| title | `#e5e7eb` @ 1.0 | Chart title |
| axisLabel | `#cbd5e1` @ 1.0 | Axis labels (xlabel, ylabel) |
| tickLabel | `#cbd5e1` @ 1.0 | Tick labels |
| legendText | `#cbd5e1` @ 1.0 | Legend text |
| legendBg | `#111827` @ 0.82 | Legend box fill |
| legendBorder | `#334155` @ 0.5 | Legend box stroke |
| haloStroke | `#0f172a` @ 0.30 | Line halo |

## Palette

```ts
const DEFAULT_PALETTE = [
  "#60a5fa", // blue
  "#f87171", // red
  "#34d399", // green
  "#fbbf24", // amber
  "#a78bfa", // violet
  "#22d3ee", // cyan
  "#fb923c", // orange
  "#f472b6", // pink
];
```

## Geometry Rules

### Single Plot (renderPlotSvg)

```
outerPadLeft   = 100
outerPadRight  = 36
outerPadTop    = 100
outerPadBottom = 96
legendGap      = 18

plotWidth  = canvasWidth - outerPadLeft - outerPadRight - (legendReserved ? legendW + legendGap : 0)
plotHeight = canvasHeight - outerPadTop - outerPadBottom
```

Legend is rendered **outside** the plot rect, to the right:
```
legendRect = { x: plotX + plotWidth + legendGap, y: plotY, w: legendW, h: legendH }
```

### Multi-plot (renderMultiPlotSvg)

Uses the same "measure → reserve → render" pattern. Legend goes right or bottom depending on available width.

### Subplot cells

Each cell uses `cellPlotRect()` which allocates axis space inside the cell.

## Line Rendering

| Property | Value |
|----------|-------|
| lineWidth | 2.5 |
| haloWidth | 4.5 |
| haloOpacity | 0.30 |
| lineJoin | round |
| lineCap | round |
| scatterRadius | 4.5 |
| scatterStroke | #0f172a @ 0.8, width 1.5 |

## Aspect Rules

| Type | Default | When to use `equal` |
|------|---------|---------------------|
| expr/function (sin, cos, x²) | `auto` | Never, unless user explicitly passes `aspect: "equal"` |
| Geometric (circles, parametric) | N/A | User must explicitly request |
| Series/bar/hist/box/pie | not set | N/A |

## Grid Rules

| Property | Value |
|----------|-------|
| gridLines | 5 |
| strokeWidth | 1 |
| color | #334155 |
| opacity | 0.35 |
| default | ON (grid: true) |

## Rules for Adding New Visual Features

1. **Do not change any color token** without generating both a `sin(x)` plot and a multi-series line plot and verifying they still look correct on a dark background.
2. **Do not move legend back inside plotRect** for single plots. The "outside right" pattern is locked.
3. **Do not change function/expr default aspect** from `auto`. Equal is opt-in only.
4. **Do not change math preset canvas** from 1000×720 without user review.
5. **Any new preset must be opt-in**. The default dark preset is the baseline.
6. **Light theme, if ever added, must be a separate preset** — never replace dark as default.

## Regression Test Checklist

Before any visual change is merged, verify:

- [ ] sin(x) from -2π to 2π: y range ≈ [-1.2, 1.2], not ±2.88
- [ ] sin(x) canvas is ~1000px wide, not 1200+
- [ ] Legend is outside plot area, not overlapping data
- [ ] Plot area is dark (#111827), not light gray
- [ ] Grid is visible but not dominant (opacity 0.35)
- [ ] Line halo is subtle (opacity 0.30), not like a black outline
- [ ] Multi-series line plot: legend shows all series, no overlap with data
- [ ] Bar chart: default layout (1200×720), legend outside
