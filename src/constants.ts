export interface Env {
  SHORT_LINKS: KVNamespace;
}

export const SERVER_NAME = "plot-mcp-worker";
export const SERVER_VERSION = "0.4.6";
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
export const DEFAULT_BG = "safe-dark";
export const DEFAULT_AXIS = "#111827";
export const DEFAULT_GRID = "rgba(128,128,128,0.15)";
export const DEFAULT_PALETTE = [
  "#60a5fa",
  "#f87171",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#22d3ee",
  "#fb923c",
  "#f472b6"
] as const;
