import { Parser } from "expr-eval";
import { DEFAULT_PALETTE, MAX_EXPR_LENGTH, MAX_LABEL_LENGTH, MAX_POINTS, MAX_SERIES, MAX_TITLE_LENGTH, MIN_POINTS } from "./constants";
import { clamp, ensureArray, limitText, parseInteger, parseNumber } from "./utils";

export type PlotPoint = { x: number; y: number };
export type PlotSeriesType = "line" | "scatter" | "line+scatter" | "bar";
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
  error?: number[];  // per-point error bars (±) — legacy symmetric form
  errorExt?: ErrorInput;  // extended error: symmetric, asymmetric, or constant
  group?: string;    // group label for grouped/stacked bars
  stack?: string;    // stack ID for stacked bars
  transforms?: TransformSpec[];  // data transforms applied in order before render
}

/** Normalized per-point error: always { plus, minus } or undefined */
export type NormalizedError = { plus: number; minus: number } | undefined;

/** Error input forms accepted from user */
export type ErrorInput =
  | number                          // constant symmetric error
  | number[]                        // per-point symmetric error
  | { plus?: number | number[]; minus?: number | number[] };  // asymmetric

function pickErrorValue(v: number | number[] | undefined, i: number): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return v;
  return v[i];
}

export function normalizeErrorAt(error: ErrorInput | undefined, i: number): NormalizedError {
  if (error == null) return undefined;
  if (typeof error === "number") {
    if (!Number.isFinite(error) || error < 0) return undefined;
    return { plus: error, minus: error };
  }
  if (Array.isArray(error)) {
    const e = error[i];
    if (e == null || !Number.isFinite(e) || e < 0) return undefined;
    return { plus: e, minus: e };
  }
  const plus = pickErrorValue(error.plus, i);
  const minus = pickErrorValue(error.minus, i);
  if (plus == null && minus == null) return undefined;
  const p = plus ?? 0;
  const m = minus ?? 0;
  if (!Number.isFinite(p) || !Number.isFinite(m) || p < 0 || m < 0) return undefined;
  return { plus: p, minus: m };
}

/** Returns { plus, minus } for a constant error value (or undefined) */
export function normalizeConstantError(error: number | undefined): NormalizedError {
  if (error == null || !Number.isFinite(error) || error < 0) return undefined;
  return { plus: error, minus: error };
}

// ── Transform engine ─────────────────────────────────────────────────────────

function warn(msg: string, warnings: string[]): void {
  warnings.push(msg);
}

function warnTransform(type: TransformWarning["type"], message: string, detail: Record<string, unknown>, warnings: TransformWarning[]): void {
  warnings.push({ type, message, detail });
}

export function applySeriesTransforms(
  series: NormalizedSeries,
  warnings: string[]
): NormalizedSeries {
  if (!series.transforms || series.transforms.length === 0) return series;
  let s = series;
  for (const t of series.transforms) {
    s = applyOneTransform(s, t, warnings);
  }
  return s;
}

export function applySeriesTransformsWithTrace(
  series: NormalizedSeries,
  warnings: string[]
): { series: NormalizedSeries; stages: TransformStage[] } {
  // Collect plain string warnings for internal use (applyOneTransform uses string[])
  const _warnings: string[] = [];
  const stages: TransformStage[] = [];
  let s = series;
  const N = s.points.length;
  stages.push({ name: "raw", input: N, output: N });
  if (!s.transforms || s.transforms.length === 0) return { series: s, stages };

  for (const t of s.transforms) {
    const before = s.points.length;
    const warnBefore = _warnings.length;
    s = applyOneTransform(s, t, _warnings);
    const after = s.points.length;
    const skipped = _warnings.length > warnBefore; // transform emitted a warning → it was skipped/partial
    stages.push({
      name: transformStageName(t),
      method: t.method ?? t.window ? String(t.window ?? "") : undefined,
      input: before,
      output: after,
      detail: buildStageDetail(t),
      ...(skipped ? { skipped: true } : {}),
    });
  }
  // Merge internal string warnings into caller's warnings array
  warnings.push(..._warnings);
  return { series: s, stages };
}

function transformStageName(t: TransformSpec): string {
  switch (t.type) {
    case "normalize": return "normalize";
    case "smooth":    return "smooth";
    case "filter":    return "filter";
    case "rolling_average": return "rolling_average";
    case "downsample": return "downsample";
    default: return "unknown";
  }
}

function buildStageDetail(t: TransformSpec): Record<string, unknown> {
  switch (t.type) {
    case "normalize": return { method: t.method ?? "minmax", target: t.target ?? "y" };
    case "smooth":    return { window: t.window ?? 3 };
    case "filter":    return { target: t.target ?? "y", op: t.op, value: t.value };
    case "rolling_average": return { window: t.window ?? 3 };
    case "downsample": return { method: t.method ?? "uniform", maxPoints: t.maxPoints };
    default: return {};
  }
}

function collectSeriesTransforms(
  series: NormalizedSeries[],
  warnings: TransformWarning[],
  trace: boolean
): { transformedSeries: NormalizedSeries[]; allStages: TransformStage[] } {
  const strWarnings: string[] = [];
  if (!trace) {
    const transformedSeries = series.map(s => applySeriesTransforms(s, strWarnings));
    // Bridge string warnings → TransformWarning[]
    for (const msg of strWarnings) {
      warnings.push({ type: "transform", message: msg });
    }
    return { transformedSeries, allStages: [] };
  }
  const transformedSeries: NormalizedSeries[] = [];
  const allStages: TransformStage[] = [];
  for (const s of series) {
    const local: string[] = [];
    const { series: ts, stages } = applySeriesTransformsWithTrace(s, local);
    transformedSeries.push(ts);
    if (stages.length > 1) allStages.push(...stages);
    // Merge collected string warnings into TransformWarning[]
    for (const msg of local) {
      warnings.push({ type: "transform", message: msg });
    }
  }
  return { transformedSeries, allStages };
}

function applyOneTransform(
  s: NormalizedSeries,
  t: TransformSpec,
  warnings: string[]
): NormalizedSeries {
  switch (t.type) {
    case "normalize": return applyNormalize(s, t, warnings);
    case "smooth":     return applySmooth(s, t, warnings);
    case "filter":    return applyFilter(s, t, warnings);
    case "rolling_average": return applyRollingAverage(s, t, warnings);
    case "downsample":      return applyDownsample(s, t, warnings);
    default:
      warn(`Unknown transform type "${(t as TransformSpec).type}"; skipped.`, warnings);
      return s;
  }
}

// ── Normalize ────────────────────────────────────────────────────────────────

function applyNormalize(s: NormalizedSeries, t: NormalizeTransform, warnings: string[]): NormalizedSeries {
  if (s.type === "hist" || s.type === "box" || s.type === "pie") {
    warn(`normalize: not supported for ${s.type} series; skipped.`, warnings);
    return s;
  }
  if (s.errorExt !== undefined || s.error) {
    warn(`normalize skipped: not supported when series has error bars`, warnings);
    return s;
  }
  const target = t.target ?? "y";
  const pts = s.points.map(p => ({ x: p.x, y: p.y }));
  if (target === "x" || target === "both") {
    const vals = pts.map(p => p.x);
    const n = normalizeArray(vals, t.method ?? "minmax");
    pts.forEach((p, i) => { p.x = n[i]; });
  }
  if (target === "y" || target === "both") {
    const vals = pts.map(p => p.y);
    const n = normalizeArray(vals, t.method ?? "minmax");
    pts.forEach((p, i) => { p.y = n[i]; });
  }
  return { ...s, points: pts };
}

function normalizeArray(vals: number[], method: "minmax" | "zscore" | "maxabs"): number[] {
  if (method === "minmax") {
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    if (mx === mn) return vals.map(() => 0.5);
    return vals.map(v => (v - mn) / (mx - mn));
  }
  if (method === "zscore") {
    const n = vals.length;
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    const variance = vals.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    if (std === 0) return vals.map(() => 0);
    return vals.map(v => (v - mean) / std);
  }
  // maxabs
  const maxAbs = Math.max(...vals.map(Math.abs));
  if (maxAbs === 0) return vals.map(() => 0);
  return vals.map(v => v / maxAbs);
}

// ── Smooth / Rolling Average ──────────────────────────────────────────────────

function applySmooth(s: NormalizedSeries, t: SmoothTransform, warnings: string[]): NormalizedSeries {
  if (s.type !== "line") {
    warn(`smooth: only supported for line series; skipped for ${s.type}.`, warnings);
    return s;
  }
  return applyRollingAverageCore(s, t.window ?? 3, t.target ?? "y", warnings);
}

function applyRollingAverage(s: NormalizedSeries, t: RollingAverageTransform, warnings: string[]): NormalizedSeries {
  if (s.type !== "line") {
    warn(`rolling_average: only supported for line series; skipped for ${s.type}.`, warnings);
    return s;
  }
  return applyRollingAverageCore(s, t.window ?? 3, t.target ?? "y", warnings);
}

function applyRollingAverageCore(s: NormalizedSeries, window: number, target: string, warnings: string[]): NormalizedSeries {
  if (window < 2) {
    warn(`rolling_average skipped: window < 2 is a no-op`, warnings);
    return s;
  }
  const pts = s.points.map(p => ({ x: p.x, y: p.y }));
  const vals = target === "x" ? pts.map(p => p.x) : pts.map(p => p.y);
  const half = Math.floor(window / 2);
  const smoothed = vals.map((_, i) => {
    let sum = 0, cnt = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(vals.length - 1, i + half); j++) {
      if (Number.isFinite(vals[j])) { sum += vals[j]; cnt++; }
    }
    return cnt > 0 ? sum / cnt : NaN;
  });
  // Replace boundary NaNs with nearest valid value
  for (let i = 0; i < smoothed.length; i++) {
    if (!Number.isFinite(smoothed[i])) {
      let j = i + 1;
      while (j < smoothed.length && !Number.isFinite(smoothed[j])) j++;
      if (j < smoothed.length && Number.isFinite(smoothed[j])) {
        smoothed[i] = smoothed[j];
      } else {
        let k = i - 1;
        while (k >= 0 && !Number.isFinite(smoothed[k])) k--;
        smoothed[i] = Number.isFinite(smoothed[k]) ? smoothed[k] : vals[i];
      }
    }
  }
  if (target === "x") pts.forEach((p, i) => { p.x = smoothed[i]; });
  else pts.forEach((p, i) => { p.y = smoothed[i]; });
  return { ...s, points: pts };
}

// ── Filter ────────────────────────────────────────────────────────────────────

function applyFilter(s: NormalizedSeries, t: FilterTransform, warnings: string[]): NormalizedSeries {
  const target = t.target ?? "y";
  const op = t.op;
  const val = t.value;
  const pts = s.points.filter(p => {
    const v = target === "x" ? p.x : p.y;
    switch (op) {
      case ">":  return v > val;
      case ">=": return v >= val;
      case "<":  return v < val;
      case "<=": return v <= val;
      case "==": return v === val;
      case "!=": return v !== val;
      default:  return true;
    }
  });
  if (pts.length === 0) {
    warn(`filter result is empty; keeping all points`, warnings);
    return s;
  }
  // Sync errors with filtered points
  let error = s.error;
  if (error) {
    // Rebuild error array to match filtered points by index
    // Since we filter by condition, we can't easily sync — just clear error
    warn(`filter: error bars cleared since x/y alignment changed`, warnings);
  }
  return { ...s, points: pts, error: undefined };
}

// ── Downsample ───────────────────────────────────────────────────────────────

function applyDownsample(s: NormalizedSeries, t: DownsampleTransform, warnings: string[]): NormalizedSeries {
  const maxPoints = t.maxPoints;
  if (!Number.isFinite(maxPoints) || maxPoints < 2) {
    warn(`downsample skipped: maxPoints must be >= 2`, warnings);
    return s;
  }
  if (s.points.length <= maxPoints) return s;
  const method = t.method ?? "uniform";
  const pts = s.points;
  if (method === "uniform") {
    const step = (pts.length - 1) / (maxPoints - 1);
    const newPts = Array.from({ length: maxPoints }, (_, i) => {
      const idx = Math.round(i * step);
      return pts[idx];
    });
    return { ...s, points: newPts };
  }
  // minmax: preserve extremes per bucket — O(N) via original-index tracking
  // Assign original indices to all points upfront (O(N) once)
  interface IdxPt { pt: PlotPoint; idx: number }
  const indexed: IdxPt[] = pts.map((pt, idx) => ({ pt, idx }));
  const bucketSize = pts.length / maxPoints;
  const candidates: IdxPt[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.min(Math.floor((i + 1) * bucketSize), pts.length);
    const bucket = indexed.slice(start, end);
    if (bucket.length === 0) continue;
    let min = bucket[0], max = bucket[0];
    for (let j = 1; j < bucket.length; j++) {
      const { pt: p, idx: pj } = bucket[j];
      const { pt: mn, idx: mj } = min;
      const { pt: mx, idx: xj } = max;
      if (p.y < mn.y || (p.y === mn.y && pj < mj)) min = bucket[j];
      if (p.y > mx.y || (p.y === mx.y && pj < xj)) max = bucket[j];
    }
    candidates.push(min);
    if (max !== min) candidates.push(max);
  }
  // Sort by original index (bucket order), then deduplicate consecutive equal entries
  candidates.sort((a, b) => a.idx - b.idx);
  const result: PlotPoint[] = [];
  for (const { pt, idx } of candidates) {
    const prev = result[result.length - 1];
    if (!prev || prev.x !== pt.x || prev.y !== pt.y) {
      result.push(pt);
    }
    // Note: if prev.x === pt.x && prev.y === pt.y → same point in adjacent buckets → skip (correct)
  }
  return { ...s, points: result };
}

export interface HistogramBin {
  x0: number;
  x1: number;
  count: number;
  label: string;
}

export interface MultiPlotSpec {
  rows: number;
  cols: number;
  gap?: number;
  sharedX?: boolean;
  sharedY?: boolean;
  plots: {
    row: number;
    col: number;
    title?: string;
    series: { name?: string; type?: string; points?: [number,number][]; data?: number[]; color?: string; error?: unknown; group?: string; }[];
    xlabel?: string;
    ylabel?: string;
    y_scale?: AxisScale;
  }[];
}

// ── Transform types ──────────────────────────────────────────────────────────

export type TransformType = "normalize" | "smooth" | "filter" | "rolling_average" | "downsample";

export interface NormalizeTransform {
  type: "normalize";
  method?: "minmax" | "zscore" | "maxabs";
  target?: "x" | "y";
}

export interface SmoothTransform {
  type: "smooth";
  method?: "moving_average";
  window?: number;
  target?: "x" | "y";
}

export interface FilterTransform {
  type: "filter";
  target?: "x" | "y";
  op: ">" | ">=" | "<" | "<=" | "==" | "!=";
  value: number;
}

export interface RollingAverageTransform {
  type: "rolling_average";
  window?: number;
  target?: "x" | "y";
}

export interface DownsampleTransform {
  type: "downsample";
  method?: "uniform";
  maxPoints: number;
}

export type TransformSpec =
  | NormalizeTransform
  | SmoothTransform
  | FilterTransform
  | RollingAverageTransform
  | DownsampleTransform;

export interface TransformWarnings {
  warnings: string[];
}

export interface TransformWarning {
  type: "transform" | "performance" | "scale";
  message: string;
  detail?: Record<string, unknown>;
}

export interface TransformStage {
  name: string;
  method?: string;      // e.g. "minmax", "zscore", "uniform"
  input: number;        // input point count
  output: number;       // output point count
  detail?: Record<string, unknown>;  // method-specific params
  skipped?: boolean;    // true when transform was skipped (warning emitted)
}

export interface TransformDebug {
  stages: TransformStage[];
}

export type TransformPolicy = "strict" | "best-effort";

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

export type BarMode = "grouped" | "stacked";

export type AxisScale = "linear" | "log";

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
  yScale?: AxisScale;  // "linear" (default) | "log"
  xScale?: AxisScale;
  xMode?: "pi" | "numeric";  // "pi" formats x-ticks as π fractions
  aspect?: "auto" | "equal";  // "equal" = 1:1 coordinate unit ratio
  layoutPreset?: "default" | "math";
  categories?: string[];
  barMode?: boolean;
  barStyle?: BarMode;  // "grouped" | "stacked" for multi-series bars
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
  warnings?: TransformWarning[];  // non-fatal structured warnings
  debug?: TransformDebug;  // transform pipeline trace (only when debug:true in request)
  transform_policy?: TransformPolicy;  // "strict" | "best-effort" (default)
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

function calculateBounds(series: NormalizedSeries[], annotations: PlotAnnotation[] = [], barStyle?: BarMode, yScale?: AxisScale): { xMin: number; xMax: number; yMin: number; yMax: number } {
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
  let ys: number[] = [];

  // For stacked bars, compute cumulative heights
  if (barStyle === "stacked" && series.length > 0) {
    const numPoints = series[0].points.length;
    for (let i = 0; i < numPoints; i++) {
      let acc = 0;
      for (const s of series) {
        acc += s.points[i]?.y || 0;
      }
      ys.push(0); // baseline
      ys.push(acc);
    }
  } else {
    ys = [...all.map((item) => item.y), ...pointAnnotations.map((item) => item.y)];
  }

  // Extend for error bars (handles legacy error:number[] and new errorExt:ErrorInput)
  for (const s of series) {
    for (let i = 0; i < s.points.length; i++) {
      // Try errorExt first (new form), fall back to legacy error
      const err = s.errorExt !== undefined
        ? normalizeErrorAt(s.errorExt, i)
        : (s.error ? normalizeErrorAt(s.error, i) : undefined);
      if (!err) continue;
      const { plus, minus } = err;
      const yVal = s.points[i].y;
      if (yScale === "log") {
        if (yVal - minus > 0) ys.push(yVal - minus);
        if (yVal + plus > 0) ys.push(yVal + plus);
      } else {
        ys.push(yVal - minus);
        ys.push(yVal + plus);
      }
    }
  }

    let xMin = xs.length ? Math.min(...xs) : -1;
  let xMax = xs.length ? Math.max(...xs) : 1;
  let yMin = ys.length ? Math.min(...ys) : -1;
  let yMax = ys.length ? Math.max(...ys) : 1;

  // Bar-aware x-padding: bars have width, domain must extend beyond data center points
  const barSeries = series.filter((s) => s.type === "bar");
  if (barSeries.length > 0 && xs.length > 1) {
    const numCategories = barSeries[0].points.length;
    const xRange = xMax - xMin;
    const slotWidth = xRange / Math.max(numCategories - 1, 1);
    const halfGroup = barStyle === "stacked"
      ? slotWidth * 0.32
      : slotWidth * 0.40 * barSeries.length;
    xMin -= halfGroup;
    xMax += halfGroup;
  }

  if (xMin === xMax) {
    xMin -= 1;
    xMax += 1;
  }
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const xPad = (xMax - xMin) * 0.05;
  const yRange = yMax - yMin || 1;
  const yPad = yRange * 0.1;
  let finalYMin = yMin - yPad;
  let finalYMax = yMax + yPad;
  // Symmetric axis for data crossing zero (e.g., sin)
  if (yMin < 0 && yMax > 0) {
    const m = Math.max(Math.abs(finalYMin), Math.abs(finalYMax));
    finalYMin = -m;
    finalYMax = m;
  }
  // If all data is positive but padding pushes yMin below zero, clamp
  if (yMin > 0 && finalYMin <= 0) {
    finalYMin = yMin * 0.5;
  }
  return {
    xMin: xMin - xPad,
    xMax: xMax + xPad,
    yMin: finalYMin,
    yMax: finalYMax,
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

/** Auto-detect whether x-axis should use π formatting */
function detectPiMode(expr: string, xMin: number, xMax: number): { xMode?: "pi" } {
  const hasTrig = /\b(sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan)\b/i.test(expr);
  const range = xMax - xMin;
  if (hasTrig && range <= 8 * Math.PI && Math.abs(xMin) <= 4 * Math.PI && Math.abs(xMax) <= 4 * Math.PI) {
    return { xMode: "pi" };
  }
  return {};
}

function resolveFunctionLayout(args: Record<string, unknown>): Pick<PlotSpec, "aspect" | "layoutPreset"> {
  const rawAspect = String(args.aspect || "").trim().toLowerCase();
  if (rawAspect === "equal") {
    return { aspect: "equal", layoutPreset: "math" };
  }
  if (rawAspect === "auto") {
    return { aspect: "auto", layoutPreset: "math" };
  }
  return { aspect: "auto", layoutPreset: "math" };
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
  // Auto-detect π mode for trig functions
  const { xMode } = detectPiMode(expr, xMin, xMax);
  const layout = resolveFunctionLayout(args);
  return {
    title: safeTitle(args.title, expr ? "Function Plot" : "Piecewise Function Plot"),
    xlabel: safeLabel(args.xlabel, "x"),
    ylabel: safeLabel(args.ylabel, "y"),
    grid: args.grid === undefined ? true : Boolean(args.grid),
    series,
    annotations,
    mode: "xy",
    ...(xMode ? { xMode } : {}),
    ...layout,
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
  // Auto-detect π mode for trig functions
  const { xMode } = detectPiMode(exprs.join(","), xMin, xMax);
  const layout = resolveFunctionLayout(args);
  return {
    title: safeTitle(args.title, "Multi Function Plot"),
    xlabel: safeLabel(args.xlabel, "x"),
    ylabel: safeLabel(args.ylabel, "y"),
    grid: args.grid === undefined ? true : Boolean(args.grid),
    series,
    annotations,
    mode: "xy",
    ...(xMode ? { xMode } : {}),
    ...layout,
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
    const userYMin = parseNumber(args.y_min, NaN);
    const userYMax = parseNumber(args.y_max, NaN);
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
      yMin: Number.isFinite(userYMin) ? userYMin : 0,
      yMax: Number.isFinite(userYMax) ? userYMax : Math.max(1, ...bins.map((bin) => bin.count)) * 1.1,
    };
  }

  if (firstType === "box") {
    const groups = input.map((item, index) => buildBoxGroup((item && typeof item === "object") ? item as Record<string, unknown> : {}, index));
    const yValues = groups.flatMap((group) => [group.lowerWhisker, group.q1, group.median, group.q3, group.upperWhisker, ...group.outliers]);
    const userYMin = parseNumber(args.y_min, NaN);
    const userYMax = parseNumber(args.y_max, NaN);
    const autoYMin = Math.min(...yValues) - Math.max(1e-6, (Math.max(...yValues) - Math.min(...yValues)) * 0.1);
    const autoYMax = Math.max(...yValues) + Math.max(1e-6, (Math.max(...yValues) - Math.min(...yValues)) * 0.1);
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
      yMin: Number.isFinite(userYMin) ? userYMin : autoYMin,
      yMax: Number.isFinite(userYMax) ? userYMax : autoYMax,
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

  const hasBar = input.some((item) => {
    const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
    return record.type === "bar";
  });

  const series = input.map((item, index) => {
    const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
    let type: PlotSeriesType;
    if (record.type === "scatter") type = "scatter";
    else if (record.type === "line+scatter") type = "line+scatter";
    else if (record.type === "bar") type = "bar";
    else type = "line";

    const result: NormalizedSeries = {
      name: safeLabel(record.name, `Series ${index + 1}`),
      type,
      color: typeof record.color === "string" && record.color ? record.color : DEFAULT_PALETTE[index % DEFAULT_PALETTE.length],
      points: normalizePoints(Array.isArray(record.points) ? record.points as Array<[number, number]> : []),
    };

    // Error bars — support all ErrorInput forms
    const rawError = record.error;
    if (rawError !== undefined && rawError !== null) {
      if (typeof rawError === "number" && Number.isFinite(rawError as number)) {
        // Constant error — store in errorExt
        result.errorExt = rawError as number;
      } else if (Array.isArray(rawError)) {
        // Legacy symmetric array — store in error (backward compat) + also in errorExt
        const arr = (rawError as unknown[]).map((v) => Number(v)).filter(Number.isFinite);
        result.error = arr;
        result.errorExt = arr;
      } else if (typeof rawError === "object") {
        // Asymmetric { plus, minus }
        result.errorExt = rawError as ErrorInput;
      }
    }

    // Group / stack for bars
    if (typeof record.group === "string") result.group = record.group;
    if (typeof record.stack === "string") result.stack = record.stack;

    // Transform pipeline
    if (Array.isArray(record.transforms)) {
      result.transforms = (record.transforms as unknown[]).filter(
        (t): t is TransformSpec => t !== null && typeof t === "object" && "type" in t
      );
    }

    return result;
  });

  // Detect bar style
  const barStyle = hasBar ? (args.bar_style === "stacked" ? "stacked" as BarMode : "grouped" as BarMode) : undefined;
  const yScale = args.y_scale === "log" ? "log" as AxisScale : "linear" as AxisScale;

  // Apply transforms to each series and collect warnings
  const warnings: TransformWarning[] = [];
  const debug = (args.debug === true);

  // P4: large dataset guard
  const totalRawPoints = series.reduce((sum, s) => sum + (s.points?.length ?? 0), 0);
  const LARGE_DATASET = 5000;
  const hasDownsample = series.some(s => Array.isArray(s.transforms) && s.transforms.some((t: any) => t.type === "downsample"));
  if (totalRawPoints > LARGE_DATASET && !hasDownsample) {
    warnings.push({ type: "performance", message: "large dataset without downsampling may impact rendering", detail: { points: totalRawPoints } });
  }

  const { transformedSeries, allStages } = collectSeriesTransforms(series, warnings, debug);
  const transformedSpec: PlotSpec = {
    title: safeTitle(args.title, "Series Plot"),
    xlabel: safeLabel(args.xlabel, "x"),
    ylabel: safeLabel(args.ylabel, "y"),
    grid: args.grid === undefined ? true : Boolean(args.grid),
    series: transformedSeries,
    annotations,
    mode: hasBar ? "bar" : "xy",
    barStyle,
    yScale,
    ...calculateBounds(transformedSeries, annotations, barStyle, yScale),
    warnings: warnings.length > 0 ? warnings : undefined,
    debug: debug && allStages.length > 0 ? { stages: allStages } : undefined,
    transform_policy: (args.transform_policy === "strict" || args.transform_policy === "best-effort") ? args.transform_policy : undefined,
  };
  return transformedSpec;
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

/** Cell rect for a subplot */
export interface MultiPlotCell {
  row: number;
  col: number;
  x: number;        // SVG x of cell origin
  y: number;        // SVG y of cell origin
  width: number;
  height: number;
  spec: PlotSpec;   // normalized single-plot spec for this cell
}

/** Built multi-plot: cell rects + union domains if shared */
export interface MultiPlotResult {
  title: string;
  rows: number;
  cols: number;
  gap: number;
  sharedX: boolean;
  sharedY: boolean;
  cells: MultiPlotCell[];
  outerWidth: number;
  outerHeight: number;
}

function buildOneSubplot(args: Record<string, unknown>): PlotSpec {
  // Reuse buildSeriesPlot logic but strip the outer layout
  const input = ensureArray<unknown>(args.series);
  if (input.length === 0) throw new Error("subplot series is required");

  const hasBar = input.some((item) => {
    const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
    return record.type === "bar";
  });

  const series = input.map((item, index) => {
    const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
    let type: PlotSeriesType;
    if (record.type === "scatter") type = "scatter";
    else if (record.type === "line+scatter") type = "line+scatter";
    else if (record.type === "bar") type = "bar";
    else type = "line";

    const result: NormalizedSeries = {
      name: safeLabel(record.name, `Series ${index + 1}`),
      type,
      color: typeof record.color === "string" && record.color ? record.color : DEFAULT_PALETTE[index % DEFAULT_PALETTE.length],
      points: normalizePoints(Array.isArray(record.points) ? record.points as Array<[number, number]> : []),
    };

    const rawError = record.error;
    if (rawError !== undefined && rawError !== null) {
      if (typeof rawError === "number" && Number.isFinite(rawError as number)) {
        result.errorExt = rawError as number;
      } else if (Array.isArray(rawError)) {
        const arr = (rawError as unknown[]).map((v) => Number(v)).filter(Number.isFinite);
        result.error = arr;
        result.errorExt = arr;
      } else if (typeof rawError === "object") {
        result.errorExt = rawError as ErrorInput;
      }
    }

    if (typeof record.group === "string") result.group = record.group;
    if (typeof record.stack === "string") result.stack = record.stack;

    // Transform pipeline for subplot series
    if (Array.isArray(record.transforms)) {
      result.transforms = (record.transforms as unknown[]).filter(
        (t): t is TransformSpec => t !== null && typeof t === "object" && "type" in t
      );
    }

    return result;
  });

  const barStyle = hasBar ? (args.bar_style === "stacked" ? "stacked" as BarMode : "grouped" as BarMode) : undefined;
  const yScale = args.y_scale === "log" ? "log" as AxisScale : "linear" as AxisScale;

  // Apply transforms
  const warnings: string[] = [];
  const transformedSeries = series.map(s => applySeriesTransforms(s, warnings));

  return {
    title: safeTitle(args.title, ""),
    xlabel: safeLabel(args.xlabel, "x"),
    ylabel: safeLabel(args.ylabel, "y"),
    grid: true,
    series: transformedSeries,
    annotations: [],
    mode: hasBar ? "bar" : "xy",
    barStyle,
    yScale,
    ...calculateBounds(transformedSeries, [], barStyle, yScale),
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function buildSubplot(args: Record<string, unknown>): MultiPlotResult {
  const rows = Math.max(1, parseInteger(args.rows, 2));
  const cols = Math.max(1, parseInteger(args.cols, 2));
  const gap = Math.max(0, parseInteger(args.gap, 20));
  const sharedX = Boolean(args.sharedX);
  const sharedY = Boolean(args.sharedY);
  const rawPlots = ensureArray<unknown>(args.plots);

  // Constants for single-plot dimensions
  const OUTER_W = 800;
  const OUTER_H = 600;
  const MARGIN = 60;
  const CELL_W = Math.floor((OUTER_W - 2 * MARGIN - (cols - 1) * gap) / cols);
  const CELL_H = Math.floor((OUTER_H - 2 * MARGIN - (rows - 1) * gap) / rows);

  // Build each cell's spec
  const cells: MultiPlotCell[] = rawPlots.map((rawPlot, index) => {
    const plot = (rawPlot && typeof rawPlot === "object") ? rawPlot as Record<string, unknown> : {};
    const row = parseInteger(plot.row, Math.floor(index / cols));
    const col = parseInteger(plot.col, index % cols);
    const subArgs: Record<string, unknown> = {
      ...plot,
      title: plot.title,
      xlabel: plot.xlabel,
      ylabel: plot.ylabel,
      y_scale: plot.y_scale,
    };
    const spec = buildOneSubplot(subArgs);
    return {
      row, col,
      x: MARGIN + col * (CELL_W + gap),
      y: MARGIN + row * (CELL_H + gap),
      width: CELL_W,
      height: CELL_H,
      spec,
    };
  });

  // Compute union domains for shared axes
  if (sharedY) {
    const allYMin = Math.min(...cells.map((c) => c.spec.yMin));
    const allYMax = Math.max(...cells.map((c) => c.spec.yMax));
    for (const cell of cells) {
      cell.spec.yMin = allYMin;
      cell.spec.yMax = allYMax;
    }
  }
  if (sharedX) {
    const allXMin = Math.min(...cells.map((c) => c.spec.xMin));
    const allXMax = Math.max(...cells.map((c) => c.spec.xMax));
    for (const cell of cells) {
      cell.spec.xMin = allXMin;
      cell.spec.xMax = allXMax;
    }
  }

  return {
    title: safeTitle(args.title, "Multi Plot"),
    rows,
    cols,
    gap,
    sharedX,
    sharedY,
    cells,
    outerWidth: OUTER_W,
    outerHeight: OUTER_H,
  };
}
