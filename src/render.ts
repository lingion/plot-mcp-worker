import { Resvg, initWasm } from "@resvg/resvg-wasm";
import wasmModule from "@resvg/resvg-wasm/index_bg.wasm";
import pingFangSubset from "./PingFangSC-Regular.subset.ttf";
import { DEFAULT_AXIS, DEFAULT_BG, DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE, DEFAULT_GRID, DEFAULT_HEIGHT, DEFAULT_WIDTH, Env } from "./constants";
import { PlotAnnotation, PlotPoint, PlotSpec } from "./plot";
import { escapeXml, toBase64 } from "./utils";

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
    return `<g><rect x="${width - 290}" y="${y - 12}" width="18" height="4" fill="${series.color}" rx="2"/><text x="${width - 264}" y="${y}" font-size="18" fill="#111827">${escapeXml(series.name)}</text></g>`;
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
    const label = escapeXml(spec.categories?.[index] || String(index + 1));
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
    return `<g><path d="${path}" fill="${item.color}" opacity="${item.opacity}"/><text x="${labelX.toFixed(2)}" y="${labelY}" font-size="17" text-anchor="middle" fill="${item.color}" font-weight="600">${escapeXml(item.label)}</text></g>`;
  }).join("");
  const lineLayer = annotations.filter((item): item is Extract<PlotAnnotation, { kind: "vertical_line" }> => item.kind === "vertical_line").map((item) => {
    const x = mapX(item.x, spec.xMin, spec.xMax, plotX, plotWidth);
    return `<g><line x1="${x.toFixed(2)}" y1="${plotY}" x2="${x.toFixed(2)}" y2="${plotY + plotHeight}" stroke="${item.color}" stroke-width="2.5" stroke-dasharray="8 7"/><text x="${(x + 8).toFixed(2)}" y="${plotY + 24}" font-size="17" fill="${item.color}" font-weight="600">${escapeXml(item.label)}</text></g>`;
  }).join("");
  const pointLayer = annotations.filter((item): item is Extract<PlotAnnotation, { kind: "point" }> => item.kind === "point").map((item) => {
    const x = mapX(item.x, spec.xMin, spec.xMax, plotX, plotWidth);
    const y = mapY(item.y, spec.yMin, spec.yMax, plotY, plotHeight);
    return `<g><circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="6" fill="${item.color}" stroke="#fff" stroke-width="2"/><text x="${(x + 10).toFixed(2)}" y="${(y - 10).toFixed(2)}" font-size="17" fill="${item.color}" font-weight="600">${escapeXml(item.label)}</text></g>`;
  }).join("");
  const labelLayer = annotations.filter((item): item is Extract<PlotAnnotation, { kind: "label" }> => item.kind === "label").map((item) => {
    const x = mapX(item.x, spec.xMin, spec.xMax, plotX, plotWidth);
    const y = mapY(item.y, spec.yMin, spec.yMax, plotY, plotHeight);
    return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="17" fill="${item.color}" font-weight="600">${escapeXml(item.text)}</text>`;
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
  <text x="${width / 2}" y="54" text-anchor="middle" font-size="${DEFAULT_FONT_SIZE + 10}" font-weight="700" fill="#111827">${escapeXml(spec.title)}</text>
  <rect x="${plotX}" y="${plotY}" width="${plotWidth}" height="${plotHeight}" fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"/>
  ${grid}
  <line x1="${plotX}" y1="${plotY + plotHeight}" x2="${plotX + plotWidth}" y2="${plotY + plotHeight}" stroke="${DEFAULT_AXIS}" stroke-width="2"/>
  <line x1="${plotX}" y1="${plotY}" x2="${plotX}" y2="${plotY + plotHeight}" stroke="${DEFAULT_AXIS}" stroke-width="2"/>
  ${tickLabels}
  ${barLayer}
  ${annotationLayer}
  ${seriesSvg}
  ${renderLegend(spec, width)}
  <text x="${width / 2}" y="${height - 34}" text-anchor="middle" font-size="20" fill="#111827">${escapeXml(spec.xlabel)}</text>
  <text x="30" y="${height / 2}" text-anchor="middle" font-size="20" fill="#111827" transform="rotate(-90 30 ${height / 2})">${escapeXml(spec.ylabel)}</text>
</svg>`;
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
