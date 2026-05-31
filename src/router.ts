/**
 * Router: unified dispatch layer for canonical tool names.
 *
 * Phase 1 — delegates directly to the existing handleToolCall-style logic.
 * No internal logic changes to render.ts / plot.ts / extras.ts.
 */

import type { CanonicalToolName, RenderOutput, RenderFormat } from "./types";
import { applyCompat } from "./compat";

/**
 * Route a canonical (or compat-resolved) tool call.
 *
 * This is the single entry point that index.ts should call.
 * It resolves compat, then delegates to the legacy tool handler.
 */
export async function route(
  name: string,
  args: Record<string, unknown>,
  env: unknown,
  origin: string,
  legacyHandler: (name: string, args: Record<string, unknown>, env: unknown, origin: string) => Promise<{ ok: boolean; status: number; data: unknown }>,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const { canonicalName, args: resolvedArgs, mapping } = applyCompat(name, args);

  // For canonical names that map to multiple legacy tools,
  // we route to the appropriate legacy handler.
  const legacyName = resolveLegacyName(canonicalName, resolvedArgs);

  // Call through to the existing handler — zero logic duplication
  return legacyHandler(legacyName, args, env, origin);
}

/**
 * Given a canonical tool name + resolved args, pick the best legacy tool name
 * to delegate to. This keeps the existing handleToolCall switch working as-is.
 */
function resolveLegacyName(
  canonical: CanonicalToolName,
  args: Record<string, unknown>,
): string {
  const renderFormat = args.__render_format as RenderFormat | undefined;
  const diagramType = args.__diagram_type as string | undefined;
  const templateType = args.__template_type as string | undefined;
  const isBar = args.__bar as boolean | undefined;

  switch (canonical) {
    case "health":
      return "health";
    case "plot": {
      // If caller passed exprs (multi-plot via canonical), delegate to multi
      if (Array.isArray(args.exprs)) {
        if (renderFormat === "json") return "plot_multi_json";
        if (renderFormat === "link") return "plot_multi_png_link";
        return "plot_multi";
      }
      if (renderFormat === "json") return "plot_json";
      if (renderFormat === "link") return "plot_png_link";
      return "plot_json"; // default to json for canonical "plot"
    }
    case "plot_series": {
      if (isBar) return "plot_bar_json";
      if (renderFormat === "json") return "plot_series_json";
      if (renderFormat === "link") return "plot_series_png_link";
      return "plot_series_json";
    }
    case "diagram": {
      switch (diagramType) {
        case "force": return "force_diagram_link";
        case "force_analysis": return "force_analysis_link";
        case "circuit": return "circuit_diagram_link";
        case "venn": return "venn_diagram_link";
        case "c_memory": return "c_memory_diagram_link";
        default: return "force_diagram_link";
      }
    }
    case "geometry_3d":
      return "shape3d_link";
    case "teaching":
      return "teaching_template_link";
    case "template": {
      switch (templateType) {
        case "force_analysis": return "force_analysis_template_link";
        case "circuit": return "circuit_template_link";
        default: return "teaching_template_link";
      }
    }
    case "analysis":
      // Phase 1: no analysis tool yet, fall through to health
      return "health";
    default:
      return "health";
  }
}
