/**
 * Compat layer: maps legacy tool names to canonical tool + render opts.
 *
 * Phase 1 — pure mapping, no logic changes.
 */

import type { CanonicalToolName, RenderFormat } from "./types";

export interface CompatMapping {
  tool: CanonicalToolName;
  render?: { format: RenderFormat };
  diagram_type?: string;
  template_type?: string;
  /** If true, merge `exprs` into the canonical plot args */
  merge_exprs?: boolean;
  /** If true, this is a bar chart variant → set bar flag */
  bar?: boolean;
}

const COMPAT_TABLE: Record<string, CompatMapping> = {
  plot_json: { tool: "plot", render: { format: "json" } },
  plot_png_link: { tool: "plot", render: { format: "link" } },
  plot_multi: { tool: "plot", render: { format: "png" }, merge_exprs: true },
  plot_multi_json: { tool: "plot", render: { format: "json" }, merge_exprs: true },
  plot_multi_png_link: { tool: "plot", render: { format: "link" }, merge_exprs: true },
  plot_series_json: { tool: "plot_series", render: { format: "json" } },
  plot_series_png_link: { tool: "plot_series", render: { format: "link" } },
  plot_bar_json: { tool: "plot_series", bar: true, render: { format: "json" } },
  force_diagram_link: { tool: "diagram", diagram_type: "force", render: { format: "link" } },
  force_analysis_link: { tool: "diagram", diagram_type: "force_analysis", render: { format: "link" } },
  circuit_diagram_link: { tool: "diagram", diagram_type: "circuit", render: { format: "link" } },
  venn_diagram_link: { tool: "diagram", diagram_type: "venn", render: { format: "link" } },
  c_memory_diagram_link: { tool: "diagram", diagram_type: "c_memory", render: { format: "link" } },
  force_analysis_template_link: { tool: "template", template_type: "force_analysis" },
  circuit_template_link: { tool: "template", template_type: "circuit" },
  teaching_template_link: { tool: "teaching" },
  teaching_sequence_link: { tool: "teaching" },
  shape3d_link: { tool: "geometry_3d", render: { format: "link" } },
};

/**
 * Look up a legacy tool name. Returns null if not a legacy name
 * (i.e. it might be a canonical name already).
 */
export function lookupCompat(legacyName: string): CompatMapping | null {
  return COMPAT_TABLE[legacyName] ?? null;
}

/**
 * Apply compat mapping to args (e.g. merging exprs for multi-plot variants).
 * Returns the (possibly modified) args and the canonical tool name.
 */
export function applyCompat(
  name: string,
  args: Record<string, unknown>,
): { canonicalName: CanonicalToolName; args: Record<string, unknown>; mapping: CompatMapping | null } {
  const mapping = lookupCompat(name);
  if (!mapping) {
    // Already a canonical name or unknown — pass through
    return { canonicalName: name as CanonicalToolName, args, mapping: null };
  }

  let patched = { ...args };

  // Merge render opts into args so router can see them
  if (mapping.render) {
    patched.__render_format = mapping.render.format;
  }
  if (mapping.diagram_type) {
    patched.__diagram_type = mapping.diagram_type;
  }
  if (mapping.template_type) {
    patched.__template_type = mapping.template_type;
  }
  if (mapping.bar) {
    patched.__bar = true;
  }

  return { canonicalName: mapping.tool, args: patched, mapping };
}
