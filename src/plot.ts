import { Parser } from "expr-eval";
import { DEFAULT_PALETTE, MAX_EXPR_LENGTH, MAX_LABEL_LENGTH, MAX_POINTS, MAX_SERIES, MAX_TITLE_LENGTH, MIN_POINTS } from "./constants";
import { clamp, ensureArray, limitText, parseInteger, parseNumber } from "./utils";

export type PlotPoint = { x: number; y: number };
export type PlotSeriesType = "line" | "scatter" | "line+scatter";
export type PlotAnnotation =
  | { kind: "vertical_line"; x: number; label: string; color: string }
  | { kind: "point"; x: number; y: number; label: string; color: string }
  | { kind: "label"; x: number; y: number; text: string; color: string }
  | { kind: "area"; x_min: number; x_max: number; label: string; color: string; opacity: number };

export interface NormalizedSeries {
  name: string;
  type: PlotSeriesType;
  color: string;
  points: PlotPoint[];
}

export interface HistogramBin {
  x0: number;
  x1: number;
  count: number;
  label: string;
}

export interface BoxPlotGroup {
  name: string;
  color: string;
  values: number[];
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  lowerWhisker: number;
  upperWhisker: number;
  outliers: number[];
}

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

export type PlotRenderMode = "xy" | "bar" | "hist" | "box" | "pie";

export interface PlotSpec {
  title: string;
  xlabel: string;
  ylabel: string;
  grid: boolean;
  series: NormalizedSeries[];
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  categories?: string[];
  barMode?: boolean;
  mode?: PlotRenderMode;
  annotations?: PlotAnnotation[];
  histogram?: {
    bins: HistogramBin[];
    color: string;
    seriesName: string;
  };
  boxPlot?: {
    groups: BoxPlotGroup[];
  };
  pie?: {
    slices: PieSlice[];
    total: number;
  };
}

export interface DescribeStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
  variance: number;
  q1: number;
  q3: number;
  iqr: number;
  sum: number;
}

const parser = new Parser({
  allowMemberAccess: false,
  operators: {
    assignment: false,
    concatenate: false,
    conditional: false,
    logical: false,
    comparison: false,
    in: false,
    random: false,
    fndef: false,
  },
});

type PiecewiseSegment = {
  expr: string;
  xMin: number;
  xMax: number;
  name?: string;
  color?: string;
};

function normalizePoints(rawPoints: Array<[number, number] | number[] | { x: unknown; y: unknown }>): PlotPoint[] {
  if (!Array.isArray(rawPoints) || rawPoints.length === 0) {
    throw new Error("series points must be a non-empty array");
  }
  return rawPoints.map((pair, index) => {
    let x: number;
    let y: number;
    if (Array.isArray(pair)) {
      if (pair.length < 2) {
        throw new Error(`series point at index ${index} is invalid`);
      }
      x = Number(pair[0]);
      y = Number(pair[1]);
    } else if (pair && typeof pair === "object") {
      x = Number((pair as { x: unknown }).x);
      y = Number((pair as { y: unknown }).y);
    } else {
      throw new Error(`series point at index ${index} is invalid`);
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`series point at index ${index} must contain finite numbers`);
    }
    return { x, y };
  });
}

function safeLabel(value: unknown, fallback: string, maxLength = MAX_LABEL_LENGTH) {
  return limitText(value, fallback, maxLength);
}

function safeTitle(value: unknown, fallback: string) {
  return limitText(value, fallback, MAX_TITLE_LENGTH);
}

function normalizeAnnotations(rawAnnotations: unknown): PlotAnnotation[] {
  return ensureArray<unknown>(rawAnnotations).slice(0, 24).map((item) => {
    const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
    const kind = String(record.kind || record.type || "label");
    const color = safeLabel(record.color, "#7c3aed", 32);
    if (kind === "vertical_line") {
      return { kind, x: parseNumber(record.x, 0), label: safeLabel(record.label, ""), color };
    }
    if (kind === "point") {
      return { kind, x: parseNumber(record.x, 0), y: parseNumber(record.y, 0), label: safeLabel(record.label, ""), color };
    }
    if (kind === "area") {
      const xA = parseNumber(record.x_min, 0);
      const xB = parseNumber(record.x_max, 1);
      return {
        kind,
        x_min: Math.min(xA, xB),
        x_max: Math.max(xA, xB),
        label: safeLabel(record.label, ""),
        color,
        opacity: clamp(parseNumber(record.opacity, 0.18), 0.05, 0.5),
      };
    }
    return { kind: "label", x: parseNumber(record.x, 0), y: parseNumber(record.y, 0), text: safeLabel(record.text ?? record.label, ""), color };
  });
}

function calculateBounds(series: NormalizedSeries[], annotations: PlotAnnotation[] = []) {
  const all = series.flatMap((item) => item.points);
  const pointAnnotations = annotations.filter((item): item is Extract<PlotAnnotation, { kind: "point" | "label" }> => item.kind === "point" || item.kind === "label");
  const verticalAnnotations = annotations.filter((item): item is Extract<PlotAnnotation, { kind: "vertical_line" }> => item.kind === "vertical_line");
  const areaAnnotations = annotations.filter((item): item is Extract<PlotAnnotation, { kind: "area" }> => item.kind === "area");
  const xs = [
    ...all.map((item) => item.x),
    ...pointAnnotations.map((item) => item.x),
    ...verticalAnnotations.map((item) => item.x),
    ...areaAnnotations.flatMap((item) => [item.x_min, item.x_max]),
  ];
  const ys = [...all.map((item) => item.y), ...pointAnnotations.map((item) => item.y)];
  let xMin = Math.min(...xs);
  let xMax = Math.max(...xs);
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  if (xMin === xMax) {
    xMin -= 1;
    xMax += 1;
  }
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const xPad = (xMax - xMin) * 0.05;
  const yPad = (yMax - yMin) * 0.1;
  return {
    xMin: xMin - xPad,
    xMax: xMax + xPad,
    yMin: yMin - yPad,
    yMax: yMax + yPad,
  };
}

function parseExpression(expr: string) {
  const normalizedExpr = String(expr).trim();
  if (!normalizedExpr) throw new Error("expr is required");
  if (normalizedExpr.length > MAX_EXPR_LENGTH) throw new Error(`expr is too long (max ${MAX_EXPR_LENGTH})`);
  try {
    return { normalizedExpr, parsed: parser.parse(normalizedExpr) };
  } catch (error) {
    const message = String((error as Error)?.message || error);
    throw new Error(`invalid expression syntax: ${message}`);
  }
}

function buildFunctionPoints(parsed: ReturnType<Parser["parse"]>, normalizedExpr: string, points: number, xMin: number, xMax: number): PlotPoint[] {
  const safePoints = clamp(parseInteger(points, 1000), MIN_POINTS, MAX_POINTS);
  const step = safePoints <= 1 ? 0 : (xMax - xMin) / (safePoints - 1);
  const result: PlotPoint[] = [];
  for (let i = 0; i < safePoints; i += 1) {
    const x = safePoints <= 1 ? xMin : xMin + step * i;
    let y: number;
    try {
      y = Number(parsed.evaluate({ x }));
    } catch (error) {
      const message = String((error as Error)?.message || error);
      throw new Error(`failed to evaluate expression ${normalizedExpr} at x=${x}: ${message}`);
    }
    if (!Number.isFinite(y)) continue;
    result.push({ x, y });
  }
  return result;
}

function makeFunctionSeries(expr: string, points: number, xMin: number, xMax: number, color: string, name: string): NormalizedSeries {
  const { normalizedExpr, parsed } = parseExpression(expr);
  const result = buildFunctionPoints(parsed, normalizedExpr, points, xMin, xMax);
  if (result.length === 0) {
    throw new Error(`expression ${normalizedExpr} produced no plottable points`);
  }
  return {
    name: safeLabel(name, normalizedExpr),
    type: "line",
    color,
    points: result,
  };
}

function normalizePiecewiseSegments(rawPieces: unknown, globalXMin: number, globalXMax: number): PiecewiseSegment[] {
  const pieces = ensureArray<unknown>(rawPieces).map((item, index) => {
    const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
    const expr = String(record.expr || "").trim();
    const xA = parseNumber(record.x_min, globalXMin);
    const xB = parseNumber(record.x_max, globalXMax);
    return {
      expr,
      xMin: Math.min(xA, xB),
      xMax: Math.max(xA, xB),
      name: record.label === undefined ? (record.name === undefined ? `Piece ${index + 1}` : String(record.name)) : String(record.label),
      color: typeof record.color === "string" ? record.color : undefined,
    } satisfies PiecewiseSegment;
  }).filter((piece) => piece.expr);
  if (pieces.length === 0) return [];
  if (pieces.length > MAX_SERIES) throw new Error(`too many piecewise segments (max ${MAX_SERIES})`);
  pieces.forEach((piece, index) => {
    if (!(piece.xMax > piece.xMin)) {
      throw new Error(`piece ${index + 1} must satisfy x_max > x_min`);
    }
  });
  return pieces;
}

function buildPiecewiseSeries(rawPieces: unknown, points: number, globalXMin: number, globalXMax: number): NormalizedSeries[] {
  const pieces = normalizePiecewiseSegments(rawPieces, globalXMin, globalXMax);
  if (pieces.length === 0) {
    throw new Error("pieces is required when expr is empty");
  }
  const totalSpan = pieces.reduce((sum, piece) => sum + (piece.xMax - piece.xMin), 0);
  const safePoints = clamp(parseInteger(points, 1000), MIN_POINTS, MAX_POINTS);
  const series = pieces.map((piece, index) => {
    const span = piece.xMax - piece.xMin;
    const share = totalSpan <= 0 ? 1 / pieces.length : span / totalSpan;
    const piecePoints = Math.max(2, Math.round(safePoints * share));
    return makeFunctionSeries(piece.expr, piecePoints, piece.xMin, piece.xMax, piece.color || DEFAULT_PALETTE[index % DEFAULT_PALETTE.length], piece.name || piece.expr);
  });
  if (series.every((item) => item.points.length === 0)) {
    throw new Error("piecewise function produced no plottable points");
  }
  return series;
}

function normalizeNumberArray(raw: unknown, field: string) {
  const values = ensureArray<unknown>(raw).map((item) => Number(item)).filter((item) => Number.isFinite(item));
  if (values.length === 0) throw new Error(`${field} must contain at least one finite number`);
  return values;
}

function sortNumbers(values: number[]) {
  return [...values].sort((a, b) => a - b);
}

function quantileFromSorted(sorted: number[], q: number) {
  if (sorted.length === 0) throw new Error("quantile requires at least one value");
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  const weight = pos - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function describeValues(raw: unknown): DescribeStats {
  const values = normalizeNumberArray(raw, "data");
  const sorted = sortNumbers(values);
  const count = sorted.length;
  const sum = sorted.reduce((acc, item) => acc + item, 0);
  const mean = sum / count;
  const variance = count > 1 ? sorted.reduce((acc, item) => acc + (item - mean) ** 2, 0) / (count - 1) : 0;
  const std = Math.sqrt(variance);
  const q1 = quantileFromSorted(sorted, 0.25);
  const median = quantileFromSorted(sorted, 0.5);
  const q3 = quantileFromSorted(sorted, 0.75);
  return {
    count,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    median,
    std,
    variance,
    q1,
    q3,
    iqr: q3 - q1,
    sum,
  };
}

function buildHistogramBins(data: number[], binsInput: unknown, labelsInput?: unknown): HistogramBin[] {
  const sorted = sortNumbers(data);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const bins = clamp(parseInteger(binsInput, Math.ceil(Math.sqrt(sorted.length))), 1, Math.min(64, Math.max(1, sorted.length)));
  if (min === max) {
    return [{ x0: min - 0.5, x1: max + 0.5, count: sorted.length, label: typeof labelsInput === "string" ? labelsInput : `${min}` }];
  }
  const width = (max - min) / bins;
  const counts = Array.from({ length: bins }, () => 0);
  sorted.forEach((value) => {
    const idx = Math.min(bins - 1, Math.floor((value - min) / width));
    counts[idx] += 1;
  });
  return counts.map((count, index) => {
    const x0 = min + index * width;
    const x1 = index === bins - 1 ? max : min + (index + 1) * width;
    return { x0, x1, count, label: `${x0.toFixed(2)}–${x1.toFixed(2)}` };
  });
}

function buildBoxGroup(record: Record<string, unknown>, index: number): BoxPlotGroup {
  const values = normalizeNumberArray(record.data, `series[${index}].data`);
  const stats = describeValues(values);
  const lowerFence = stats.q1 - 1.5 * stats.iqr;
  const upperFence = stats.q3 + 1.5 * stats.iqr;
  const inliers = values.filter((value) => value >= lowerFence && value <= upperFence);
  const inlierSorted = sortNumbers(inliers.length > 0 ? inliers : values);
  const outliers = sortNumbers(values.filter((value) => value < lowerFence || value > upperFence));
  return {
    name: safeLabel(record.name, `Group ${index + 1}`),
    color: typeof record.color === "string" && record.color ? record.color : DEFAULT_PALETTE[index % DEFAULT_PALETTE.length],
    values,
    min: Math.min(...values),
    q1: stats.q1,
    median: stats.median,
    q3: stats.q3,
    max: Math.max(...values),
    lowerWhisker: inlierSorted[0],
    upperWhisker: inlierSorted[inlierSorted.length - 1],
    outliers,
  };
}

function pearsonCorrelation(a: number[], b: number[]) {
  if (a.length !== b.length || a.length < 2) throw new Error("correlation requires arrays with the same length >= 2");
  const meanA = a.reduce((acc, item) => acc + item, 0) / a.length;
  const meanB = b.reduce((acc, item) => acc + item, 0) / b.length;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return 0;
  return cov / Math.sqrt(varA * varB);
}

export function analyzeData(args: Record<string, unknown>) {
  const op = String(args.op || args.action || args.kind || args.analysis || "describe");
  if (op === "describe") {
    return { ok: true, op, stats: describeValues(args.data) };
  }
  if (op === "corr") {
    const rawSeries = ensureArray<unknown>(args.series);
    if (rawSeries.length < 2) throw new Error("corr requires at least 2 series");
    const normalized = rawSeries.map((item, index) => {
      const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
      return {
        name: safeLabel(record.name, `Series ${index + 1}`),
        data: normalizeNumberArray(record.data ?? item, `series[${index}]`),
      };
    });
    const size = normalized[0].data.length;
    if (normalized.some((item) => item.data.length !== size)) throw new Error("all corr series must have the same length");
    return {
      ok: true,
      op,
      labels: normalized.map((item) => item.name),
      matrix: normalized.map((left) => normalized.map((right) => pearsonCorrelation(left.data, right.data))),
    };
  }
  if (op === "groupby") {
    const values = normalizeNumberArray(args.data, "data");
    const groups = ensureArray<unknown>(args.groups).map((item) => String(item));
    if (groups.length !== values.length) throw new Error("groupby requires groups length to match data length");
    const bucket = new Map<string, number[]>();
    groups.forEach((group, index) => {
      const list = bucket.get(group) || [];
      list.push(values[index]);
      bucket.set(group, list);
    });
    return {
      ok: true,
      op,
      groups: Array.from(bucket.entries()).map(([group, groupValues]) => ({
        group,
        stats: describeValues(groupValues),
      })),
    };
  }
  throw new Error("analysis op must be describe, corr, or groupby");
}

export function buildSinglePlot(args: Record<string, unknown>): PlotSpec {
  const expr = String(args.expr || "").trim();
  const xMin = parseNumber(args.x_min, -10);
  const xMax = parseNumber(args.x_max, 10);
  if (!(xMax > xMin)) throw new Error("x_max must be greater than x_min");
  const annotations = normalizeAnnotations(args.annotations);
  const series = expr
    ? [makeFunctionSeries(expr, parseInteger(args.points, 1000), xMin, xMax, DEFAULT_PALETTE[0], expr)]
    : buildPiecewiseSeries(args.pieces, parseInteger(args.points, 1000), xMin, xMax);
  return {
    title: safeTitle(args.title, expr ? "Function Plot" : "Piecewise Function Plot"),
    xlabel: safeLabel(args.xlabel, "x"),
    ylabel: safeLabel(args.ylabel, "y"),
    grid: args.grid === undefined ? true : Boolean(args.grid),
    series,
    annotations,
    mode: "xy",
    ...calculateBounds(series, annotations),
  };
}

export function buildMultiPlot(args: Record<string, unknown>): PlotSpec {
  const exprs = ensureArray<unknown>(args.exprs).map((item) => String(item).trim()).filter(Boolean);
  if (exprs.length === 0) throw new Error("exprs is required");
  if (exprs.length > MAX_SERIES) throw new Error(`too many expressions (max ${MAX_SERIES})`);
  const labels = ensureArray<unknown>(args.labels).map((item) => safeLabel(item, ""));
  const xMin = parseNumber(args.x_min, -10);
  const xMax = parseNumber(args.x_max, 10);
  if (!(xMax > xMin)) throw new Error("x_max must be greater than x_min");
  const points = parseInteger(args.points, 1000);
  const annotations = normalizeAnnotations(args.annotations);
  const series = exprs.map((expr, index) => makeFunctionSeries(expr, points, xMin, xMax, DEFAULT_PALETTE[index % DEFAULT_PALETTE.length], labels[index] || expr));
  return {
    title: safeTitle(args.title, "Multi Function Plot"),
    xlabel: safeLabel(args.xlabel, "x"),
    ylabel: safeLabel(args.ylabel, "y"),
    grid: args.grid === undefined ? true : Boolean(args.grid),
    series,
    annotations,
    mode: "xy",
    ...calculateBounds(series, annotations),
  };
}

export function buildSeriesPlot(args: Record<string, unknown>): PlotSpec {
  const input = ensureArray<unknown>(args.series);
  if (input.length === 0) throw new Error("series is required");
  if (input.length > MAX_SERIES) throw new Error(`too many series (max ${MAX_SERIES})`);
  const annotations = normalizeAnnotations(args.annotations);

  const first = (input[0] && typeof input[0] === "object") ? input[0] as Record<string, unknown> : {};
  const firstType = String(first.type || "line");

  if (firstType === "hist") {
    const data = normalizeNumberArray(first.data, "series[0].data");
    const bins = buildHistogramBins(data, first.bins);
    const points = bins.map((bin, index) => ({ x: index, y: bin.count }));
    const series: NormalizedSeries[] = [{
      name: safeLabel(first.name, "Histogram"),
      type: "line+scatter",
      color: typeof first.color === "string" && first.color ? first.color : DEFAULT_PALETTE[0],
      points,
    }];
    return {
      title: safeTitle(args.title, "Histogram"),
      xlabel: safeLabel(args.xlabel, "Bin"),
      ylabel: safeLabel(args.ylabel, "Count"),
      grid: args.grid === undefined ? true : Boolean(args.grid),
      series,
      annotations,
      categories: bins.map((bin) => bin.label),
      mode: "hist",
      histogram: {
        bins,
        color: series[0].color,
        seriesName: series[0].name,
      },
      xMin: -0.5,
      xMax: bins.length - 0.5,
      yMin: 0,
      yMax: Math.max(1, ...bins.map((bin) => bin.count)) * 1.1,
    };
  }

  if (firstType === "box") {
    const groups = input.map((item, index) => buildBoxGroup((item && typeof item === "object") ? item as Record<string, unknown> : {}, index));
    const yValues = groups.flatMap((group) => [group.lowerWhisker, group.q1, group.median, group.q3, group.upperWhisker, ...group.outliers]);
    return {
      title: safeTitle(args.title, "Box Plot"),
      xlabel: safeLabel(args.xlabel, "Group"),
      ylabel: safeLabel(args.ylabel, "Value"),
      grid: args.grid === undefined ? true : Boolean(args.grid),
      series: [],
      annotations,
      categories: groups.map((group) => group.name),
      mode: "box",
      boxPlot: { groups },
      xMin: -0.5,
      xMax: groups.length - 0.5,
      yMin: Math.min(...yValues) - Math.max(1e-6, (Math.max(...yValues) - Math.min(...yValues)) * 0.1),
      yMax: Math.max(...yValues) + Math.max(1e-6, (Math.max(...yValues) - Math.min(...yValues)) * 0.1),
    };
  }

  if (firstType === "pie") {
    const labels = ensureArray<unknown>(first.labels).map((item, index) => safeLabel(item, `Slice ${index + 1}`));
    const values = ensureArray<unknown>(first.values).map((item) => Number(item));
    if (labels.length === 0 || labels.length !== values.length) throw new Error("pie series requires labels and values with matching lengths");
    if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new Error("pie values must be finite non-negative numbers");
    const slices = values.map((value, index) => ({
      label: labels[index],
      value,
      color: DEFAULT_PALETTE[index % DEFAULT_PALETTE.length],
    }));
    const total = values.reduce((acc, value) => acc + value, 0);
    if (total <= 0) throw new Error("pie total must be positive");
    return {
      title: safeTitle(args.title, "Pie Chart"),
      xlabel: safeLabel(args.xlabel, ""),
      ylabel: safeLabel(args.ylabel, ""),
      grid: false,
      series: [],
      annotations: [],
      mode: "pie",
      pie: { slices, total },
      xMin: -1,
      xMax: 1,
      yMin: -1,
      yMax: 1,
    };
  }

  const series = input.map((item, index) => {
    const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
    const type = record.type === "scatter" || record.type === "line+scatter" ? record.type : "line";
    return {
      name: safeLabel(record.name, `Series ${index + 1}`),
      type,
      color: typeof record.color === "string" && record.color ? record.color : DEFAULT_PALETTE[index % DEFAULT_PALETTE.length],
      points: normalizePoints(Array.isArray(record.points) ? record.points as Array<[number, number]> : []),
    } satisfies NormalizedSeries;
  });
  return {
    title: safeTitle(args.title, "Series Plot"),
    xlabel: safeLabel(args.xlabel, "x"),
    ylabel: safeLabel(args.ylabel, "y"),
    grid: args.grid === undefined ? true : Boolean(args.grid),
    series,
    annotations,
    mode: "xy",
    ...calculateBounds(series, annotations),
  };
}

export function buildBarChart(args: Record<string, unknown>): PlotSpec {
  const categories = ensureArray<unknown>(args.categories).map((item) => safeLabel(item, "", 32));
  const values = ensureArray<unknown>(args.values).map((item) => Number(item));
  if (categories.length === 0 || values.length !== categories.length) {
    throw new Error("categories and values are required with matching lengths");
  }
  if (categories.length > MAX_SERIES) {
    throw new Error(`too many categories (max ${MAX_SERIES})`);
  }
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("values must all be finite numbers");
  }
  const points = values.map((value, index) => ({ x: index, y: value }));
  const series: NormalizedSeries[] = [{
    name: safeLabel(args.series_name, "Bars"),
    type: "line+scatter",
    color: DEFAULT_PALETTE[0],
    points,
  }];
  const bounds = calculateBounds(series);
  return {
    title: safeTitle(args.title, "Bar Chart"),
    xlabel: safeLabel(args.xlabel, "Category"),
    ylabel: safeLabel(args.ylabel, "Value"),
    grid: args.grid === undefined ? true : Boolean(args.grid),
    series,
    categories,
    barMode: true,
    mode: "bar",
    xMin: -0.5,
    xMax: categories.length - 0.5,
    yMin: Math.min(0, bounds.yMin),
    yMax: bounds.yMax,
  };
}
