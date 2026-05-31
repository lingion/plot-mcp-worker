import { Resvg, initWasm } from "@resvg/resvg-wasm";
import wasmModule from "@resvg/resvg-wasm/index_bg.wasm";
import pingFangSubset from "./PingFangSC-Regular.subset.ttf";
import arialSans from "./ArialSans";
import { normalizeErrorAt, MultiPlotCell, MultiPlotResult } from "./plot";
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

function formatTick(v: number, scale?: string): string {
  if (scale === "log") {
    const p = Math.log10(Math.abs(v));
    if (Math.abs(p - Math.round(p)) < 0.01) {
      const exp = Math.round(p);
      if (exp === 0) return "1";
      if (exp === 1) return "10";
      return `10^${exp}`;
    }
    return v.toFixed(v >= 100 ? 0 : 1);
  }
  return v.toFixed(2);
}

/** Generate nice tick positions at π fractions within [xMin, xMax] */
function generatePiTicks(xMin: number, xMax: number, maxTicks: number): number[] {
  const pi = Math.PI;
  const range = xMax - xMin;
  // Try common denominators: 1,2,3,4,6
  // Pick the one that gives closest to maxTicks ticks
  const stepOptions = [pi, pi / 2, pi / 3, pi / 4, pi / 6];
  let bestStep = pi / 2;
  let bestDiff = Infinity;
  for (const step of stepOptions) {
    const count = Math.floor(range / step) + 1;
    const diff = Math.abs(count - maxTicks);
    if (diff < bestDiff) { bestStep = step; bestDiff = diff; }
  }
  // Snap start to nearest step multiple
  const start = Math.ceil(xMin / bestStep) * bestStep;
  const ticks: number[] = [];
  for (let v = start; v <= xMax + bestStep * 0.01; v += bestStep) {
    ticks.push(Math.round(v / bestStep) * bestStep); // snap to avoid float drift
  }
  return ticks;
}

/** Format a tick value as a π fraction (e.g. "π/2", "3π/4", "-π") */
function formatPiTick(v: number): string {
  if (Math.abs(v) < 0.01) return "0";
  const r = v / Math.PI;
  const denominators = [1, 2, 3, 4, 6, 8];
  let bestNum = 0, bestDen = 1, bestErr = Infinity;
  for (const d of denominators) {
    const n = Math.round(r * d);
    const err = Math.abs(r - n / d);
    if (err < bestErr) { bestNum = n; bestDen = d; bestErr = err; }
  }
  if (bestErr > 0.05) return v.toFixed(2); // fallback for non-π values
  const sign = bestNum < 0 ? "-" : "";
  const absNum = Math.abs(bestNum);
  if (bestDen === 1) {
    return absNum === 1 ? `${sign}π` : `${sign}${absNum}π`;
  }
  if (absNum === 1) return `${sign}π/${bestDen}`;
  return `${sign}${absNum}π/${bestDen}`;
}

function logTickSvg(v: number, x: number, y: number, anchor: string): string {
  const p = Math.log10(Math.abs(v));
  if (Math.abs(p - Math.round(p)) < 0.01) {
    const exp = Math.round(p);
    if (exp === 0) return `<text x="${x}" y="${y}" font-size="13" text-anchor="${anchor}" fill="#94a3b8">1</text>`;
    if (exp === 1) return `<text x="${x}" y="${y}" font-size="13" text-anchor="${anchor}" fill="#94a3b8">10</text>`;
    return `<text x="${x}" y="${y}" font-size="13" text-anchor="${anchor}" fill="#94a3b8">10<tspan baseline-shift="super" font-size="11">${exp}</tspan></text>`;
  }
  return `<text x="${x}" y="${y}" font-size="13" text-anchor="${anchor}" fill="#94a3b8">${v.toFixed(v >= 100 ? 0 : 1)}</text>`;
}

function mapYLog(y: number, yMin: number, yMax: number, plotY: number, plotHeight: number): number {
  if (y <= 0) y = 1e-10;
  if (yMin <= 0) yMin = 1e-10;
  if (yMax <= 0) yMax = 1e-10;
  const logY = Math.log10(y);
  const logMin = Math.log10(yMin);
  const logMax = Math.log10(yMax);
  if (logMax === logMin) return plotY + plotHeight / 2;
  const raw = plotY + plotHeight - ((logY - logMin) / (logMax - logMin)) * plotHeight;
  return Math.max(plotY, Math.min(plotY + plotHeight, raw));
}

function mapY(y: number, yMin: number, yMax: number, plotY: number, plotHeight: number, scale?: string): number {
  if (scale === "log") return mapYLog(y, yMin, yMax, plotY, plotHeight);
  const raw = plotY + plotHeight - ((y - yMin) / (yMax - yMin)) * plotHeight;
  return Math.max(plotY, Math.min(plotY + plotHeight, Number.isFinite(raw) ? raw : plotY + plotHeight));
}

function clampY(y: number, plotY: number, plotHeight: number): number {
  return Math.max(plotY, Math.min(plotY + plotHeight, y));
}

// Bind mapY to a spec's y-scale for cleaner call sites
function bindMapY(spec: PlotSpec, plotY: number, plotHeight: number): (y: number) => number {
  const scale = spec.yScale;
  const yMin = spec.yMin;
  const yMax = spec.yMax;
  if (scale === "log") {
    return (y) => mapYLog(y, yMin, yMax, plotY, plotHeight);
  }
  return (y) => mapY(y, yMin, yMax, plotY, plotHeight);
}

function toScriptText(text: string, map: Record<string, string>): string {
  return text.split("").map((char) => map[char] || char).join("");
}

function formatFormulaText(input: string): string {
  const normalized = String(input || "").trim();
  if (!normalized) return "";
  return normalized
    .replace(/([A-Za-zα-ωΑ-Ω])_\{([^{}]+)\}/g, (_match, head, sub) => `${head}_(${sub})`)
    .replace(/([A-Za-zα-ωΑ-Ω])_([A-Za-z0-9()+-]+)/g, (_match, head, sub) => `${head}_${sub}`)
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
  const yRange = spec.yMax - spec.yMin || 1;
  const JUMP_THRESHOLD = yRange * 0.5;
  const parts: string[] = [];
  let lastValidIdx = -1;
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const x = mapX(point.x, spec.xMin, spec.xMax, plotX, plotWidth);
    const yRaw = point.y;
    if (spec.yScale === "log" && yRaw <= 0) { lastValidIdx = -1; continue; }
    const y = mapY(yRaw, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
    if (!Number.isFinite(x) || !Number.isFinite(y)) { lastValidIdx = -1; continue; }
    let discontinuity = false;
    if (lastValidIdx >= 0) {
      const prevY = points[lastValidIdx].y;
      const dy = Math.abs(yRaw - prevY);
      // Large absolute jump
      if (dy > JUMP_THRESHOLD) discontinuity = true;
      // Sign flip + large jump (catches asymptotes like tan, 1/x where Δy < threshold but behavior is discontinuous)
      if (!discontinuity && dy > yRange * 0.2 && (yRaw * prevY < 0)) discontinuity = true;
    }
    if (discontinuity) {
      parts.push(`M${x.toFixed(2)},${y.toFixed(2)}`);
    } else {
      parts.push(`${lastValidIdx < 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
    }
    lastValidIdx = i;
  }
  return parts.join(" ");
}

function plainLegendLabel(text: string): string {
  // Legend labels: NO math formatting, NO tspan, NO superscript parsing.
  // Just escape XML special chars and output as plain text.
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderLegend(spec: PlotSpec, width: number): string {
  const unique = "ZZZZ_UNIQUE_SENTINEL_2043";
  const sentinel = `<!-- LEGEND_SENTINEL:${unique} -->${spec.series.map((series, index) => {
    const y = 90 + index * 28;
    const rawLabel = series.name ?? `Series ${index + 1}`;
    const plain = plainLegendLabel(rawLabel);
    return `<g><rect x="${width - 260}" y="${y - 8}" width="14" height="4" fill="${series.color}" rx="2"/><text x="${width - 238}" y="${y}" font-size="14" fill="#cbd5e1">${plain}</text></g>`;
  }).join("")}`;
  return sentinel;
}

function renderBarLayer(spec: PlotSpec, plotX: number, plotY: number, plotWidth: number, plotHeight: number): string {
  if (!spec.barMode && spec.mode !== "bar") return "";

  // Bar baseline: in log scale, use domainMin (0 is invalid); in linear, use 0
  const baselineValue = spec.yScale === "log" ? spec.yMin : 0;
  const zeroY = mapY(baselineValue, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);

  // Multi-series bar: grouped or stacked
  const barSeries = spec.series.filter((s) => s.type === "bar" || spec.mode === "bar");
  if (barSeries.length === 0) return "";

  // Single series bar (original behavior)
  if (barSeries.length === 1 && !spec.barStyle) {
    const count = barSeries[0].points.length;
    if (!count) return "";
    const slotWidth = plotWidth / count;
    const barWidth = Math.max(12, slotWidth * 0.64);
    return barSeries[0].points.map((point, index) => {
      const centerX = mapX(point.x, spec.xMin, spec.xMax, plotX, plotWidth);
      const y = mapY(point.y, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
      const top = Math.min(y, zeroY);
      const height = Math.max(1, Math.abs(zeroY - y));
      const label = formulaText(spec.categories?.[index] || String(index + 1));
      return `<g><rect x="${(centerX - barWidth / 2).toFixed(2)}" y="${top.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${height.toFixed(2)}" fill="${barSeries[0].color}" rx="3"/><text x="${centerX.toFixed(2)}" y="${plotY + plotHeight + 34}" font-size="13" text-anchor="middle" fill="#94a3b8">${label}</text></g>`;
    }).join("");
  }

  // Multi-series: grouped or stacked — band-scale layout
  const numCategories = barSeries[0].points.length;
  const numSeries = barSeries.length;
  const bandWidth = plotWidth / numCategories; // total width per category slot
  const innerPadRatio = 0.25; // 25% of band is gap between categories
  const groupWidth = bandWidth * (1 - innerPadRatio);

  if (spec.barStyle === "stacked") {
    // Stacked bars: single bar per category, layers on top
    const barWidth = Math.max(12, groupWidth);
    const parts: string[] = [];

    for (let catIdx = 0; catIdx < numCategories; catIdx++) {
      const bandStart = plotX + catIdx * bandWidth;
      const centerX = bandStart + bandWidth / 2;
      let cumulativeY = 0;
      const label = formulaText(spec.categories?.[catIdx] || String(catIdx + 1));

      for (let sIdx = 0; sIdx < numSeries; sIdx++) {
        const val = barSeries[sIdx].points[catIdx]?.y || 0;
        const yBot = mapY(cumulativeY, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
        cumulativeY += val;
        const yTop = mapY(cumulativeY, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
        const top = Math.min(yBot, yTop);
        const h = Math.max(1, Math.abs(yBot - yTop));
        const rx = sIdx === numSeries - 1 ? 6 : 0;
        parts.push(`<rect x="${(centerX - barWidth / 2).toFixed(2)}" y="${top.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${h.toFixed(2)}" fill="${barSeries[sIdx].color}" rx="3"/>`);
      }
      parts.push(`<text x="${centerX.toFixed(2)}" y="${plotY + plotHeight + 34}" font-size="13" text-anchor="middle" fill="#94a3b8">${label}</text>`);
    }
    return parts.join("");
  }

  // Grouped bars: multiple bars per category with intra-group gap
  const intraGap = 2;
  const barWidth = Math.max(8, (groupWidth - intraGap * (numSeries - 1)) / numSeries);
  const capW = Math.max(6, Math.min(14, barWidth * 0.45));
  const parts: string[] = [];

  for (let catIdx = 0; catIdx < numCategories; catIdx++) {
    const bandStart = plotX + catIdx * bandWidth;
    const centerX = bandStart + bandWidth / 2;
    const totalBarsWidth = barWidth * numSeries + intraGap * (numSeries - 1);
    const groupStart = centerX - totalBarsWidth / 2;
    const label = formulaText(spec.categories?.[catIdx] || String(catIdx + 1));

    for (let sIdx = 0; sIdx < numSeries; sIdx++) {
      const s = barSeries[sIdx];
      const val = s.points[catIdx]?.y || 0;
      const y = mapY(val, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
      const top = Math.min(y, zeroY);
      const h = Math.max(1, Math.abs(zeroY - y));
      const barX = groupStart + sIdx * (barWidth + intraGap);
      const cx = barX + barWidth / 2; // each bar's center
      parts.push(`<rect x="${barX.toFixed(2)}" y="${top.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${h.toFixed(2)}" fill="${s.color}" rx="3"/>`);

      // Error bar for this bar — centered on bar center, not category center
      const err = s.errorExt !== undefined
        ? normalizeErrorAt(s.errorExt, catIdx)
        : (s.error ? normalizeErrorAt(s.error, catIdx) : undefined);
      if (err) {
        const { plus, minus } = err;
        if (!(spec.yScale === "log" && val - minus <= 0)) {
          const cyTop = mapY(val + plus, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
          const cyBot = mapY(val - minus, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
          parts.push(`<line x1="${cx.toFixed(2)}" y1="${cyTop.toFixed(2)}" x2="${cx.toFixed(2)}" y2="${cyBot.toFixed(2)}" stroke="${s.color}" stroke-width="1.5"/>`);
          parts.push(`<line x1="${(cx - capW).toFixed(2)}" y1="${cyTop.toFixed(2)}" x2="${(cx + capW).toFixed(2)}" y2="${cyTop.toFixed(2)}" stroke="${s.color}" stroke-width="1.5"/>`);
          parts.push(`<line x1="${(cx - capW).toFixed(2)}" y1="${cyBot.toFixed(2)}" x2="${(cx + capW).toFixed(2)}" y2="${cyBot.toFixed(2)}" stroke="${s.color}" stroke-width="1.5"/>`);
        }
      }
    }
    parts.push(`<text x="${centerX.toFixed(2)}" y="${plotY + plotHeight + 34}" font-size="13" text-anchor="middle" fill="#94a3b8">${label}</text>`);
  }
  return parts.join("");
}

function firstSeriesAreaPath(spec: PlotSpec, xMin: number, xMax: number, plotX: number, plotY: number, plotWidth: number, plotHeight: number) {
  const points = spec.series[0]?.points.filter((point) => point.x >= xMin && point.x <= xMax) || [];
  if (points.length < 2) return "";
  const zeroY = mapY(0, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
  const start = points[0];
  const end = points[points.length - 1];
  const top = points.map((point, index) => {
    const x = mapX(point.x, spec.xMin, spec.xMax, plotX, plotWidth);
    const y = mapY(point.y, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
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
    return `<g><path d="${path}" fill="${item.color}" opacity="${item.opacity}"/><text x="${labelX.toFixed(2)}" y="${labelY}" font-size="17" text-anchor="middle" fill="#e5e7eb" font-weight="600">${formulaText(item.label)}</text></g>`;
  }).join("");
  const lineLayer = annotations.filter((item): item is Extract<PlotAnnotation, { kind: "vertical_line" }> => item.kind === "vertical_line").map((item) => {
    const x = mapX(item.x, spec.xMin, spec.xMax, plotX, plotWidth);
    return `<g><line x1="${x.toFixed(2)}" y1="${plotY}" x2="${x.toFixed(2)}" y2="${plotY + plotHeight}" stroke="${item.color}" stroke-width="2.5" stroke-dasharray="8 7"/><text x="${(x + 8).toFixed(2)}" y="${plotY + 24}" font-size="14" fill="#e5e7eb" font-weight="600">${formulaText(item.label)}</text></g>`;
  }).join("");
  const pointLayer = annotations.filter((item): item is Extract<PlotAnnotation, { kind: "point" }> => item.kind === "point").map((item) => {
    const x = mapX(item.x, spec.xMin, spec.xMax, plotX, plotWidth);
    const y = mapY(item.y, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
    return `<g><circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="6" fill="${item.color}" stroke="#0f172a" stroke-opacity="0.6" stroke-width="2"/><text x="${(x + 10).toFixed(2)}" y="${(y - 10).toFixed(2)}" font-size="14" fill="#e5e7eb" font-weight="600">${formulaText(item.label)}</text></g>`;
  }).join("");
  const labelLayer = annotations.filter((item): item is Extract<PlotAnnotation, { kind: "label" }> => item.kind === "label").map((item) => {
    const x = mapX(item.x, spec.xMin, spec.xMax, plotX, plotWidth);
    const y = mapY(item.y, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
    return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="14" fill="${item.color}" font-weight="600">${formulaText(item.text)}</text>`;
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

  // Equal aspect: expand domain so pxPerX === pxPerY (never crop data)
  if (spec.aspect === "equal") {
    const xRange = (spec.xMax - spec.xMin) || 1;
    const yRange = (spec.yMax - spec.yMin) || 1;
    const pxPerX = plotWidth / xRange;
    const pxPerY = plotHeight / yRange;
    if (pxPerX > pxPerY) {
      const targetXRange = plotWidth / pxPerY;
      const xMid = (spec.xMin + spec.xMax) / 2;
      spec = { ...spec, xMin: xMid - targetXRange / 2, xMax: xMid + targetXRange / 2 };
    } else if (pxPerY > pxPerX) {
      const targetYRange = plotHeight / pxPerX;
      const yMid = (spec.yMin + spec.yMax) / 2;
      spec = { ...spec, yMin: yMid - targetYRange / 2, yMax: yMid + targetYRange / 2 };
    }
  }
  const gridLines = 5;
  // Pi-aware tick generation
  let xTicks: number[];
  if (spec.xMode === "pi") {
    xTicks = generatePiTicks(spec.xMin, spec.xMax, gridLines);
  } else {
    xTicks = Array.from({ length: gridLines + 1 }, (_, i) => spec.xMin + ((spec.xMax - spec.xMin) / gridLines) * i);
  }
  // Generate y-axis ticks — linear or log scale
  let yTicks: number[];
  if (spec.yScale === "log" && spec.yMin > 0 && spec.yMax > 0) {
    const logMin = Math.floor(Math.log10(spec.yMin));
    const logMax = Math.ceil(Math.log10(spec.yMax));
    yTicks = [];
    for (let p = logMin; p <= logMax; p++) yTicks.push(Math.pow(10, p));
  } else {
    yTicks = Array.from({ length: gridLines + 1 }, (_, i) => spec.yMin + ((spec.yMax - spec.yMin) / gridLines) * i);
  }

  const grid = spec.grid ? [
    ...xTicks.map((tick) => {
      const x = mapX(tick, spec.xMin, spec.xMax, plotX, plotWidth);
      return `<line x1="${x}" y1="${plotY}" x2="${x}" y2="${plotY + plotHeight}" stroke="${DEFAULT_GRID}" stroke-width="1" opacity="0.6"/>`;
    }),
    ...yTicks.map((tick) => {
      const y = mapY(tick, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
      return `<line x1="${plotX}" y1="${y}" x2="${plotX + plotWidth}" y2="${y}" stroke="${DEFAULT_GRID}" stroke-width="1" opacity="0.6"/>`;
    })
  ].join("") : "";

  const tickLabels = (spec.barMode || spec.mode === "bar") ? [
    ...yTicks.map((tick) => {
      const y = mapY(tick, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
      return spec.yScale === "log" ? logTickSvg(tick, plotX - 14, y + 6, "end") : `<text x="${plotX - 14}" y="${y + 6}" font-size="13" text-anchor="end" fill="#94a3b8">${formatTick(tick, spec.yScale)}</text>`;
    })
  ].join("") : [
    ...xTicks.map((tick) => {
      const x = mapX(tick, spec.xMin, spec.xMax, plotX, plotWidth);
      return `<text x="${x}" y="${plotY + plotHeight + 34}" font-size="13" text-anchor="middle" fill="#94a3b8">${spec.xMode === "pi" ? formatPiTick(tick) : formatTick(tick, spec.xScale)}</text>`;
    }),
    ...yTicks.map((tick) => {
      const y = mapY(tick, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
      return spec.yScale === "log" ? logTickSvg(tick, plotX - 14, y + 6, "end") : `<text x="${plotX - 14}" y="${y + 6}" font-size="13" text-anchor="end" fill="#94a3b8">${formatTick(tick, spec.yScale)}</text>`;
    })
  ].join("");

  const seriesSvg = (spec.barMode || spec.mode === "bar") ? "" : spec.series.map((series) => {
    const path = makePath(series.points, spec, plotX, plotY, plotWidth, plotHeight);
    const circles = series.type === "line" ? "" : series.points.map((point) => {
      const cx = mapX(point.x, spec.xMin, spec.xMax, plotX, plotWidth);
      const cy = mapY(point.y, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
      return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="4.5" fill="${series.color}" stroke="#0f172a" stroke-opacity="0.8" stroke-width="1.5"/>`;
    }).join("");
    const halo = series.type === "scatter" || !path ? "" : `<path d="${path}" fill="none" stroke="#0f172a" stroke-opacity="0.8" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    const line = series.type === "scatter" || !path ? "" : `<path d="${path}" fill="none" stroke="${series.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;

    // Error bars — uses normalizeErrorAt for full ErrorInput support + log skip
    let errorSvg = "";
    for (let i = 0; i < series.points.length; i++) {
      const err = series.errorExt !== undefined
        ? normalizeErrorAt(series.errorExt, i)
        : (series.error ? normalizeErrorAt(series.error, i) : undefined);
      if (!err) continue;
      const { plus, minus } = err;
      const point = series.points[i];
      const cx = mapX(point.x, spec.xMin, spec.xMax, plotX, plotWidth);
      const yVal = point.y;
      // Log skip: if lower bound <= 0, skip error bar but keep data point
      if (spec.yScale === "log" && yVal - minus <= 0) continue;
      const cyMid = mapY(yVal, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
      const cyTop = mapY(yVal + plus, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
      const cyBot = mapY(yVal - minus, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
      const capW = 10; // auto default for line/scatter
      errorSvg += `<g>
        <line x1="${cx.toFixed(2)}" y1="${cyTop.toFixed(2)}" x2="${cx.toFixed(2)}" y2="${cyBot.toFixed(2)}" stroke="${series.color}" stroke-width="1.5"/>
        <line x1="${(cx - capW).toFixed(2)}" y1="${cyTop.toFixed(2)}" x2="${(cx + capW).toFixed(2)}" y2="${cyTop.toFixed(2)}" stroke="${series.color}" stroke-width="1.5"/>
        <line x1="${(cx - capW).toFixed(2)}" y1="${cyBot.toFixed(2)}" x2="${(cx + capW).toFixed(2)}" y2="${cyBot.toFixed(2)}" stroke="${series.color}" stroke-width="1.5"/>
      </g>`;
    }

    // Bar series overlay (when mixed with line/scatter)
    let barOverlay = "";
    if (series.type === "bar") {
      const count = series.points.length;
      const slotWidth = plotWidth / Math.max(count, 1);
      const barWidth = Math.max(12, slotWidth * 0.64);
      const zeroY = mapY(0, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
      barOverlay = series.points.map((point) => {
        const cx = mapX(point.x, spec.xMin, spec.xMax, plotX, plotWidth);
        const y = mapY(point.y, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
        const top = Math.min(y, zeroY);
        const h = Math.max(1, Math.abs(zeroY - y));
        return `<rect x="${(cx - barWidth / 2).toFixed(2)}" y="${top.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${h.toFixed(2)}" fill="${series.color}" opacity="0.85" rx="3"/>`;
      }).join("");
    }

    return `<g>${barOverlay}${halo}${line}${circles}${errorSvg}</g>`;
  }).join("");

  const barLayer = renderBarLayer(spec, plotX, plotY, plotWidth, plotHeight);
  const annotationLayer = renderAnnotations(spec, plotX, plotY, plotWidth, plotHeight);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    text { font-family: ${DEFAULT_FONT_FAMILY}; }
  </style>
  <rect width="100%" height="100%" fill="transparent"/>
  <rect x="10" y="10" width="${width - 20}" height="${height - 20}" rx="12" fill="#0f172a" fill-opacity="0.92"/>
  <text x="${width / 2}" y="54" text-anchor="middle" font-size="${DEFAULT_FONT_SIZE + 10}" font-weight="700" fill="#e5e7eb">${formulaText(spec.title)}</text>
  <defs><clipPath id="plot-clip"><rect x="${plotX}" y="${plotY}" width="${plotWidth}" height="${plotHeight}"/></clipPath></defs>
  <rect x="${plotX}" y="${plotY}" width="${plotWidth}" height="${plotHeight}" fill="#e5e7eb" fill-opacity="0.75" stroke="#334155" stroke-opacity="0.5" stroke-width="1" rx="4"/>
  ${grid}
  <line x1="${plotX}" y1="${plotY + plotHeight}" x2="${plotX + plotWidth}" y2="${plotY + plotHeight}" stroke="#475569" stroke-width="1.5"/>
  <line x1="${plotX}" y1="${plotY}" x2="${plotX}" y2="${plotY + plotHeight}" stroke="#475569" stroke-width="1.5"/>
  ${tickLabels}
  <g clip-path="url(#plot-clip)">
  ${barLayer}
  ${annotationLayer}
  ${seriesSvg}
  </g>
  ${renderLegend(spec, width)}
  <text x="${width / 2}" y="${height - 34}" text-anchor="middle" font-size="15" fill="#cbd5e1">${formulaText(spec.xlabel)}</text>
  <text x="30" y="${height / 2}" text-anchor="middle" font-size="15" fill="#cbd5e1" transform="rotate(-90 30 ${height / 2})">${formulaText(spec.ylabel)}</text>
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
    const y = mapY(bin.count, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
    const baseY = mapY(0, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
    const top = Math.min(y, baseY);
    const height = Math.max(1, Math.abs(baseY - y));
    const label = formulaText(bin.label);
    return `<g><rect x="${(centerX - barWidth / 2).toFixed(2)}" y="${top.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${height.toFixed(2)}" fill="${hist.color}" opacity="0.85" rx="3"/><text x="${centerX.toFixed(2)}" y="${plotY + plotHeight + 22}" font-size="12" text-anchor="middle" fill="#94a3b8">${label}</text><text x="${centerX.toFixed(2)}" y="${top - 6}" font-size="13" text-anchor="middle" fill="#e5e7eb" font-weight="600">${bin.count}</text></g>`;
  }).join("");
}

function renderBoxPlotSvg(spec: PlotSpec, plotX: number, plotY: number, plotWidth: number, plotHeight: number): string {
  const bp = spec.boxPlot;
  if (!bp) return "";
  const gridLines = 5;
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => spec.yMin + ((spec.yMax - spec.yMin) / gridLines) * i);
  const gridParts = spec.grid ? yTicks.map((tick) => {
    const y = mapY(tick, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
    return `<line x1="${plotX}" y1="${y}" x2="${plotX + plotWidth}" y2="${y}" stroke="${DEFAULT_GRID}" stroke-width="1" opacity="0.6"/>`;
  }).join("") : "";
  const tickLabels = yTicks.map((tick) => {
    const y = mapY(tick, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
    return spec.yScale === "log" ? logTickSvg(tick, plotX - 14, y + 6, "end") : `<text x="${plotX - 14}" y="${y + 6}" font-size="13" text-anchor="end" fill="#94a3b8">${formatTick(tick, spec.yScale)}</text>`;
  }).join("");
  const groupWidth = plotWidth / bp.groups.length;
  const boxWidth = Math.min(80, groupWidth * 0.6);
  const boxes = bp.groups.map((group, index) => {
    const cx = plotX + (index + 0.5) * groupWidth;
    const halfBox = boxWidth / 2;
    const yMedian = mapY(group.median, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
    const yQ1 = mapY(group.q1, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
    const yQ3 = mapY(group.q3, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
    const yLW = mapY(group.lowerWhisker, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
    const yUW = mapY(group.upperWhisker, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
    const parts: string[] = [];
    parts.push(`<line x1="${cx}" y1="${yLW}" x2="${cx}" y2="${yQ1}" stroke="${group.color}" stroke-width="2"/>`);
    parts.push(`<line x1="${cx}" y1="${yQ3}" x2="${cx}" y2="${yUW}" stroke="${group.color}" stroke-width="2"/>`);
    parts.push(`<line x1="${cx - halfBox * 0.5}" y1="${yLW}" x2="${cx + halfBox * 0.5}" y2="${yLW}" stroke="${group.color}" stroke-width="2"/>`);
    parts.push(`<line x1="${cx - halfBox * 0.5}" y1="${yUW}" x2="${cx + halfBox * 0.5}" y2="${yUW}" stroke="${group.color}" stroke-width="2"/>`);
    parts.push(`<rect x="${cx - halfBox}" y="${yQ3}" width="${boxWidth}" height="${Math.max(1, yQ1 - yQ3)}" fill="${group.color}" opacity="0.25" stroke="${group.color}" stroke-width="2" rx="3"/>`);
    parts.push(`<line x1="${cx - halfBox}" y1="${yMedian}" x2="${cx + halfBox}" y2="${yMedian}" stroke="${group.color}" stroke-width="3"/>`);
    group.outliers.forEach((outlier) => {
      const yO = mapY(outlier, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
      parts.push(`<circle cx="${cx}" cy="${yO}" r="4" fill="none" stroke="${group.color}" stroke-width="1.5"/>`);
    });
    const catLabel = formulaText(spec.categories?.[index] || group.name);
    parts.push(`<text x="${cx}" y="${plotY + plotHeight + 34}" font-size="13" text-anchor="middle" fill="#94a3b8">${catLabel}</text>`);
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
    return `<g><path d="${path}" fill="${slice.color}" stroke="#ffffff" stroke-width="2.5" opacity="0.9"/><text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" font-size="15" text-anchor="middle" fill="#e5e7eb" font-weight="600">${label} (${pct}%)</text></g>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>text { font-family: ${DEFAULT_FONT_FAMILY}; }</style>
  <rect width="100%" height="100%" fill="transparent"/>
  <rect x="10" y="10" width="${width - 20}" height="${height - 20}" rx="12" fill="#0f172a" fill-opacity="0.92"/>
  <text x="${width / 2}" y="54" text-anchor="middle" font-size="${DEFAULT_FONT_SIZE + 10}" font-weight="700" fill="#e5e7eb">${formulaText(spec.title)}</text>
  ${slices}
</svg>`;
}

// ── Multi-plot / subplot rendering ──────────────────────────────────────────

/** Compute inner plot area within a cell */
function cellPlotRect(cellX: number, cellY: number, cellW: number, cellH: number) {
  const AXIS_H = 50;  // bottom axis
  const LABEL_W = 50; // left label
  return {
    plotX: cellX + LABEL_W,
    plotY: cellY,
    plotWidth: cellW - LABEL_W,
    plotHeight: cellH - AXIS_H,
  };
}

/** Render a single subplot cell (grid, axes, bars, series, annotations) */
function renderSubplotCell(cell: MultiPlotCell, cellIndex: number): string {
  const { x: cx, y: cy, width: cw, height: ch, spec } = cell;
  const { plotX, plotY, plotWidth, plotHeight } = cellPlotRect(cx, cy, cw, ch);
  const clipId = `clip-cell-${cellIndex}`;

  const gridLines = 5;
  const xTicks = Array.from({ length: gridLines + 1 }, (_, i) =>
    spec.xMin + ((spec.xMax - spec.xMin) / gridLines) * i);
  let yTicks: number[];
  if (spec.yScale === "log" && spec.yMin > 0 && spec.yMax > 0) {
    const logMin = Math.floor(Math.log10(spec.yMin));
    const logMax = Math.ceil(Math.log10(spec.yMax));
    yTicks = [];
    for (let p = logMin; p <= logMax; p++) yTicks.push(Math.pow(10, p));
  } else {
    yTicks = Array.from({ length: gridLines + 1 }, (_, i) =>
      spec.yMin + ((spec.yMax - spec.yMin) / gridLines) * i);
  }

  const grid = spec.grid ? [
    ...xTicks.map((tick) => {
      const x = mapX(tick, spec.xMin, spec.xMax, plotX, plotWidth);
      return `<line x1="${x.toFixed(2)}" y1="${plotY}" x2="${x.toFixed(2)}" y2="${plotY + plotHeight}" stroke="${DEFAULT_GRID}" stroke-width="1" opacity="0.6"/>`;
    }),
    ...yTicks.map((tick) => {
      const y = mapY(tick, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
      return `<line x1="${plotX}" y1="${y.toFixed(2)}" x2="${(plotX + plotWidth).toFixed(2)}" y2="${y.toFixed(2)}" stroke="${DEFAULT_GRID}" stroke-width="1" opacity="0.6"/>`;
    })
  ].join("") : "";

  const tickLabels = [
    ...yTicks.map((tick) => {
      const y = mapY(tick, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
      return spec.yScale === "log" ? logTickSvg(tick, plotX - 10, y + 5, "end") : `<text x="${plotX - 10}" y="${y + 5}" font-size="13" text-anchor="end" fill="#94a3b8">${formatTick(tick, spec.yScale)}</text>`;
    }),
    ...xTicks.map((tick) => {
      const x = mapX(tick, spec.xMin, spec.xMax, plotX, plotWidth);
      return `<text x="${x.toFixed(2)}" y="${(plotY + plotHeight + 18).toFixed(2)}" font-size="13" text-anchor="middle" fill="#94a3b8">${spec.xMode === "pi" ? formatPiTick(tick) : formatTick(tick, spec.xScale)}</text>`;
    })
  ].join("");

  const barLayer = spec.barMode || spec.mode === "bar" ? renderBarLayer(spec, plotX, plotY, plotWidth, plotHeight) : "";
  const annotationLayer = renderAnnotations(spec, plotX, plotY, plotWidth, plotHeight);

  const seriesSvg = (spec.barMode || spec.mode === "bar") ? "" : spec.series.map((series) => {
    const path = makePath(series.points, spec, plotX, plotY, plotWidth, plotHeight);
    const circles = series.type === "line" ? "" : series.points.map((point) => {
      const cpx = mapX(point.x, spec.xMin, spec.xMax, plotX, plotWidth);
      const cpy = mapY(point.y, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
      return `<circle cx="${cpx.toFixed(2)}" cy="${cpy.toFixed(2)}" r="4.5" fill="${series.color}" stroke="#0f172a" stroke-opacity="0.8" stroke-width="1.5"/>`;
    }).join("");
    const halo = series.type === "scatter" || !path ? "" : `<path d="${path}" fill="none" stroke="#0f172a" stroke-opacity="0.8" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    const line = series.type === "scatter" || !path ? "" : `<path d="${path}" fill="none" stroke="${series.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;

    let errorSvg = "";
    for (let i = 0; i < series.points.length; i++) {
      const err = series.errorExt !== undefined
        ? normalizeErrorAt(series.errorExt, i)
        : (series.error ? normalizeErrorAt(series.error, i) : undefined);
      if (!err) continue;
      const { plus, minus } = err;
      const point = series.points[i];
      const cpx = mapX(point.x, spec.xMin, spec.xMax, plotX, plotWidth);
      const yVal = point.y;
      if (spec.yScale === "log" && yVal - minus <= 0) continue;
      const cyTop = mapY(yVal + plus, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
      const cyBot = mapY(yVal - minus, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
      const capW = 8;
      errorSvg += `<line x1="${cpx.toFixed(2)}" y1="${cyTop.toFixed(2)}" x2="${cpx.toFixed(2)}" y2="${cyBot.toFixed(2)}" stroke="${series.color}" stroke-width="1.5"/>`;
      errorSvg += `<line x1="${(cpx - capW).toFixed(2)}" y1="${cyTop.toFixed(2)}" x2="${(cpx + capW).toFixed(2)}" y2="${cyTop.toFixed(2)}" stroke="${series.color}" stroke-width="1.5"/>`;
      errorSvg += `<line x1="${(cpx - capW).toFixed(2)}" y1="${cyBot.toFixed(2)}" x2="${(cpx + capW).toFixed(2)}" y2="${cyBot.toFixed(2)}" stroke="${series.color}" stroke-width="1.5"/>`;
    }

    return `<g>${halo}${line}${circles}${errorSvg}</g>`;
  }).join("");

  // Axis lines
  const axisBottom = `<line x1="${plotX}" y1="${plotY + plotHeight}" x2="${plotX + plotWidth}" y2="${plotY + plotHeight}" stroke="${DEFAULT_AXIS}" stroke-width="1.5"/>`;
  const axisLeft = `<line x1="${plotX}" y1="${plotY}" x2="${plotX}" y2="${plotY + plotHeight}" stroke="${DEFAULT_AXIS}" stroke-width="1.5"/>`;

  return `<g>
    <defs><clipPath id="${clipId}"><rect x="${plotX}" y="${plotY}" width="${plotWidth.toFixed(2)}" height="${plotHeight.toFixed(2)}"/></clipPath></defs>
    <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="#e5e7eb" fill-opacity="0.75" stroke="#334155" stroke-opacity="0.4" stroke-width="1" rx="3"/>
    <g clip-path="url(#${clipId})">${grid}${annotationLayer}${barLayer}${seriesSvg}</g>
    ${axisBottom}${axisLeft}
    ${tickLabels}
    ${spec.title ? `<text x="${(cx + cw / 2).toFixed(2)}" y="${(cy + 16).toFixed(2)}" text-anchor="middle" font-size="14" font-weight="700" fill="#e5e7eb">${formulaText(spec.title)}</text>` : ""}
  </g>`;
}

export function renderMultiPlotSvg(result: MultiPlotResult): string {
  const { rows, cols, gap, title, cells, outerWidth, outerHeight } = result;
  const MARGIN = 60;
  const LEGEND_GAP = 16;

  // Collect + dedupe legend items
  const seen = new Set<string>();
  const entries: { name: string; color: string }[] = [];
  for (const cell of cells) {
    for (const s of cell.spec.series) {
      if (!seen.has(s.name)) { seen.add(s.name); entries.push({ name: s.name, color: s.color }); }
    }
  }

  // Measure legend
  const ITEM_H = 22, MARKER = 16, GAP = 8, PAD_X = 12, PAD_Y = 10;
  const maxLabelLen = entries.reduce((m, e) => Math.max(m, e.name.length), 0);
  const labelW = maxLabelLen * 13 * 0.6;
  const legendW = PAD_X * 2 + MARKER + GAP + labelW;
  const legendH = PAD_Y * 2 + entries.length * ITEM_H;

  // Legend position: right if grid is wide enough, else bottom
  const minGridW = 420;
  const availW = outerWidth - 2 * MARGIN;
  const useRight = entries.length > 0 && availW - legendW - LEGEND_GAP >= minGridW;
  const useBottom = entries.length > 0 && !useRight;

  // Grid rect (legend reserves space)
  const gridW = useRight ? availW - legendW - LEGEND_GAP : availW;
  const gridH = useBottom ? outerHeight - 2 * MARGIN - legendH - LEGEND_GAP : outerHeight - 2 * MARGIN;
  const cellW = Math.floor((gridW - (cols - 1) * gap) / cols);
  const cellH = Math.floor((gridH - (rows - 1) * gap) / rows);

  // Legend rect
  const legendRect = useRight
    ? { x: MARGIN + gridW + LEGEND_GAP, y: MARGIN, w: legendW, h: legendH }
    : { x: MARGIN, y: MARGIN + gridH + LEGEND_GAP, w: gridW, h: legendH };

  // Render cells in grid rect
  const cellSvgs = cells.map((cell, idx) => {
    const cx = MARGIN + cell.col * (cellW + gap);
    const cy = MARGIN + cell.row * (cellH + gap);
    const adjusted: MultiPlotCell = { ...cell, x: cx, y: cy, width: cellW, height: cellH };
    return renderSubplotCell(adjusted, idx);
  }).join("");

  // Render legend in reserved space
  const legendSvg = (useRight || useBottom)
    ? renderLegendInRect(entries, legendRect, useRight ? "right" : "bottom")
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${outerWidth}" height="${outerHeight}" viewBox="0 0 ${outerWidth} ${outerHeight}">
  <style>text { font-family: ${DEFAULT_FONT_FAMILY}; }</style>
  <rect width="100%" height="100%" fill="transparent"/>
  <rect x="10" y="10" width="${outerWidth - 20}" height="${outerHeight - 20}" rx="12" fill="#0f172a" fill-opacity="0.92"/>
  <text x="${outerWidth / 2}" y="36" text-anchor="middle" font-size="22" font-weight="700" fill="#e5e7eb">${formulaText(title)}</text>
  ${cellSvgs}
  ${legendSvg}
</svg>`;
}

function renderLegendInRect(
  entries: { name: string; color: string }[],
  rect: { x: number; y: number; w: number; h: number },
  position: "right" | "bottom"
): string {
  if (!entries.length) return "";
  const ITEM_H = 22, MARKER = 16, GAP = 8, PAD_X = 12, PAD_Y = 10;
  const parts = entries.map(({ name, color }, i) => {
    const lyi = rect.y + PAD_Y + i * ITEM_H;
    return `<rect x="${rect.x + PAD_X}" y="${lyi}" width="${MARKER}" height="${MARKER}" fill="${color}" rx="3"/><text x="${rect.x + PAD_X + MARKER + GAP}" y="${lyi + 13}" font-size="13" fill="#94a3b8">${formulaText(name)}</text>`;
  }).join("");
  return `<g><rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="#ffffff" stroke="#e5e7eb" stroke-width="1" rx="4"/>${parts}</g>`;
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
  <rect width="100%" height="100%" fill="transparent"/>
  <rect x="10" y="10" width="${width - 20}" height="${height - 20}" rx="12" fill="#0f172a" fill-opacity="0.92"/>
  <text x="${width / 2}" y="54" text-anchor="middle" font-size="${DEFAULT_FONT_SIZE + 10}" font-weight="700" fill="#e5e7eb">${formulaText(spec.title)}</text>
  <rect x="${plotX}" y="${plotY}" width="${plotWidth}" height="${plotHeight}" fill="#e5e7eb" fill-opacity="0.75" stroke="#334155" stroke-opacity="0.5" stroke-width="1" rx="4"/>
  <line x1="${plotX}" y1="${plotY + plotHeight}" x2="${plotX + plotWidth}" y2="${plotY + plotHeight}" stroke="#475569" stroke-width="1.5"/>
  <line x1="${plotX}" y1="${plotY}" x2="${plotX}" y2="${plotY + plotHeight}" stroke="#475569" stroke-width="1.5"/>
  ${bpSvg}
  <text x="${width / 2}" y="${height - 34}" text-anchor="middle" font-size="15" fill="#cbd5e1">${formulaText(spec.xlabel)}</text>
  <text x="30" y="${height / 2}" text-anchor="middle" font-size="15" fill="#cbd5e1" transform="rotate(-90 30 ${height / 2})">${formulaText(spec.ylabel)}</text>
</svg>`;
  }

  if (mode === "hist") {
    // Pi-aware tick generation
  let xTicks: number[];
  if (spec.xMode === "pi") {
    xTicks = generatePiTicks(spec.xMin, spec.xMax, gridLines);
  } else {
    xTicks = Array.from({ length: gridLines + 1 }, (_, i) => spec.xMin + ((spec.xMax - spec.xMin) / gridLines) * i);
  }
    const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => spec.yMin + ((spec.yMax - spec.yMin) / gridLines) * i);
    const grid = spec.grid ? [
      ...yTicks.map((tick) => {
        const y = mapY(tick, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
        return `<line x1="${plotX}" y1="${y}" x2="${plotX + plotWidth}" y2="${y}" stroke="${DEFAULT_GRID}" stroke-width="1" opacity="0.6"/>`;
      })
    ].join("") : "";
    const yTickLabels = yTicks.map((tick) => {
      const y = mapY(tick, spec.yMin, spec.yMax, plotY, plotHeight, spec.yScale);
      return spec.yScale === "log" ? logTickSvg(tick, plotX - 14, y + 6, "end") : `<text x="${plotX - 14}" y="${y + 6}" font-size="13" text-anchor="end" fill="#94a3b8">${tick.toFixed(0)}</text>`;
    }).join("");
    const histBars = renderHistogramBars(spec, plotX, plotY, plotWidth, plotHeight);
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>text { font-family: ${DEFAULT_FONT_FAMILY}; }</style>
  <rect width="100%" height="100%" fill="transparent"/>
  <rect x="10" y="10" width="${width - 20}" height="${height - 20}" rx="12" fill="#0f172a" fill-opacity="0.92"/>
  <text x="${width / 2}" y="54" text-anchor="middle" font-size="${DEFAULT_FONT_SIZE + 10}" font-weight="700" fill="#e5e7eb">${formulaText(spec.title)}</text>
  <rect x="${plotX}" y="${plotY}" width="${plotWidth}" height="${plotHeight}" fill="#e5e7eb" fill-opacity="0.75" stroke="#334155" stroke-opacity="0.5" stroke-width="1" rx="4"/>
  ${grid}
  <line x1="${plotX}" y1="${plotY + plotHeight}" x2="${plotX + plotWidth}" y2="${plotY + plotHeight}" stroke="#475569" stroke-width="1.5"/>
  <line x1="${plotX}" y1="${plotY}" x2="${plotX}" y2="${plotY + plotHeight}" stroke="#475569" stroke-width="1.5"/>
  ${yTickLabels}
  ${histBars}
  <text x="${width / 2}" y="${height - 34}" text-anchor="middle" font-size="15" fill="#cbd5e1">${formulaText(spec.xlabel)}</text>
  <text x="30" y="${height / 2}" text-anchor="middle" font-size="15" fill="#cbd5e1" transform="rotate(-90 30 ${height / 2})">${formulaText(spec.ylabel)}</text>
</svg>`;
  }

  return renderPlotSvg(spec);
}

export async function renderPngBase64(svg: string, env: Env): Promise<string> {
  await ensureResvgReady();
  const fontBuffers: Uint8Array[] = [new Uint8Array(arialSans), new Uint8Array(pingFangSubset)];
  const renderer = new Resvg(svg, {
    fitTo: { mode: "original" },
    background: DEFAULT_BG,
    font: {
      fontBuffers,
      defaultFontFamily: "Arial",
      sansSerifFamily: "Arial",
      defaultFontSize: DEFAULT_FONT_SIZE,
    },
  });
  const image = renderer.render();
  const png = image.asPng();
  return toBase64(png);
}

export async function renderPngResponse(svg: string, env: Env): Promise<Response> {
  await ensureResvgReady();
  const fontBuffers: Uint8Array[] = [new Uint8Array(arialSans), new Uint8Array(pingFangSubset)];
  const renderer = new Resvg(svg, {
    fitTo: { mode: "original" },
    background: DEFAULT_BG,
    font: {
      fontBuffers,
      defaultFontFamily: "Arial",
      sansSerifFamily: "Arial",
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
