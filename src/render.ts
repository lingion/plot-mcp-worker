import { Resvg, initWasm } from "@resvg/resvg-wasm";
import wasmModule from "@resvg/resvg-wasm/index_bg.wasm";
import pingFangSubset from "./PingFangSC-Regular.subset.ttf";
import { DEFAULT_AXIS, DEFAULT_BG, DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE, DEFAULT_GRID, DEFAULT_HEIGHT, DEFAULT_WIDTH, Env } from "./constants";
import { HistogramBin, BoxPlotGroup, PieSlice, PlotAnnotation, PlotPoint, PlotSpec } from "./plot";
import { escapeXml, toBase64 } from "./utils";

const SUPERSCRIPT_MAP: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "(": "⁽",
  ")": "⁾",
  "n": "ⁿ",
  "i": "ⁱ",
};

const SUBSCRIPT_MAP: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  "(": "₍",
  ")": "₎",
  "a": "ₐ",
  "e": "ₑ",
  "h": "ₕ",
  "i": "ᵢ",
  "j": "ⱼ",
  "k": "ₖ",
  "l": "ₗ",
  "m": "ₘ",
  "n": "ₙ",
  "o": "ₒ",
  "p": "ₚ",
  "r": "ᵣ",
  "s": "ₛ",
  "t": "ₜ",
  "u": "ᵤ",
  "v": "ᵥ",
  "x": "ₓ",
};

let wasmReady: Promise<void> | null = null;

async function ensureResvgReady() {
  if (!wasmReady) {
    wasmReady = initWasm(wasmModule);
  }
  await wasmReady;
}

function mapX(x: number, xMin: number, xMax: number, plotX: number, plotWidth: number): number {
  return plotX + ((x - xMin) / (xMax - xMin)) * plotWidth;
}

function mapY(y: number, yMin: number, yMax: number, plotY: number, plotHeight: number): number {
  return plotY + plotHeight - ((y - yMin) / (yMax - yMin)) * plotHeight;
}

function toScriptText(text: string, map: Record<string, string>): string {
  return text.split("").map((char) => map[char] || char).join("");
}

function formatFormulaText(input: string): string {
  const normalized = String(input || "").trim();
  if (!normalized) return "";
  return normalized
    .replace(/([A-Za-zα-ωΑ-Ω])_\{([^{}]+)\}/g, (_match, head, sub) => `${head}${toScriptText(sub, SUBSCRIPT_MAP)}`)
    .replace(/([A-Za-zα-ωΑ-Ω])_([A-Za-z0-9()+-]+)/g, (_match, head, sub) => `${head}${toScriptText(sub, SUBSCRIPT_MAP)}`)
    .replace(/\^\{([^{}]+)\}/g, (_match, sup) => toScriptText(sup, SUPERSCRIPT_MAP))
    .replace(/\^([A-Za-z0-9()+-]+)/g, (_match, sup) => toScriptText(sup, SUPERSCRIPT_MAP))
    .replace(/sqrt\(([^()]+)\)/g, (_match, inner) => `√(${inner})`)
    .replace(/<=/g, "≤")
    .replace(/>=/g, "≥")
    .replace(/!=/g, "≠")
    .replace(/\*\*/g, "^");
}

function formulaText(text: string): string {
  return escapeXml(formatFormulaText(text));
}

function makePath(points: PlotPoint[], spec: PlotSpec, plotX: number, plotY: number, plotWidth: number, plotHeight: number): string {
  if (points.length === 0) return "";
  const xSpan = spec.xMax - spec.xMin;
  const ySpan = spec.yMax - spec.yMin;
  const typicalDx = points.length > 1 ? Math.max(1e-9, xSpan / Math.max(1, points.length - 1)) : xSpan;
  return points
    .map((point, index) => {
      const previous = index > 0 ? points[index - 1] : null;
      const jump = previous
        ? Math.abs(point.y - previous.y) > ySpan * 0.45 || Math.abs(point.x - previous.x) > typicalDx * 2.5
        : false;
      const x = mapX(point.x, spec.xMin, spec.xMax, plotX, plotWidth);
      const y = mapY(point.y, spec.yMin, spec.yMax, plotY, plotHeight);
      return `${index === 0 || jump ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function renderLegend(spec: PlotSpec, width: number): string {
  return spec.series.map((series, index) => {
    const y = 90 + index * 28;
    return `<g><rect x="${width - 290}" y="${y - 12}" width="18" height="4" fill="${series.color}" rx="2"/><text x="${width - 264}" y="${y}" font-size="18" fill="#111827">${formulaText(series.name)}</text></g>`;
  }).join("");
}

function renderBarLayer(spec: PlotSpec, plotX: number, plotY: number, plotWidth: number, plotHeight: number): string {
  if (!spec.barMode) return "";
  const count = spec.series[0]?.points.length || 0;
  if (!count) return "";
  const slotWidth = plotWidth / count;
  const barWidth = Math.max(12, slotWidth * 0.64);
  const zeroY = mapY(0, spec.yMin, spec.yMax, plotY, plotHeight);
  return spec.series[0].points.map((point, index) => {
    const centerX = mapX(point.x, spec.xMin, spec.xMax, plotX, plotWidth);
    const y = mapY(point.y, spec.yMin, spec.yMax, plotY, plotHeight);
    const top = Math.min(y, zeroY);
    const height = Math.max(1, Math.abs(zeroY - y));
    const label = formulaText(spec.categories?.[index] || String(index + 1));
    return `<g><rect x="${(centerX - barWidth / 2).toFixed(2)}" y="${top.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${height.toFixed(2)}" fill="${spec.series[0].color}" opacity="0.88" rx="6"/><text x="${centerX.toFixed(2)}" y="${plotY + plotHeight + 34}" font-size="16" text-anchor="middle" fill="#374151">${label}</text></g>`;
  }).join("");
}

function firstSeriesAreaPath(spec: PlotSpec, xMin: number, xMax: number, plotX: number, plotY: number, plotWidth: number, plotHeight: number) {
  const points = spec.series[0]?.points.filter((point) => point.x >= xMin && point.x <= xMax) || [];
  if (points.length < 2) return "";
  const zeroY = mapY(0, spec.yMin, spec.yMax, plotY, plotHeight);
  const start = points[0];
  const end = points[points.length - 1];
  const top = points.map((point, index) => {
    const x = mapX(point.x, spec.xMin, spec.xMax, plotX, plotWidth);
    const y = mapY(point.y, spec.yMin, spec.yMax, plotY, plotHeight);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  const endX = mapX(end.x, spec.xMin, spec.xMax, plotX, plotWidth);
  const startX = mapX(start.x, spec.xMin, spec.xMax, plotX, plotWidth);
  return `${top} L${endX.toFixed(2)},${zeroY.toFixed(2)} L${startX.toFixed(2)},${zeroY.toFixed(2)} Z`;
}

function renderAnnotations(spec: PlotSpec, plotX: number, plotY: number, plotWidth: number, plotHeight: number): string {
  const annotations = spec.annotations || [];
  const areaLayer = annotations.filter((item): item is Extract<PlotAnnotation, { kind: "area" }> => item.kind === "area").map((item) => {
    const path = firstSeriesAreaPath(spec, item.x_min, item.x_max, plotX, plotY, plotWidth, plotHeight);
    if (!path) return "";
    const labelX = mapX((item.x_min + item.x_max) / 2, spec.xMin, spec.xMax, plotX, plotWidth);
    const labelY = plotY + 28;
    return `<g><path d="${path}" fill="${item.color}" opacity="${item.opacity}"/><text x="${labelX.toFixed(2)}" y="${labelY}" font-size="17" text-anchor="middle" fill="${item.color}" font-weight="600">${formulaText(item.label)}</text></g>`;
  }).join("");
  const lineLayer = annotations.filter((item): item is Extract<PlotAnnotation, { kind: "vertical_line" }> => item.kind === "vertical_line").map((item) => {
    const x = mapX(item.x, spec.xMin, spec.xMax, plotX, plotWidth);
    return `<g><line x1="${x.toFixed(2)}" y1="${plotY}" x2="${x.toFixed(2)}" y2="${plotY + plotHeight}" stroke="${item.color}" stroke-width="2.5" stroke-dasharray="8 7"/><text x="${(x + 8).toFixed(2)}" y="${plotY + 24}" font-size="17" fill="${item.color}" font-weight="600">${formulaText(item.label)}</text></g>`;
  }).join("");
  const pointLayer = annotations.filter((item): item is Extract<PlotAnnotation, { kind: "point" }> => item.kind === "point").map((item) => {
    const x = mapX(item.x, spec.xMin, spec.xMax, plotX, plotWidth);
    const y = mapY(item.y, spec.yMin, spec.yMax, plotY, plotHeight);
    return `<g><circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="6" fill="${item.color}" stroke="#fff" stroke-width="2"/><text x="${(x + 10).toFixed(2)}" y="${(y - 10).toFixed(2)}" font-size="17" fill="${item.color}" font-weight="600">${formulaText(item.label)}</text></g>`;
  }).join("");
  const labelLayer = annotations.filter((item): item is Extract<PlotAnnotation, { kind: "label" }> => item.kind === "label").map((item) => {
    const x = mapX(item.x, spec.xMin, spec.xMax, plotX, plotWidth);
    const y = mapY(item.y, spec.yMin, spec.yMax, plotY, plotHeight);
    return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="17" fill="${item.color}" font-weight="600">${formulaText(item.text)}</text>`;
  }).join("");
  return `${areaLayer}${lineLayer}${pointLayer}${labelLayer}`;
}

export function renderPlotSvg(spec: PlotSpec): string {
  const width = DEFAULT_WIDTH;
  const height = DEFAULT_HEIGHT;
  const plotX = 110;
  const plotY = 110;
  const plotWidth = width - 230;
  const plotHeight = height - 220;
  const gridLines = 5;
  const xTicks = Array.from({ length: gridLines + 1 }, (_, i) => spec.xMin + ((spec.xMax - spec.xMin) / gridLines) * i);
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => spec.yMin + ((spec.yMax - spec.yMin) / gridLines) * i);

  const grid = spec.grid ? [
    ...xTicks.map((tick) => {
      const x = mapX(tick, spec.xMin, spec.xMax, plotX, plotWidth);
      return `<line x1="${x}" y1="${plotY}" x2="${x}" y2="${plotY + plotHeight}" stroke="${DEFAULT_GRID}" stroke-width="1" opacity="0.6"/>`;
    }),
    ...yTicks.map((tick) => {
      const y = mapY(tick, spec.yMin, spec.yMax, plotY, plotHeight);
      return `<line x1="${plotX}" y1="${y}" x2="${plotX + plotWidth}" y2="${y}" stroke="${DEFAULT_GRID}" stroke-width="1" opacity="0.6"/>`;
    })
  ].join("") : "";

  const tickLabels = spec.barMode ? [
    ...yTicks.map((tick) => {
      const y = mapY(tick, spec.yMin, spec.yMax, plotY, plotHeight);
      return `<text x="${plotX - 14}" y="${y + 6}" font-size="16" text-anchor="end" fill="#374151">${tick.toFixed(2)}</text>`;
    })
  ].join("") : [
    ...xTicks.map((tick) => {
      const x = mapX(tick, spec.xMin, spec.xMax, plotX, plotWidth);
      return `<text x="${x}" y="${plotY + plotHeight + 34}" font-size="16" text-anchor="middle" fill="#374151">${tick.toFixed(2)}</text>`;
    }),
    ...yTicks.map((tick) => {
      const y = mapY(tick, spec.yMin, spec.yMax, plotY, plotHeight);
      return `<text x="${plotX - 14}" y="${y + 6}" font-size="16" text-anchor="end" fill="#374151">${tick.toFixed(2)}</text>`;
    })
  ].join("");

  const seriesSvg = spec.barMode ? "" : spec.series.map((series) => {
    const path = makePath(series.points, spec, plotX, plotY, plotWidth, plotHeight);
    const circles = series.type === "line" ? "" : series.points.map((point) => {
      const cx = mapX(point.x, spec.xMin, spec.xMax, plotX, plotWidth);
      const cy = mapY(point.y, spec.yMin, spec.yMax, plotY, plotHeight);
      return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="4.5" fill="${series.color}" />`;
    }).join("");
    const line = series.type === "scatter" || !path ? "" : `<path d="${path}" fill="none" stroke="${series.color}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    return `<g>${line}${circles}</g>`;
  }).join("");

  const barLayer = renderBarLayer(spec, plotX, plotY, plotWidth, plotHeight);
  const annotationLayer = renderAnnotations(spec, plotX, plotY, plotWidth, plotHeight);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    text { font-family: ${DEFAULT_FONT_FAMILY}; }
  </style>
  <rect width="100%" height="100%" fill="${DEFAULT_BG}" />
  <text x="${width / 2}" y="54" text-anchor="middle" font-size="${DEFAULT_FONT_SIZE + 10}" font-weight="700" fill="#111827">${formulaText(spec.title)}</text>
  <rect x="${plotX}" y="${plotY}" width="${plotWidth}" height="${plotHeight}" fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"/>
  ${grid}
  <line x1="${plotX}" y1="${plotY + plotHeight}" x2="${plotX + plotWidth}" y2="${plotY + plotHeight}" stroke="${DEFAULT_AXIS}" stroke-width="2"/>
  <line x1="${plotX}" y1="${plotY}" x2="${plotX}" y2="${plotY + plotHeight}" stroke="${DEFAULT_AXIS}" stroke-width="2"/>
  ${tickLabels}
  ${barLayer}
  ${annotationLayer}
  ${seriesSvg}
  ${renderLegend(spec, width)}
  <text x="${width / 2}" y="${height - 34}" text-anchor="middle" font-size="20" fill="#111827">${formulaText(spec.xlabel)}</text>
  <text x="30" y="${height / 2}" text-anchor="middle" font-size="20" fill="#111827" transform="rotate(-90 30 ${height / 2})">${formulaText(spec.ylabel)}</text>
</svg>`;
}

function renderHistogramBars(spec: PlotSpec, plotX: number, plotY: number, plotWidth: number, plotHeight: number): string {
  const hist = spec.histogram;
  if (!hist) return "";
  const count = hist.bins.length;
  if (!count) return "";
  const slotWidth = plotWidth / count;
  const barWidth = Math.max(12, slotWidth * 0.82);
  return hist.bins.map((bin, index) => {
    const centerX = mapX(index, spec.xMin, spec.xMax, plotX, plotWidth);
    const y = mapY(bin.count, spec.yMin, spec.yMax, plotY, plotHeight);
    const baseY = mapY(0, spec.yMin, spec.yMax, plotY, plotHeight);
    const top = Math.min(y, baseY);
    const height = Math.max(1, Math.abs(baseY - y));
    const label = formulaText(bin.label);
    return `<g><rect x="${(centerX - barWidth / 2).toFixed(2)}" y="${top.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${height.toFixed(2)}" fill="${hist.color}" opacity="0.85" rx="4"/><text x="${centerX.toFixed(2)}" y="${plotY + plotHeight + 22}" font-size="11" text-anchor="middle" fill="#374151" transform="rotate(-35 ${centerX.toFixed(2)} ${plotY + plotHeight + 22})">${label}</text><text x="${centerX.toFixed(2)}" y="${top - 6}" font-size="13" text-anchor="middle" fill="#111827" font-weight="600">${bin.count}</text></g>`;
  }).join("");
}

function renderBoxPlotSvg(spec: PlotSpec, plotX: number, plotY: number, plotWidth: number, plotHeight: number): string {
  const bp = spec.boxPlot;
  if (!bp) return "";
  const gridLines = 5;
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => spec.yMin + ((spec.yMax - spec.yMin) / gridLines) * i);
  const gridParts = spec.grid ? yTicks.map((tick) => {
    const y = mapY(tick, spec.yMin, spec.yMax, plotY, plotHeight);
    return `<line x1="${plotX}" y1="${y}" x2="${plotX + plotWidth}" y2="${y}" stroke="${DEFAULT_GRID}" stroke-width="1" opacity="0.6"/>`;
  }).join("") : "";
  const tickLabels = yTicks.map((tick) => {
    const y = mapY(tick, spec.yMin, spec.yMax, plotY, plotHeight);
    return `<text x="${plotX - 14}" y="${y + 6}" font-size="16" text-anchor="end" fill="#374151">${tick.toFixed(2)}</text>`;
  }).join("");
  const groupWidth = plotWidth / bp.groups.length;
  const boxWidth = Math.min(80, groupWidth * 0.6);
  const boxes = bp.groups.map((group, index) => {
    const cx = plotX + (index + 0.5) * groupWidth;
    const halfBox = boxWidth / 2;
    const yMedian = mapY(group.median, spec.yMin, spec.yMax, plotY, plotHeight);
    const yQ1 = mapY(group.q1, spec.yMin, spec.yMax, plotY, plotHeight);
    const yQ3 = mapY(group.q3, spec.yMin, spec.yMax, plotY, plotHeight);
    const yLW = mapY(group.lowerWhisker, spec.yMin, spec.yMax, plotY, plotHeight);
    const yUW = mapY(group.upperWhisker, spec.yMin, spec.yMax, plotY, plotHeight);
    const parts: string[] = [];
    parts.push(`<line x1="${cx}" y1="${yLW}" x2="${cx}" y2="${yQ1}" stroke="${group.color}" stroke-width="2"/>`);
    parts.push(`<line x1="${cx}" y1="${yQ3}" x2="${cx}" y2="${yUW}" stroke="${group.color}" stroke-width="2"/>`);
    parts.push(`<line x1="${cx - halfBox * 0.5}" y1="${yLW}" x2="${cx + halfBox * 0.5}" y2="${yLW}" stroke="${group.color}" stroke-width="2"/>`);
    parts.push(`<line x1="${cx - halfBox * 0.5}" y1="${yUW}" x2="${cx + halfBox * 0.5}" y2="${yUW}" stroke="${group.color}" stroke-width="2"/>`);
    parts.push(`<rect x="${cx - halfBox}" y="${yQ3}" width="${boxWidth}" height="${Math.max(1, yQ1 - yQ3)}" fill="${group.color}" opacity="0.25" stroke="${group.color}" stroke-width="2" rx="3"/>`);
    parts.push(`<line x1="${cx - halfBox}" y1="${yMedian}" x2="${cx + halfBox}" y2="${yMedian}" stroke="${group.color}" stroke-width="3"/>`);
    group.outliers.forEach((outlier) => {
      const yO = mapY(outlier, spec.yMin, spec.yMax, plotY, plotHeight);
      parts.push(`<circle cx="${cx}" cy="${yO}" r="4" fill="none" stroke="${group.color}" stroke-width="1.5"/>`);
    });
    const catLabel = formulaText(spec.categories?.[index] || group.name);
    parts.push(`<text x="${cx}" y="${plotY + plotHeight + 34}" font-size="16" text-anchor="middle" fill="#374151">${catLabel}</text>`);
    return `<g>${parts.join("")}</g>`;
  }).join("");
  return `${gridParts}${tickLabels}${boxes}`;
}

function renderPieSvg(spec: PlotSpec): string {
  const pie = spec.pie;
  if (!pie) return "";
  const width = DEFAULT_WIDTH;
  const height = DEFAULT_HEIGHT;
  const cx = width / 2;
  const cy = height / 2 + 10;
  const radius = Math.min(width, height) * 0.32;
  const innerRadius = radius * 0.45;
  let currentAngle = -Math.PI / 2;
  const slices = pie.slices.map((slice, index) => {
    const angle = (slice.value / pie.total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;
    const midAngle = (startAngle + endAngle) / 2;
    const isLarge = angle > Math.PI ? 1 : 0;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const ix1 = cx + innerRadius * Math.cos(endAngle);
    const iy1 = cy + innerRadius * Math.sin(endAngle);
    const ix2 = cx + innerRadius * Math.cos(startAngle);
    const iy2 = cy + innerRadius * Math.sin(startAngle);
    const path = `M${x1.toFixed(2)},${y1.toFixed(2)} A${radius},${radius} 0 ${isLarge} 1 ${x2.toFixed(2)},${y2.toFixed(2)} L${ix1.toFixed(2)},${iy1.toFixed(2)} A${innerRadius},${innerRadius} 0 ${isLarge} 0 ${ix2.toFixed(2)},${iy2.toFixed(2)} Z`;
    const labelR = radius + 28;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);
    const pct = ((slice.value / pie.total) * 100).toFixed(1);
    const label = formulaText(slice.label);
    return `<g><path d="${path}" fill="${slice.color}" stroke="#ffffff" stroke-width="2.5" opacity="0.9"/><text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" font-size="15" text-anchor="middle" fill="#111827" font-weight="600">${label} (${pct}%)</text></g>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>text { font-family: ${DEFAULT_FONT_FAMILY}; }</style>
  <rect width="100%" height="100%" fill="${DEFAULT_BG}" />
  <text x="${width / 2}" y="54" text-anchor="middle" font-size="${DEFAULT_FONT_SIZE + 10}" font-weight="700" fill="#111827">${formulaText(spec.title)}</text>
  ${slices}
</svg>`;
}

export function renderSpecToSvg(spec: PlotSpec): string {
  const mode = spec.mode || (spec.barMode ? "bar" : "xy");
  if (mode === "pie") return renderPieSvg(spec);

  const width = DEFAULT_WIDTH;
  const height = DEFAULT_HEIGHT;
  const plotX = 110;
  const plotY = 110;
  const plotWidth = width - 230;
  const plotHeight = height - 220;
  const gridLines = 5;

  if (mode === "box") {
    const bpSvg = renderBoxPlotSvg(spec, plotX, plotY, plotWidth, plotHeight);
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>text { font-family: ${DEFAULT_FONT_FAMILY}; }</style>
  <rect width="100%" height="100%" fill="${DEFAULT_BG}" />
  <text x="${width / 2}" y="54" text-anchor="middle" font-size="${DEFAULT_FONT_SIZE + 10}" font-weight="700" fill="#111827">${formulaText(spec.title)}</text>
  <rect x="${plotX}" y="${plotY}" width="${plotWidth}" height="${plotHeight}" fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"/>
  <line x1="${plotX}" y1="${plotY + plotHeight}" x2="${plotX + plotWidth}" y2="${plotY + plotHeight}" stroke="${DEFAULT_AXIS}" stroke-width="2"/>
  <line x1="${plotX}" y1="${plotY}" x2="${plotX}" y2="${plotY + plotHeight}" stroke="${DEFAULT_AXIS}" stroke-width="2"/>
  ${bpSvg}
  <text x="${width / 2}" y="${height - 34}" text-anchor="middle" font-size="20" fill="#111827">${formulaText(spec.xlabel)}</text>
  <text x="30" y="${height / 2}" text-anchor="middle" font-size="20" fill="#111827" transform="rotate(-90 30 ${height / 2})">${formulaText(spec.ylabel)}</text>
</svg>`;
  }

  if (mode === "hist") {
    const xTicks = Array.from({ length: gridLines + 1 }, (_, i) => spec.xMin + ((spec.xMax - spec.xMin) / gridLines) * i);
    const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => spec.yMin + ((spec.yMax - spec.yMin) / gridLines) * i);
    const grid = spec.grid ? [
      ...yTicks.map((tick) => {
        const y = mapY(tick, spec.yMin, spec.yMax, plotY, plotHeight);
        return `<line x1="${plotX}" y1="${y}" x2="${plotX + plotWidth}" y2="${y}" stroke="${DEFAULT_GRID}" stroke-width="1" opacity="0.6"/>`;
      })
    ].join("") : "";
    const yTickLabels = yTicks.map((tick) => {
      const y = mapY(tick, spec.yMin, spec.yMax, plotY, plotHeight);
      return `<text x="${plotX - 14}" y="${y + 6}" font-size="16" text-anchor="end" fill="#374151">${tick.toFixed(0)}</text>`;
    }).join("");
    const histBars = renderHistogramBars(spec, plotX, plotY, plotWidth, plotHeight);
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>text { font-family: ${DEFAULT_FONT_FAMILY}; }</style>
  <rect width="100%" height="100%" fill="${DEFAULT_BG}" />
  <text x="${width / 2}" y="54" text-anchor="middle" font-size="${DEFAULT_FONT_SIZE + 10}" font-weight="700" fill="#111827">${formulaText(spec.title)}</text>
  <rect x="${plotX}" y="${plotY}" width="${plotWidth}" height="${plotHeight}" fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"/>
  ${grid}
  <line x1="${plotX}" y1="${plotY + plotHeight}" x2="${plotX + plotWidth}" y2="${plotY + plotHeight}" stroke="${DEFAULT_AXIS}" stroke-width="2"/>
  <line x1="${plotX}" y1="${plotY}" x2="${plotX}" y2="${plotY + plotHeight}" stroke="${DEFAULT_AXIS}" stroke-width="2"/>
  ${yTickLabels}
  ${histBars}
  <text x="${width / 2}" y="${height - 34}" text-anchor="middle" font-size="20" fill="#111827">${formulaText(spec.xlabel)}</text>
  <text x="30" y="${height / 2}" text-anchor="middle" font-size="20" fill="#111827" transform="rotate(-90 30 ${height / 2})">${formulaText(spec.ylabel)}</text>
</svg>`;
  }

  return renderPlotSvg(spec);
}

export async function renderPngBase64(svg: string, env: Env): Promise<string> {
  await ensureResvgReady();
  const fontBuffers: Uint8Array[] = [new Uint8Array(pingFangSubset)];
  const renderer = new Resvg(svg, {
    fitTo: { mode: "original" },
    background: DEFAULT_BG,
    font: {
      fontBuffers,
      defaultFontFamily: "PingFang SC",
      sansSerifFamily: "PingFang SC",
      defaultFontSize: DEFAULT_FONT_SIZE,
    },
  });
  const image = renderer.render();
  const png = image.asPng();
  return toBase64(png);
}

export async function renderPngResponse(svg: string, env: Env): Promise<Response> {
  await ensureResvgReady();
  const fontBuffers: Uint8Array[] = [new Uint8Array(pingFangSubset)];
  const renderer = new Resvg(svg, {
    fitTo: { mode: "original" },
    background: DEFAULT_BG,
    font: {
      fontBuffers,
      defaultFontFamily: "PingFang SC",
      sansSerifFamily: "PingFang SC",
      defaultFontSize: DEFAULT_FONT_SIZE,
    },
  });
  const image = renderer.render();
  const png = image.asPng();
  const body = new Uint8Array(png);
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}
