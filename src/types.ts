/**
 * Core type definitions for the unified plot-mcp-worker.
 *
 * FROZEN INTERFACE — do not change without updating all consumers.
 */

// ── Render output ──

export type RenderFormat = "png" | "svg" | "json" | "link" | "html";

export interface RenderOpts {
  format?: RenderFormat; // default varies by tool
}

export interface RenderOutput {
  format: RenderFormat;
  data?: string;  // base64 png / svg string / json string / html string
  url?: string;   // link format: hosted URL
}

// ── Plot data types ──

export interface PlotPoint {
  x: number;
  y: number;
}

export interface PlotSeriesBase {
  name: string;
  color?: string;
}

export interface LineSeries extends PlotSeriesBase {
  type: "line";
  points: PlotPoint[];
}

export interface ScatterSeries extends PlotSeriesBase {
  type: "scatter";
  points: PlotPoint[];
}

export interface HistSeries extends PlotSeriesBase {
  type: "hist";
  data: number[];
  bins?: number;
}

export interface BoxSeries extends PlotSeriesBase {
  type: "box";
  data: number[];
}

export interface PieSeries extends PlotSeriesBase {
  type: "pie";
  labels: string[];
  values: number[];
}

export type PlotSeries = LineSeries | ScatterSeries | HistSeries | BoxSeries | PieSeries;

// ── Tool names (canonical) ──

export type CanonicalToolName =
  | "health"
  | "plot"
  | "plot_series"
  | "diagram"
  | "geometry_3d"
  | "teaching"
  | "template"
  | "analysis";

// ── Diagram sub-types ──

export type DiagramType = "force" | "force_analysis" | "circuit" | "venn" | "c_memory";

// ── Analysis sub-types ──

export type AnalysisAction = "describe" | "corr" | "groupby";

// ── Geometry 3D sub-types ──

export type Geometry3DKind = "shape" | "scatter3d" | "line3d" | "surface3d";

// ── Multi-plot / subplot layout ─────────────────────────────────────────────

export interface MultiPlotSpec {
  rows: number;
  cols: number;
  gap?: number;       // pixel gap between cells (default 20)
  sharedX?: boolean;   // share same x-axis domain across all subplots
  sharedY?: boolean;   // share same y-axis domain across all subplots
  plots: SubplotSpec[];
}

export interface SubplotSpec {
  row: number;         // 0-indexed row
  col: number;         // 0-indexed column
  title?: string;
  series: PlotSeries[];
  xlabel?: string;
  ylabel?: string;
  y_scale?: AxisScale;
}

// ── Tool input contract ──

export interface ToolInput {
  /** Canonical or legacy tool name */
  name: string;
  /** Tool-specific parameters */
  arguments: Record<string, unknown>;
  /** Output control — optional, defaults vary by tool */
  render?: {
    format?: RenderFormat;
  };
}

// ── Stats results ──

export interface DescribeResult {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
  q1: number;
  q3: number;
}

export interface CorrResult {
  labels: string[];
  matrix: number[][];
}
