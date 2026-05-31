export interface Env {
  SHORT_LINKS: KVNamespace;
}

export const SERVER_NAME = "plot-mcp-worker";
export const SERVER_VERSION = "0.4.5";
export const SHORT_LINK_PATH_PREFIX = "/s/";
export const SHORT_LINK_TOKEN_LENGTH = 8;
export const SHORT_LINK_TTL_SECONDS = 60 * 60 * 24 * 30;

export const MIN_POINTS = 10;
export const MAX_POINTS = 20000;
export const DEFAULT_POINTS = 1000;
export const MAX_EXPR_LENGTH = 400;
export const MAX_TITLE_LENGTH = 120;
export const MAX_LABEL_LENGTH = 80;
export const MAX_SERIES = 12;
export const MAX_MULTI_IMAGE_JOBS = 8;
export const MAX_FORCE_ITEMS = 16;
export const MAX_FORCE_BODIES = 8;
export const MAX_FORCE_SURFACES = 6;
export const MAX_FORCE_CONNECTORS = 10;
export const MAX_CIRCUIT_COMPONENTS = 24;
export const MAX_CIRCUIT_WIRES = 48;
export const MAX_CIRCUIT_LAYOUT_ITEMS = 12;
export const MAX_CIRCUIT_LAYOUT_BRANCHES = 4;
export const MAX_SURFACE_SAMPLES = 80;
export const MAX_3D_SURFACES = 6;
export const MAX_3D_LINES = 8;
export const MAX_3D_POINTS = 32;
export const MAX_3D_LINE_POINTS = 96;
export const DEFAULT_WIDTH = 1500;
export const DEFAULT_HEIGHT = 750;
export const DEFAULT_FONT_FAMILY = "sans-serif";
export const DEFAULT_FONT_SIZE = 20;
export const DEFAULT_BG = "#ffffff";
export const DEFAULT_AXIS = "#111827";
export const DEFAULT_GRID = "#d1d5db";
export const DEFAULT_PALETTE = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#db2777",
  "#4f46e5"
] as const;
