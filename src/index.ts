import { MAX_3D_LINE_POINTS, MAX_3D_LINES, MAX_3D_POINTS, MAX_3D_SURFACES, MAX_CIRCUIT_COMPONENTS, MAX_CIRCUIT_LAYOUT_BRANCHES, MAX_CIRCUIT_LAYOUT_ITEMS, MAX_CIRCUIT_WIRES, MAX_EXPR_LENGTH, MAX_FORCE_BODIES, MAX_FORCE_CONNECTORS, MAX_FORCE_ITEMS, MAX_FORCE_SURFACES, MAX_MULTI_IMAGE_JOBS, MAX_SURFACE_SAMPLES, Env, MAX_LABEL_LENGTH, MAX_SERIES, MAX_TITLE_LENGTH, SERVER_NAME, SERVER_VERSION, SHORT_LINK_PATH_PREFIX, SHORT_LINK_TOKEN_LENGTH, SHORT_LINK_TTL_SECONDS } from "./constants";
import { analyzeData, buildBarChart, buildMultiPlot, buildSeriesPlot, buildSinglePlot, buildSubplot, MultiPlotResult, PlotSpec } from "./plot";
import { corsHeaders, jsonRpc, jsonRpcError, toolResultPayload } from "./mcp";
import { renderCircuitDiagramSvg, renderCMemoryDiagramSvg, renderForceAnalysisSvg, renderForceDiagramSvg, renderShape3DHtml, renderVennDiagramSvg, placeBodyOnSurface } from "./extras";
import { renderPlotSvg, renderPngResponse, renderSpecToSvg, renderMultiPlotSvg } from "./render";
import { clamp, ensureArray, limitText, parseCompressedBase64UrlJson, parseInteger, parseNumber, toCompressedBase64UrlFromJson } from "./utils";
import { lookupCompat } from "./compat";
import { route } from "./router";

const pointSchema = {
  anyOf: [
    {
      type: "array",
      items: { type: "number" },
      minItems: 2,
      maxItems: 2,
    },
    {
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
      },
      required: ["x", "y"],
      additionalProperties: false,
    },
  ],
} as const;

const plotSeriesItemSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    type: { type: "string", enum: ["line", "scatter", "line+scatter", "hist", "box", "pie"] },
    color: { type: "string" },
    points: {
      type: "array",
      items: pointSchema,
      minItems: 1,
    },
    data: { type: "array", items: { type: "number" }, description: "Raw data array for hist/box" },
    bins: { type: "integer", description: "Number of bins for histogram" },
    labels: { type: "array", items: { type: "string" }, description: "Labels for pie chart" },
    values: { type: "array", items: { type: "number" }, description: "Values for pie chart" },
  },
  additionalProperties: false,
} as const;

const piecewiseSegmentSchema = {
  type: "object",
  properties: {
    expr: { type: "string" },
    x_min: { type: "number" },
    x_max: { type: "number" },
    label: { type: "string" },
    name: { type: "string" },
    color: { type: "string" },
  },
  required: ["expr", "x_min", "x_max"],
  additionalProperties: false,
} as const;

const plotAnnotationSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["vertical_line", "point", "label", "area"] },
    type: { type: "string", enum: ["vertical_line", "point", "label", "area"] },
    x: { type: "number" },
    y: { type: "number" },
    x_min: { type: "number" },
    x_max: { type: "number" },
    label: { type: "string" },
    text: { type: "string" },
    color: { type: "string" },
    opacity: { type: "number" },
  },
  additionalProperties: false,
} as const;

const teachingParamsSchema = {
  type: "object",
  additionalProperties: true,
} as const;

const teachingToolProperties = {
  topic: { type: "string", enum: ["parabola", "definite_integral", "tangent_derivative", "fourier_series", "projectile_motion", "simple_harmonic_motion", "energy_conservation", "rc_charging", "rlc_transient", "incline_force", "stress_strain", "band_gap", "venn_probability", "c_pointer_array", "c_struct_layout"] },
  level: { type: "string", enum: ["intro", "college"], default: "college" },
  title: { type: "string" },
  params: teachingParamsSchema,
  steps: { type: "boolean", default: false },
  highlight: { type: "boolean", default: true },
} as const;

const forceItemSchema = {
  type: "object",
  properties: {
    label: { type: "string" },
    angle_deg: { type: "number" },
    magnitude: { type: "number" },
    color: { type: "string" },
  },
  required: ["angle_deg", "magnitude"],
  additionalProperties: false,
} as const;

const circuitComponentSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    x: { type: "number" },
    y: { type: "number" },
    label: { type: "string" },
    type: { type: "string", enum: ["node", "battery", "source", "current_source", "voltage_source", "resistor", "capacitor", "inductor", "switch", "diode", "led", "ammeter", "voltmeter", "transistor", "relay", "buzzer", "opamp", "pulley", "lamp", "load", "ground"] },
    orientation: { type: "string", enum: ["horizontal", "vertical"] },
    color: { type: "string" },
  },
  required: ["type"],
  additionalProperties: false,
} as const;

const circuitWireSchema = {
  type: "object",
  properties: {
    x1: { type: "number" },
    y1: { type: "number" },
    x2: { type: "number" },
    y2: { type: "number" },
    label: { type: "string" },
  },
  required: ["x1", "y1", "x2", "y2"],
  additionalProperties: false,
} as const;

const circuitLayoutItemSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    type: { type: "string", enum: ["battery", "source", "current_source", "voltage_source", "resistor", "capacitor", "inductor", "switch", "diode", "led", "ammeter", "voltmeter", "transistor", "relay", "buzzer", "opamp", "lamp", "load", "ground"] },
    label: { type: "string" },
    orientation: { type: "string", enum: ["horizontal", "vertical"] },
    color: { type: "string" },
  },
  required: ["type"],
  additionalProperties: false,
} as const;

const circuitBranchSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: circuitLayoutItemSchema,
      minItems: 1,
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

const vennSetSchema = {
  type: "object",
  properties: {
    label: { type: "string" },
    color: { type: "string" },
  },
  additionalProperties: false,
} as const;

const vennRegionsSchema = {
  type: "object",
  properties: {
    A_only: { type: "string" },
    B_only: { type: "string" },
    C_only: { type: "string" },
    A_B: { type: "string" },
    A_C: { type: "string" },
    B_C: { type: "string" },
    A_B_C: { type: "string" },
    outside: { type: "string" },
  },
  additionalProperties: false,
} as const;

const cMemoryBlockSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    type: { type: "string" },
    value: { type: "string" },
    address: { type: "string" },
    bytes: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
    note: { type: "string" },
  },
  additionalProperties: false,
} as const;

const circuitStageSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["series", "parallel"] },
    items: { type: "array", items: circuitLayoutItemSchema, minItems: 1 },
    branches: { type: "array", items: circuitBranchSchema, minItems: 1 },
  },
  required: ["kind"],
  additionalProperties: false,
} as const;

const multiImageJobSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["plot", "plot_multi", "plot_series", "plot_bar"] },
    expr: { type: "string" },
    exprs: { type: "array", items: { type: "string" } },
    labels: { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] },
    series: { type: "array", items: plotSeriesItemSchema },
    categories: { type: "array", items: { type: "string" } },
    values: { type: "array", items: { type: "number" } },
    series_name: { type: "string" },
    x_min: { type: "number" },
    x_max: { type: "number" },
    points: { type: "integer" },
    title: { type: "string" },
    xlabel: { type: "string" },
    ylabel: { type: "string" },
    grid: { type: "boolean" },
  },
  additionalProperties: false,
} as const;

const shape3dPointSchema = {
  anyOf: [
    {
      type: "array",
      items: { type: "number" },
      minItems: 3,
      maxItems: 3,
    },
    {
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        z: { type: "number" },
        label: { type: "string" },
      },
      required: ["x", "y", "z"],
      additionalProperties: false,
    },
  ],
} as const;

const shape3dSurfaceSchema = {
  type: "object",
  properties: {
    expr: { type: "string" },
    label: { type: "string" },
    color: { type: "string" },
    colorscale: { type: "string", enum: ["Viridis", "Cividis", "Turbo", "Jet", "Plasma"] },
    show_scale: { type: "boolean" },
    show_contours: { type: "boolean" },
    x_min: { type: "number" },
    x_max: { type: "number" },
    y_min: { type: "number" },
    y_max: { type: "number" },
    z_min: { type: "number" },
    z_max: { type: "number" },
    samples: { type: "integer" },
    opacity: { type: "number" },
  },
  required: ["expr"],
  additionalProperties: false,
} as const;

const shape3dLineSchema = {
  type: "object",
  properties: {
    label: { type: "string" },
    color: { type: "string" },
    width: { type: "number" },
    points: {
      type: "array",
      items: shape3dPointSchema,
      minItems: 2,
    },
  },
  required: ["points"],
  additionalProperties: false,
} as const;

const shape3dPointsSchema = {
  type: "object",
  properties: {
    label: { type: "string" },
    color: { type: "string" },
    size: { type: "number" },
    labels: { type: "boolean" },
    points: {
      type: "array",
      items: shape3dPointSchema,
      minItems: 1,
    },
  },
  required: ["points"],
  additionalProperties: false,
} as const;

const shape3dSchema = {
  type: "object",
  properties: {
    shape: { type: "string", enum: ["cube", "sphere", "cylinder", "cone", "vector3d", "surface3d"], default: "cube" },
    title: { type: "string", default: "3D Shape" },
    size: { type: "number", default: 1 },
    radius: { type: "number", default: 1 },
    height: { type: "number", default: 2 },
    vector: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 },
    color: { type: "string", default: "#4f46e5" },
    expr: { type: "string" },
    x_min: { type: "number", default: -3 },
    x_max: { type: "number", default: 3 },
    y_min: { type: "number", default: -3 },
    y_max: { type: "number", default: 3 },
    samples: { type: "integer", default: 36 },
    colorscale: { type: "string", enum: ["Viridis", "Cividis", "Turbo", "Jet", "Plasma"], default: "Viridis" },
    show_scale: { type: "boolean", default: true },
    show_contours: { type: "boolean", default: false },
    z_min: { type: "number" },
    z_max: { type: "number" },
    surfaces: { type: "array", items: shape3dSurfaceSchema, minItems: 1 },
    lines: { type: "array", items: shape3dLineSchema, minItems: 1 },
    points: {
      anyOf: [
        { type: "array", items: shape3dPointSchema, minItems: 1 },
        { type: "array", items: shape3dPointsSchema, minItems: 1 },
      ],
    },
  },
  additionalProperties: false,
} as const;

const TOOLS = [
  {
    name: "health",
    description: "Check rebuilt Plot MCP health status.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "plot",
    description: "Plot a single expression and return PNG data.",
    inputSchema: {
      type: "object",
      properties: { expr: { type: "string" }, pieces: { type: "array", items: piecewiseSegmentSchema, minItems: 1 }, x_min: { type: "number", default: -10 }, x_max: { type: "number", default: 10 }, points: { type: "integer", default: 1000 } },
      additionalProperties: false,
    },
  },
  {
    name: "plot_json",
    description: "Plot a single expression and return PNG/base64 payload.",
    inputSchema: {
      type: "object",
      properties: { expr: { type: "string" }, pieces: { type: "array", items: piecewiseSegmentSchema, minItems: 1 }, x_min: { type: "number", default: -10 }, x_max: { type: "number", default: 10 }, points: { type: "integer", default: 1000 }, title: { type: "string" }, xlabel: { type: "string" }, ylabel: { type: "string" }, annotations: { type: "array", items: plotAnnotationSchema } },
      additionalProperties: false,
    },
  },
  {
    name: "plot_png_link",
    description: "Generate a direct PNG URL for a single-expression plot.",
    inputSchema: {
      type: "object",
      properties: { expr: { type: "string" }, pieces: { type: "array", items: piecewiseSegmentSchema, minItems: 1 }, x_min: { type: "number", default: -10 }, x_max: { type: "number", default: 10 }, points: { type: "integer", default: 1000 }, title: { type: "string" }, xlabel: { type: "string" }, ylabel: { type: "string" }, annotations: { type: "array", items: plotAnnotationSchema } },
      additionalProperties: false,
    },
  },
  {
    name: "plot_multi",
    description: "Plot multiple expressions on one chart.",
    inputSchema: {
      type: "object",
      properties: { exprs: { type: "array", items: { type: "string" } }, labels: { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] }, x_min: { type: "number", default: -10 }, x_max: { type: "number", default: 10 }, points: { type: "integer", default: 1000 }, title: { type: "string" }, xlabel: { type: "string" }, ylabel: { type: "string" }, annotations: { type: "array", items: plotAnnotationSchema } },
      required: ["exprs"], additionalProperties: false,
    },
  },
  {
    name: "plot_multi_json",
    description: "Plot multiple expressions and return PNG/base64 payload.",
    inputSchema: {
      type: "object",
      properties: { exprs: { type: "array", items: { type: "string" } }, labels: { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] }, x_min: { type: "number", default: -10 }, x_max: { type: "number", default: 10 }, points: { type: "integer", default: 1000 }, title: { type: "string" }, xlabel: { type: "string" }, ylabel: { type: "string" }, annotations: { type: "array", items: plotAnnotationSchema } },
      required: ["exprs"], additionalProperties: false,
    },
  },
  {
    name: "plot_multi_png_link",
    description: "Generate a direct PNG URL for a multi-expression plot.",
    inputSchema: {
      type: "object",
      properties: { exprs: { type: "array", items: { type: "string" } }, labels: { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] }, x_min: { type: "number", default: -10 }, x_max: { type: "number", default: 10 }, points: { type: "integer", default: 1000 }, title: { type: "string" }, xlabel: { type: "string" }, ylabel: { type: "string" }, annotations: { type: "array", items: plotAnnotationSchema } },
      required: ["exprs"], additionalProperties: false,
    },
  },
  {
    name: "multi_plot",
    description: "Multi-panel subplot layout with rows, cols, shared axes, and per-cell series.",
    inputSchema: {
      type: "object",
      properties: {
        rows: { type: "integer", default: 2, description: "Number of rows" },
        cols: { type: "integer", default: 2, description: "Number of columns" },
        gap: { type: "integer", default: 20, description: "Pixel gap between cells" },
        sharedX: { type: "boolean", default: false, description: "Share same x-axis domain across all subplots" },
        sharedY: { type: "boolean", default: false, description: "Share same y-axis domain across all subplots" },
        title: { type: "string", description: "Overall title" },
        plots: {
          type: "array",
          items: {
            type: "object",
            properties: {
              row: { type: "integer" },
              col: { type: "integer" },
              title: { type: "string" },
              xlabel: { type: "string" },
              ylabel: { type: "string" },
              y_scale: { type: "string", enum: ["linear", "log"] },
              series: { type: "array", items: plotSeriesItemSchema, minItems: 1 },
            },
            required: ["series"],
          },
        },
      },
      required: ["plots"],
      additionalProperties: false,
    },
  },
  {
    name: "plot_series",
    description: "Plot custom point series.",
    inputSchema: {
      type: "object",
      properties: { series: { type: "array", items: plotSeriesItemSchema, minItems: 1 }, title: { type: "string" }, xlabel: { type: "string" }, ylabel: { type: "string" }, grid: { type: "boolean", default: true }, annotations: { type: "array", items: plotAnnotationSchema } },
      required: ["series"], additionalProperties: false,
    },
  },
  {
    name: "plot_series_json",
    description: "Plot custom point series and return PNG/base64 payload.",
    inputSchema: {
      type: "object",
      properties: { series: { type: "array", items: plotSeriesItemSchema, minItems: 1 }, title: { type: "string" }, xlabel: { type: "string" }, ylabel: { type: "string" }, grid: { type: "boolean", default: true }, annotations: { type: "array", items: plotAnnotationSchema } },
      required: ["series"], additionalProperties: false,
    },
  },
  {
    name: "plot_series_png_link",
    description: "Generate a direct PNG URL for a custom series plot.",
    inputSchema: {
      type: "object",
      properties: { series: { type: "array", items: plotSeriesItemSchema, minItems: 1 }, title: { type: "string" }, xlabel: { type: "string" }, ylabel: { type: "string" }, grid: { type: "boolean", default: true }, annotations: { type: "array", items: plotAnnotationSchema } },
      required: ["series"], additionalProperties: false,
    },
  },
  {
    name: "force_diagram_link",
    description: "Generate a direct SVG link for a 2D physics free-body / force analysis diagram.",
    inputSchema: {
      type: "object",
      properties: { body_label: { type: "string", default: "m" }, forces: { type: "array", items: forceItemSchema, minItems: 1 }, show_components: { type: "boolean", default: false } },
      required: ["forces"], additionalProperties: false,
    },
  },
  {
    name: "force_analysis_link",
    description: "Generate a richer SVG link for mechanics force analysis with axes, components, resultant, and incline context.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        body_label: { type: "string", default: "m" },
        forces: { type: "array", items: forceItemSchema, minItems: 1 },
        show_components: { type: "boolean", default: true },
        show_axes: { type: "boolean", default: true },
        show_resultant: { type: "boolean", default: true },
        show_angle_labels: { type: "boolean", default: false },
        incline_deg: { type: "number", default: 0 }
      },
      required: ["forces"], additionalProperties: false,
    },
  },
  {
    name: "circuit_diagram_link",
    description: "Generate a direct SVG link for a simple circuit schematic diagram with batteries, voltage/current sources, and common teaching components.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        components: { type: "array", items: circuitComponentSchema, minItems: 1 },
        wires: { type: "array", items: circuitWireSchema, minItems: 1 },
        stages: { type: "array", items: circuitStageSchema, minItems: 1 },
        row: { type: "array", items: circuitLayoutItemSchema, minItems: 1 },
        branches: { type: "array", items: circuitBranchSchema, minItems: 1 },
        return_path: { type: "array", items: circuitLayoutItemSchema, minItems: 1 },
        source_label: { type: "string" },
        notes: { type: "array", items: { type: "string" } }
      },
      additionalProperties: false,
    },
  },
  {
    name: "force_analysis_template_link",
    description: "Generate a force-analysis SVG from a common mechanics template like incline, hanging mass, or horizontal surface.",
    inputSchema: {
      type: "object",
      properties: {
        template: { type: "string", enum: ["incline", "hanging", "horizontal", "pulley", "spring", "double_block", "pulley_group", "spring_oscillator"], default: "horizontal" },
        title: { type: "string" },
        body_label: { type: "string" },
        incline_deg: { type: "number", default: 30 },
        weight: { type: "number", default: 3 },
        normal: { type: "number" },
        friction: { type: "number", default: 0 },
        pull: { type: "number", default: 0 },
        tension: { type: "number", default: 0 },
        show_components: { type: "boolean", default: true },
        show_axes: { type: "boolean", default: true },
        show_resultant: { type: "boolean", default: true },
        show_angle_labels: { type: "boolean", default: false }
      },
      additionalProperties: false,
    },
  },
  {
    name: "circuit_template_link",
    description: "Generate a circuit SVG from a common teaching template like series, parallel, switched lamp, or source/meter examples.",
    inputSchema: {
      type: "object",
      properties: {
        template: { type: "string", enum: ["series", "parallel", "switch_lamp", "source_resistor", "led_resistor", "meter_loop", "transistor_switch", "relay_driver", "buzzer_loop", "opamp_follower"], default: "series" },
        title: { type: "string" },
        source_label: { type: "string" },
        resistor_label: { type: "string" },
        resistor_label_2: { type: "string" },
        lamp_label: { type: "string" },
        switch_label: { type: "string" },
        notes: { type: "array", items: { type: "string" } }
      },
      additionalProperties: false,
    },
  },
  {
    name: "venn_diagram_link",
    description: "Generate a direct SVG link for a 2-set or 3-set Venn diagram used in probability and set problems.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        sets: { type: "array", items: vennSetSchema, minItems: 2, maxItems: 3 },
        regions: vennRegionsSchema,
      },
      additionalProperties: false,
    },
  },
  {
    name: "c_memory_diagram_link",
    description: "Generate a direct SVG link for a C-language memory layout or pointer teaching diagram.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        blocks: { type: "array", items: cMemoryBlockSchema, minItems: 1 },
      },
      required: ["blocks"],
      additionalProperties: false,
    },
  },
  {
    name: "shape3d_link",    description: "Generate a direct HTML link for an interactive 3D geometric shape viewer.",
    inputSchema: shape3dSchema,
  },
  {
    name: "plot_bar_json",
    description: "Render a bar chart and return PNG/base64 payload.",
    inputSchema: {
      type: "object",
      properties: { categories: { type: "array", items: { type: "string" } }, values: { type: "array", items: { type: "number" } }, title: { type: "string" }, xlabel: { type: "string" }, ylabel: { type: "string" } },
      required: ["categories", "values"], additionalProperties: false,
    },
  },
  {
    name: "teaching_template_link",
    description: "Generate a teaching-oriented STEM visualization from a high-level template with annotations and highlights.",
    inputSchema: {
      type: "object",
      properties: teachingToolProperties,
      required: ["topic"],
      additionalProperties: false,
    },
  },
  {
    name: "teaching_sequence_link",
    description: "Generate a coordinated multi-figure teaching sequence for university STEM explanations.",
    inputSchema: {
      type: "object",
      properties: teachingToolProperties,
      required: ["topic"],
      additionalProperties: false,
    },
  },
  // ── Canonical tools (Phase 1) ──
  // Note: "plot" uses the legacy "plot" name above — canonical routing handles exprs/render via resolveCanonicalToLegacy
  {
    name: "plot_series",
    description: "Plot custom point series (line/scatter). Use render.format to control output. Pass categories+values for bar charts.",
    inputSchema: {
      type: "object",
      properties: {
        series: { type: "array", items: plotSeriesItemSchema, minItems: 1 },
        categories: { type: "array", items: { type: "string" } },
        values: { type: "array", items: { type: "number" } },
        series_name: { type: "string" },
        title: { type: "string" },
        xlabel: { type: "string" },
        ylabel: { type: "string" },
        grid: { type: "boolean", default: true },
        annotations: { type: "array", items: plotAnnotationSchema },
        render: { type: "object", properties: { format: { type: "string", enum: ["png", "svg", "json", "link", "html"] } }, additionalProperties: false },
      },
      additionalProperties: false,
    },
  },
  {
    name: "diagram",
    description: "Generate a diagram (force, circuit, venn, C memory). Pass diagram_type to select. Use render.format to control output.",
    inputSchema: {
      type: "object",
      properties: {
        diagram_type: { type: "string", enum: ["force", "force_analysis", "circuit", "venn", "c_memory"] },
        title: { type: "string" },
        forces: { type: "array", items: forceItemSchema },
        body_label: { type: "string" },
        show_components: { type: "boolean" },
        show_axes: { type: "boolean" },
        show_resultant: { type: "boolean" },
        show_angle_labels: { type: "boolean" },
        incline_deg: { type: "number" },
        components: { type: "array", items: circuitComponentSchema },
        wires: { type: "array", items: circuitWireSchema },
        stages: { type: "array", items: circuitStageSchema },
        sets: { type: "array", items: vennSetSchema },
        regions: vennRegionsSchema,
        blocks: { type: "array", items: cMemoryBlockSchema },
        render: { type: "object", properties: { format: { type: "string", enum: ["png", "svg", "json", "link", "html"] } }, additionalProperties: false },
      },
      additionalProperties: false,
    },
  },
  {
    name: "geometry_3d",
    description: "Generate an interactive 3D geometric shape viewer. Use render.format to control output.",
    inputSchema: {
      type: "object",
      properties: {
        ...shape3dSchema.properties,
        render: { type: "object", properties: { format: { type: "string", enum: ["png", "svg", "json", "link", "html"] } }, additionalProperties: false },
      },
      additionalProperties: false,
    },
  },
  {
    name: "teaching",
    description: "Generate a teaching-oriented STEM visualization or multi-figure sequence.",
    inputSchema: {
      type: "object",
      properties: {
        ...teachingToolProperties,
        sequence: { type: "boolean", default: false, description: "If true, generate a multi-step sequence" },
        render: { type: "object", properties: { format: { type: "string", enum: ["png", "svg", "json", "link", "html"] } }, additionalProperties: false },
      },
      required: ["topic"],
      additionalProperties: false,
    },
  },
  {
    name: "template",
    description: "Generate a diagram from a common teaching template (force analysis, circuit).",
    inputSchema: {
      type: "object",
      properties: {
        template_type: { type: "string", enum: ["force_analysis", "circuit"], description: "Which template family" },
        template: { type: "string", description: "Specific template name (e.g. incline, parallel)" },
        title: { type: "string" },
        render: { type: "object", properties: { format: { type: "string", enum: ["png", "svg", "json", "link", "html"] } }, additionalProperties: false },
      },
      additionalProperties: false,
    },
  },
  {
    name: "analysis",
    description: "Statistical analysis and data summaries. (Phase 1: placeholder — not yet wired.)",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["describe", "corr", "groupby"] },
        data: { type: "array", items: { type: "number" } },
        render: { type: "object", properties: { format: { type: "string", enum: ["png", "svg", "json", "link", "html"] } }, additionalProperties: false },
      },
      additionalProperties: false,
    },
  },
];

function healthResult(origin: string) {
  return {
    ok: true,
    name: SERVER_NAME,
    version: SERVER_VERSION,
    mcp_endpoint: `${origin}/mcp`,
    png_endpoint: `${origin}/png?d=<base64url-json>`,
    short_link_endpoint: `${origin}${SHORT_LINK_PATH_PREFIX}<token>`,
    tools: TOOLS.map((tool) => tool.name),
  };
}

function normalizeForceItem(item: unknown, index: number) {
  const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
  return {
    label: limitText(record.label, `F${index + 1}`, MAX_LABEL_LENGTH),
    angle_deg: parseNumber(record.angle_deg, 0),
    magnitude: Math.max(0.1, parseNumber(record.magnitude, 1)),
    color: limitText(record.color, "#2563eb", 32),
  };
}

function normalizeForceBody(item: unknown, index: number) {
  const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
  const forces = ensureArray<unknown>(record.forces).slice(0, MAX_FORCE_ITEMS).map((force, forceIndex) => normalizeForceItem(force, forceIndex));
  return {
    id: limitText(record.id, `body${index + 1}`, MAX_LABEL_LENGTH),
    label: limitText(record.label, index === 0 ? "m" : `m${index + 1}`, MAX_LABEL_LENGTH),
    kind: limitText(record.kind, "block", 24),
    x: parseNumber(record.x, 0),
    y: parseNumber(record.y, 0),
    width: Math.max(24, parseNumber(record.width, 72)),
    height: Math.max(24, parseNumber(record.height, 48)),
    radius: Math.max(12, parseNumber(record.radius, 22)),
    angle_deg: parseNumber(record.angle_deg, 0),
    forces,
  };
}

function normalizeForceSurface(item: unknown, index: number) {
  const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
  return {
    id: limitText(record.id, `surface${index + 1}`, MAX_LABEL_LENGTH),
    kind: limitText(record.kind, "ground", 24),
    x1: parseNumber(record.x1, 80),
    y1: parseNumber(record.y1, 340),
    x2: parseNumber(record.x2, 560),
    y2: parseNumber(record.y2, 340),
    label: limitText(record.label, "", MAX_LABEL_LENGTH),
  };
}

function normalizeForceConnector(item: unknown, index: number) {
  const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
  return {
    id: limitText(record.id, `connector${index + 1}`, MAX_LABEL_LENGTH),
    kind: limitText(record.kind, "rope", 24),
    x1: parseNumber(record.x1, 0),
    y1: parseNumber(record.y1, 0),
    x2: parseNumber(record.x2, 0),
    y2: parseNumber(record.y2, 0),
    label: limitText(record.label, "", MAX_LABEL_LENGTH),
  };
}

function sanitizeVennPayload(args: Record<string, unknown>) {
  const sets = ensureArray<unknown>(args.sets).slice(0, 3).map((item, index) => {
    const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
    return {
      label: limitText(record.label, String.fromCharCode(65 + index), MAX_LABEL_LENGTH),
      color: limitText(record.color, "", 32),
    };
  });
  if (sets.length < 2) throw new Error("sets requires 2 or 3 items");
  const rawRegions = (args.regions && typeof args.regions === "object") ? args.regions as Record<string, unknown> : {};
  return {
    title: limitText(args.title, "Venn diagram", MAX_TITLE_LENGTH),
    sets,
    regions: {
      A_only: limitText(rawRegions.A_only, "", MAX_LABEL_LENGTH),
      B_only: limitText(rawRegions.B_only, "", MAX_LABEL_LENGTH),
      C_only: limitText(rawRegions.C_only, "", MAX_LABEL_LENGTH),
      A_B: limitText(rawRegions.A_B, "", MAX_LABEL_LENGTH),
      A_C: limitText(rawRegions.A_C, "", MAX_LABEL_LENGTH),
      B_C: limitText(rawRegions.B_C, "", MAX_LABEL_LENGTH),
      A_B_C: limitText(rawRegions.A_B_C, "", MAX_LABEL_LENGTH),
      outside: limitText(rawRegions.outside, "", MAX_LABEL_LENGTH),
    },
  };
}

function sanitizeCMemoryPayload(args: Record<string, unknown>) {
  const blocks = ensureArray<unknown>(args.blocks).map((item, index) => {
    const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
    return {
      name: limitText(record.name, `slot_${index}`, MAX_LABEL_LENGTH),
      type: limitText(record.type, "", MAX_LABEL_LENGTH),
      value: limitText(record.value, "", MAX_LABEL_LENGTH),
      address: limitText(record.address, `0x${(4096 + index * 4).toString(16)}`, MAX_LABEL_LENGTH),
      bytes: ensureArray<unknown>(record.bytes).slice(0, 8).map((byte) => limitText(byte, "", 8)),
      note: limitText(record.note, "", MAX_LABEL_LENGTH * 2),
    };
  }).filter((block) => block.name || block.value || block.type || block.bytes.length > 0);
  if (blocks.length === 0) throw new Error("blocks is required");
  return {
    title: limitText(args.title, "C memory layout", MAX_TITLE_LENGTH),
    blocks,
  };
}

function sanitizeForcePayload(args: Record<string, unknown>) {
  const bodiesInput = ensureArray<unknown>(args.bodies).slice(0, MAX_FORCE_BODIES);
  const bodies = bodiesInput.length > 0
    ? bodiesInput.map((item, index) => normalizeForceBody(item, index))
    : [{
        id: "body1",
        label: limitText(args.body_label, "m", MAX_LABEL_LENGTH),
        kind: "particle",
        x: 0,
        y: 0,
        width: 48,
        height: 48,
        radius: 22,
        angle_deg: 0,
        forces: ensureArray<unknown>(args.forces).slice(0, MAX_FORCE_ITEMS).map((item, index) => ({
          ...normalizeForceItem(item, index),
          color: limitText((item && typeof item === "object") ? (item as Record<string, unknown>).color : undefined, "#d22", 32),
        })),
      }];
  const primaryBody = bodies.find((body) => body.forces.length > 0) || bodies[0];
  if (!primaryBody || primaryBody.forces.length === 0) throw new Error("forces is required");
  return {
    body_label: primaryBody.label,
    forces: primaryBody.forces,
    show_components: Boolean(args.show_components),
    bodies,
  };
}

function sanitizeForceAnalysisPayload(args: Record<string, unknown>) {
  const bodiesInput = ensureArray<unknown>(args.bodies).slice(0, MAX_FORCE_BODIES);
  const surfaces = ensureArray<unknown>(args.surfaces).slice(0, MAX_FORCE_SURFACES).map((item, index) => normalizeForceSurface(item, index));
  const connectors = ensureArray<unknown>(args.connectors).slice(0, MAX_FORCE_CONNECTORS).map((item, index) => normalizeForceConnector(item, index));
  const bodies = bodiesInput.length > 0
    ? bodiesInput.map((item, index) => normalizeForceBody(item, index))
    : [{
        id: "body1",
        label: limitText(args.body_label, "m", MAX_LABEL_LENGTH),
        kind: Math.abs(parseNumber(args.incline_deg, 0)) > 0.01 ? "block" : "particle",
        x: 0,
        y: 0,
        width: 72,
        height: 48,
        radius: 24,
        angle_deg: parseNumber(args.incline_deg, 0),
        forces: ensureArray<unknown>(args.forces).slice(0, MAX_FORCE_ITEMS).map((item, index) => normalizeForceItem(item, index)),
      }];
  const primaryBody = bodies.find((body) => body.forces.length > 0) || bodies[0];
  if (!primaryBody || primaryBody.forces.length === 0) throw new Error("forces is required");
  const inclineDeg = parseNumber(args.incline_deg, 0);
  const totalForces = bodies.reduce((sum, body) => sum + body.forces.length, 0);
  const preferLocalAngles = Math.abs(inclineDeg) > 0.01;
  const clusteredAngles = new Set(primaryBody.forces.map((force) => Math.round((((force.angle_deg % 360) + 360) % 360) / 12))).size;
  const denseForceLayout = (preferLocalAngles && primaryBody.forces.length >= 4) || totalForces >= 6 || (primaryBody.forces.length >= 4 && clusteredAngles <= 3);
  const autoSimplified: string[] = [];
  const showComponents = args.show_components === undefined ? !denseForceLayout : args.show_components !== false;
  if (denseForceLayout && args.show_components === undefined) autoSimplified.push("components");
  const showAxes = args.show_axes === undefined ? !(denseForceLayout && preferLocalAngles) : args.show_axes !== false;
  if (denseForceLayout && preferLocalAngles && args.show_axes === undefined) autoSimplified.push("axes");
  const showAngleLabels = args.show_angle_labels === undefined ? false : Boolean(args.show_angle_labels);
  if (denseForceLayout && args.show_angle_labels === undefined && preferLocalAngles) autoSimplified.push("angle labels");
  const showResultant = args.show_resultant === undefined ? !(denseForceLayout && primaryBody.forces.length >= 5) : args.show_resultant !== false;
  if (denseForceLayout && primaryBody.forces.length >= 5 && args.show_resultant === undefined) autoSimplified.push("resultant");
  const warning = [
    args.warning === undefined ? "" : limitText(args.warning, "", MAX_TITLE_LENGTH),
    autoSimplified.length > 0 ? limitText(`auto-simplified ${autoSimplified.join(", ")} to keep dense force layouts readable`, "", MAX_TITLE_LENGTH) : "",
  ].filter(Boolean).join("; ");
  return {
    title: limitText(args.title, "Force analysis", MAX_TITLE_LENGTH),
    body_label: primaryBody.label,
    forces: primaryBody.forces,
    show_components: showComponents,
    show_axes: showAxes,
    show_resultant: showResultant,
    show_angle_labels: showAngleLabels,
    incline_deg: inclineDeg,
    warning: warning || undefined,
    bodies,
    surfaces,
    connectors,
  };
}

function sanitizeForceTemplatePayload(args: Record<string, unknown>) {
  const template = limitText(args.template, "horizontal", 24);
  const weight = Math.max(0.1, parseNumber(args.weight, 3));
  const rawIncline = parseNumber(args.incline_deg, 30);
  const incline = clamp(rawIncline, 1, 85);
  const friction = Math.max(0, parseNumber(args.friction, 0));
  const pull = Math.max(0, parseNumber(args.pull, 0));
  const tension = Math.max(0, parseNumber(args.tension, 0));
  const bodyLabel = limitText(args.body_label, template === "hanging" ? "m" : "物体", MAX_LABEL_LENGTH);
  const gravityColor = "#c2410c";
  const supportColor = "#15803d";
  const frictionColor = "#1d4ed8";
  const tensionColor = "#7c3aed";
  const pushColor = "#0f766e";
  const contactColor = "#a16207";

  if (template === "incline") {
    const inclineRad = incline * Math.PI / 180;
    const x1 = 180;
    const y1 = 340;
    const x2 = 470;
    const y2 = 340 - Math.tan(inclineRad) * 290;
    const t = 0.42;
    const warning = Math.abs(rawIncline - incline) > 1e-9
      ? `incline_deg was clamped from ${rawIncline} to ${incline} to keep the template layout stable`
      : undefined;
    const inclineSurface = { kind: "incline", x1, y1, x2, y2, label: `${Math.round(incline)}°` };
    const inclineBody = {
      id: "block1",
      label: bodyLabel,
      kind: "block",
      width: 72,
      height: 48,
      angle_deg: incline,
      forces: [
        { label: "重力", angle_deg: -90, magnitude: weight, color: gravityColor },
        { label: "支持力", angle_deg: 90 - incline, magnitude: Math.max(0.1, parseNumber(args.normal, weight * Math.cos(incline * Math.PI / 180))), color: supportColor },
        { label: "摩擦力", angle_deg: 180 - incline, magnitude: friction || weight * 0.25, color: frictionColor },
        { label: "拉力", angle_deg: 180 - incline, magnitude: pull || weight * 0.35, color: tensionColor },
      ],
    };
    const position = placeBodyOnSurface(inclineBody, inclineSurface, t, -1, 0);
    return sanitizeForceAnalysisPayload({
      title: args.title ?? "Incline force analysis",
      body_label: bodyLabel,
      incline_deg: incline,
      show_components: args.show_components ?? true,
      show_axes: args.show_axes ?? true,
      show_resultant: args.show_resultant ?? true,
      show_angle_labels: args.show_angle_labels ?? false,
      warning,
      surfaces: [inclineSurface],
      bodies: [{
        ...inclineBody,
        x: position.x,
        y: position.y,
      }],
    });
  }

  if (template === "hanging") {
    return sanitizeForceAnalysisPayload({
      title: args.title ?? "Hanging mass analysis",
      body_label: bodyLabel,
      incline_deg: 0,
      show_components: args.show_components ?? false,
      show_axes: args.show_axes ?? true,
      show_resultant: args.show_resultant ?? true,
      show_angle_labels: args.show_angle_labels ?? false,
      connectors: [{ kind: "rope", x1: 320, y1: 84, x2: 320, y2: 188 }],
      surfaces: [{ kind: "support", x1: 260, y1: 84, x2: 380, y2: 84 }],
      bodies: [{
        id: "support1",
        label: "",
        kind: "support",
        x: 320,
        y: 84,
        width: 140,
        height: 10,
        forces: [],
      }, {
        id: "mass1",
        label: bodyLabel,
        kind: "hanging_mass",
        x: 320,
        y: 236,
        width: 62,
        height: 78,
        forces: [
          { label: "拉力", angle_deg: 90, magnitude: tension || weight, color: tensionColor },
          { label: "重力", angle_deg: -90, magnitude: weight, color: gravityColor },
        ],
      }],
    });
  }

  if (template === "pulley") {
    return sanitizeForceAnalysisPayload({
      title: args.title ?? "Pulley force analysis",
      body_label: bodyLabel,
      incline_deg: 0,
      show_components: args.show_components ?? true,
      show_axes: args.show_axes ?? true,
      show_resultant: args.show_resultant ?? true,
      show_angle_labels: args.show_angle_labels ?? false,
      connectors: [
        { kind: "rope", x1: 210, y1: 128, x2: 320, y2: 128 },
        { kind: "rope", x1: 320, y1: 128, x2: 320, y2: 230 },
        { kind: "rope", x1: 320, y1: 128, x2: 430, y2: 128 },
      ],
      bodies: [{
        id: "pulley1",
        label: bodyLabel,
        kind: "pulley",
        x: 320,
        y: 128,
        radius: 24,
        forces: [
          { label: "左侧拉力", angle_deg: 180, magnitude: tension || weight * 0.8, color: tensionColor },
          { label: "右侧拉力", angle_deg: 0, magnitude: tension || weight * 0.8, color: pushColor },
          { label: "重力", angle_deg: -90, magnitude: weight, color: gravityColor },
        ],
      }],
    });
  }

  if (template === "double_block") {
    return sanitizeForceAnalysisPayload({
      title: args.title ?? "Double-block force analysis",
      body_label: bodyLabel,
      incline_deg: 0,
      show_components: args.show_components ?? true,
      show_axes: args.show_axes ?? true,
      show_resultant: args.show_resultant ?? true,
      show_angle_labels: args.show_angle_labels ?? false,
      surfaces: [{ kind: "ground", x1: 120, y1: 320, x2: 540, y2: 320 }],
      connectors: [{ kind: "contact", x1: 316, y1: 284, x2: 356, y2: 284, label: "接触" }],
      bodies: [
        {
          id: "block1",
          label: "A",
          kind: "block",
          x: 260,
          y: 284,
          forces: [
            { label: "拉力", angle_deg: 180, magnitude: tension || weight * 0.6, color: tensionColor },
            { label: "支持力", angle_deg: 90, magnitude: weight, color: supportColor },
            { label: "重力", angle_deg: -90, magnitude: weight, color: gravityColor },
          ],
        },
        {
          id: "block2",
          label: "B",
          kind: "block",
          x: 400,
          y: 284,
          forces: [
            { label: "推力", angle_deg: 0, magnitude: pull || weight * 0.6, color: pushColor },
            { label: "接触力", angle_deg: 180, magnitude: Math.max(0.1, weight * 0.35), color: contactColor },
            { label: "摩擦力", angle_deg: 180, magnitude: friction || weight * 0.18, color: frictionColor },
            { label: "重力", angle_deg: -90, magnitude: weight, color: gravityColor },
          ],
        },
      ],
    });
  }

  if (template === "pulley_group") {
    return sanitizeForceAnalysisPayload({
      title: args.title ?? "Pulley-group force analysis",
      body_label: bodyLabel,
      incline_deg: 0,
      show_components: args.show_components ?? true,
      show_axes: args.show_axes ?? true,
      show_resultant: args.show_resultant ?? true,
      show_angle_labels: args.show_angle_labels ?? false,
      connectors: [
        { kind: "rope", x1: 240, y1: 118, x2: 320, y2: 118 },
        { kind: "rope", x1: 320, y1: 118, x2: 400, y2: 118 },
        { kind: "rope", x1: 320, y1: 118, x2: 320, y2: 220 },
      ],
      bodies: [{
        id: "pulley1",
        label: bodyLabel,
        kind: "pulley",
        x: 320,
        y: 118,
        forces: [
          { label: "绳段拉力 T1", angle_deg: 140, magnitude: tension || weight * 0.55, color: tensionColor },
          { label: "绳段拉力 T2", angle_deg: 40, magnitude: tension || weight * 0.55, color: pushColor },
          { label: "重力", angle_deg: -90, magnitude: weight, color: gravityColor },
        ],
      }],
    });
  }

  if (template === "spring_oscillator") {
    return sanitizeForceAnalysisPayload({
      title: args.title ?? "Spring oscillator snapshot",
      body_label: bodyLabel,
      incline_deg: 0,
      show_components: args.show_components ?? true,
      show_axes: args.show_axes ?? true,
      show_resultant: args.show_resultant ?? true,
      show_angle_labels: args.show_angle_labels ?? false,
      connectors: [{ kind: "spring", x1: 140, y1: 250, x2: 250, y2: 250 }],
      surfaces: [{ kind: "wall", x1: 110, y1: 180, x2: 110, y2: 320 }],
      bodies: [{
        id: "mass1",
        label: bodyLabel,
        kind: "block",
        x: 308,
        y: 250,
        forces: [
          { label: "回复力", angle_deg: 180, magnitude: tension || weight * 0.7, color: tensionColor },
          { label: "速度方向", angle_deg: 0, magnitude: pull || weight * 0.45, color: pushColor },
          { label: "阻尼", angle_deg: 180, magnitude: friction || weight * 0.2, color: supportColor },
        ],
      }],
    });
  }

  if (template === "spring") {
    return sanitizeForceAnalysisPayload({
      title: args.title ?? "Spring force analysis",
      body_label: bodyLabel,
      incline_deg: 0,
      show_components: args.show_components ?? true,
      show_axes: args.show_axes ?? true,
      show_resultant: args.show_resultant ?? true,
      show_angle_labels: args.show_angle_labels ?? false,
      connectors: [{ kind: "spring", x1: 150, y1: 260, x2: 260, y2: 260 }],
      surfaces: [{ kind: "wall", x1: 120, y1: 190, x2: 120, y2: 330 }],
      bodies: [{
        id: "block1",
        label: bodyLabel,
        kind: "block",
        x: 320,
        y: 260,
        forces: [
          { label: "弹力", angle_deg: 180, magnitude: tension || weight * 0.7, color: tensionColor },
          { label: "外力", angle_deg: 0, magnitude: pull || weight * 0.7, color: pushColor },
          { label: "摩擦力", angle_deg: 180, magnitude: friction || weight * 0.2, color: frictionColor },
        ],
      }],
    });
  }

  return sanitizeForceAnalysisPayload({
    title: args.title ?? "Horizontal force analysis",
    body_label: bodyLabel,
    incline_deg: 0,
    show_components: args.show_components ?? true,
    show_axes: args.show_axes ?? true,
    show_resultant: args.show_resultant ?? true,
    show_angle_labels: args.show_angle_labels ?? false,
    surfaces: [{ kind: "ground", x1: 110, y1: 320, x2: 530, y2: 320 }],
    bodies: [{
      id: "block1",
      label: bodyLabel,
      kind: "block",
      x: 320,
      y: 284,
      forces: [
        { label: "重力", angle_deg: -90, magnitude: weight, color: gravityColor },
        { label: "支持力", angle_deg: 90, magnitude: Math.max(0.1, parseNumber(args.normal, weight)), color: supportColor },
        { label: "摩擦力", angle_deg: 180, magnitude: friction || weight * 0.2, color: frictionColor },
        { label: "拉力", angle_deg: 0, magnitude: pull || weight * 0.3, color: tensionColor },
      ],
    }],
  });
}

function normalizeSceneWire(item: unknown): { x1: number; y1: number; x2: number; y2: number; label: string } {
  const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
  return {
    x1: parseNumber(record.x1, 0),
    y1: parseNumber(record.y1, 0),
    x2: parseNumber(record.x2, 0),
    y2: parseNumber(record.y2, 0),
    label: limitText(record.label, "", MAX_LABEL_LENGTH),
  };
}

type SceneAttachment = {
  id: string;
  type: string;
  target: string;
  source: string;
  label: string;
  x?: number;
  y?: number;
};

function normalizeSceneAttachment(item: unknown, index: number): SceneAttachment {
  const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
  return {
    id: limitText(record.id, `attachment${index + 1}`, MAX_LABEL_LENGTH),
    type: limitText(record.type, "voltmeter_parallel", 32),
    target: limitText(record.target, "", MAX_LABEL_LENGTH),
    source: limitText(record.source, "", MAX_LABEL_LENGTH),
    label: limitText(record.label, "", MAX_LABEL_LENGTH),
    x: record.x === undefined ? undefined : parseNumber(record.x, 0),
    y: record.y === undefined ? undefined : parseNumber(record.y, 0),
  };
}

function findComponentById(components: Array<Record<string, unknown>>, id: string) {
  return components.find((component) => component.id === id);
}

function componentLeadX(component: Record<string, unknown>, side: "left" | "right") {
  const type = String(component.type || "node");
  const orientation = String(component.orientation || "horizontal") === "vertical" ? "vertical" : "horizontal";
  const x = Number(component.x || 0);
  if (orientation === "vertical") {
    if (type === "transistor") return x + (side === "left" ? -10 : 10);
    if (type === "opamp") return x + (side === "left" ? -10 : 10);
    return x;
  }
  if (type === "battery") return x + (side === "left" ? -34 : 34);
  if (type === "source" || type === "current_source" || type === "voltage_source") return x + (side === "left" ? -36 : 36);
  if (type === "resistor") return x + (side === "left" ? -36 : 36);
  if (type === "capacitor") return x + (side === "left" ? -30 : 30);
  if (type === "inductor") return x + (side === "left" ? -34 : 34);
  if (type === "switch") return x + (side === "left" ? -36 : 36);
  if (type === "diode" || type === "led") return x + (side === "left" ? -34 : 34);
  if (type === "ammeter" || type === "voltmeter" || type === "lamp" || type === "load" || type === "pulley") return x + (side === "left" ? -36 : 36);
  if (type === "transistor") return x + (side === "left" ? -36 : 24);
  if (type === "relay") return x + (side === "left" ? -36 : 40);
  if (type === "buzzer") return x + (side === "left" ? -36 : 34);
  if (type === "opamp") return x + (side === "left" ? -40 : 38);
  if (type === "ground") return x;
  return x;
}

function componentLeadY(component: Record<string, unknown>, side: "center" | "top" | "bottom" = "center") {
  const type = String(component.type || "node");
  const orientation = String(component.orientation || "horizontal") === "vertical" ? "vertical" : "horizontal";
  const y = Number(component.y || 0);
  if (orientation !== "vertical") return y;
  if (type === "battery") return y + (side === "top" ? -34 : side === "bottom" ? 34 : 0);
  if (type === "source" || type === "current_source" || type === "voltage_source") return y + (side === "top" ? -36 : side === "bottom" ? 36 : 0);
  if (type === "resistor") return y + (side === "top" ? -36 : side === "bottom" ? 36 : 0);
  if (type === "capacitor") return y + (side === "top" ? -30 : side === "bottom" ? 30 : 0);
  if (type === "inductor") return y + (side === "top" ? -34 : side === "bottom" ? 34 : 0);
  if (type === "switch") return y + (side === "top" ? -36 : side === "bottom" ? 36 : 0);
  if (type === "diode" || type === "led") return y + (side === "top" ? -34 : side === "bottom" ? 34 : 0);
  if (type === "ammeter" || type === "voltmeter" || type === "lamp" || type === "load" || type === "pulley") return y + (side === "top" ? -36 : side === "bottom" ? 36 : 0);
  if (type === "transistor") return y + (side === "top" ? -36 : side === "bottom" ? 30 : 0);
  if (type === "relay") return y + (side === "top" ? -40 : side === "bottom" ? 36 : 0);
  if (type === "buzzer") return y + (side === "top" ? -36 : side === "bottom" ? 34 : 0);
  if (type === "opamp") return y + (side === "top" ? -40 : side === "bottom" ? 38 : 0);
  if (type === "ground") return y;
  return y;
}

function buildSceneAttachmentPayload(
  components: Array<Record<string, unknown>>,
  attachments: SceneAttachment[],
) {
  const extraComponents: Array<Record<string, unknown>> = [];
  const extraWires: Array<Record<string, unknown>> = [];

  attachments.forEach((attachment, index) => {
    const type = String(attachment.type || "");
    if (type === "voltmeter_parallel") {
      const target = findComponentById(components, String(attachment.target || ""));
      if (!target) return;
      const leftX = componentLeadX(target, "left");
      const rightX = componentLeadX(target, "right");
      const targetY = componentLeadY(target, "center");
      const meterX = attachment.x ?? (leftX + rightX) / 2;
      const meterY = attachment.y ?? (targetY + 92);
      const meterId = attachment.id || `voltmeter_${index + 1}`;
      extraComponents.push({
        id: meterId,
        type: "voltmeter",
        label: attachment.label || "V",
        color: "#111827",
        x: meterX,
        y: meterY,
        orientation: String(target.orientation || "horizontal") === "vertical" ? "vertical" : "horizontal",
      });
      if (String(target.orientation || "horizontal") === "vertical") {
        extraWires.push(layoutWire(leftX, componentLeadY(target, "top"), leftX, meterY - 36));
        extraWires.push(layoutWire(leftX, meterY - 36, meterX, meterY - 36));
        extraWires.push(layoutWire(rightX, componentLeadY(target, "bottom"), rightX, meterY + 36));
        extraWires.push(layoutWire(rightX, meterY + 36, meterX, meterY + 36));
      } else {
        extraWires.push(layoutWire(leftX, targetY, leftX, meterY));
        extraWires.push(layoutWire(leftX, meterY, meterX - 36, meterY));
        extraWires.push(layoutWire(rightX, targetY, rightX, meterY));
        extraWires.push(layoutWire(meterX + 36, meterY, rightX, meterY));
      }
    }
    if (type === "feedback") {
      const source = findComponentById(components, String(attachment.source || ""));
      const target = findComponentById(components, String(attachment.target || ""));
      if (!source || !target) return;
      const startX = componentLeadX(source, "right");
      const startY = componentLeadY(source, String(source.orientation || "horizontal") === "vertical" ? "bottom" : "center");
      const endX = componentLeadX(target, "left");
      const endY = componentLeadY(target, String(target.orientation || "horizontal") === "vertical" ? "bottom" : "center") + 24;
      const railY = attachment.y ?? Math.max(startY, endY) + 120;
      extraWires.push(layoutWire(startX, startY, startX, railY));
      extraWires.push(layoutWire(startX, railY, endX, railY));
      extraWires.push(layoutWire(endX, railY, endX, endY, attachment.label || "反馈"));
    }
    if (type === "base_feed") {
      const source = findComponentById(components, String(attachment.source || ""));
      const target = findComponentById(components, String(attachment.target || ""));
      if (!source || !target) return;
      const startX = componentLeadX(source, "right");
      const startY = componentLeadY(source, String(source.orientation || "horizontal") === "vertical" ? "bottom" : "center");
      const baseX = Number(target.x || 0) - 40;
      const baseY = Number(target.y || 0);
      extraWires.push(layoutWire(startX, startY, baseX, startY));
      extraWires.push(layoutWire(baseX, startY, baseX, baseY, attachment.label || "B"));
    }
    if (type === "return_rail") {
      const source = findComponentById(components, String(attachment.source || ""));
      const target = findComponentById(components, String(attachment.target || ""));
      if (!source || !target) return;
      const startX = componentLeadX(source, "right");
      const startY = componentLeadY(source, String(source.orientation || "horizontal") === "vertical" ? "bottom" : "center");
      const endX = componentLeadX(target, "left");
      const endY = componentLeadY(target, String(target.orientation || "horizontal") === "vertical" ? "top" : "center");
      const railY = attachment.y ?? Math.max(startY, endY) + 130;
      extraWires.push(layoutWire(startX, startY, startX, railY));
      extraWires.push(layoutWire(startX, railY, endX, railY));
      extraWires.push(layoutWire(endX, railY, endX, endY));
    }
  });

  return { extraComponents, extraWires };
}

function buildCircuitScenePayload(args: Record<string, unknown>): Record<string, unknown> {
  const title = limitText(args.title, "Circuit diagram", MAX_TITLE_LENGTH);
  const notes = ensureArray<unknown>(args.notes).slice(0, 12).map((note) => limitText(note, "", MAX_LABEL_LENGTH));
  const lanesInput = ensureArray<unknown>(args.lanes).slice(0, MAX_CIRCUIT_LAYOUT_BRANCHES + 1).map((lane, laneIndex) => {
    const record = (lane && typeof lane === "object") ? lane as Record<string, unknown> : {};
    return {
      name: limitText(record.name, laneIndex === 0 ? "main" : `lane${laneIndex + 1}`, 24),
      items: ensureArray<unknown>(record.items).slice(0, MAX_CIRCUIT_LAYOUT_ITEMS),
    };
  }).filter((lane) => lane.items.length > 0);
  if (lanesInput.length === 0) {
    throw new Error("lanes is required");
  }

  const firstLane = lanesInput[0];
  const sharedPrefix: unknown[] = [];
  const sharedSuffix: unknown[] = [];
  const branchRows = lanesInput.slice(1).map((lane) => lane.items.slice());

  if (branchRows.length > 0) {
    while (firstLane.items.length > sharedPrefix.length && branchRows.every((items) => items.length > sharedPrefix.length)) {
      const index = sharedPrefix.length;
      const mainItem = firstLane.items[index];
      const mainRecord = (mainItem && typeof mainItem === "object") ? mainItem as Record<string, unknown> : {};
      const mainId = limitText(mainRecord.id, "", MAX_LABEL_LENGTH);
      if (!mainId) break;
      const matches = branchRows.every((items) => {
        const item = items[index];
        const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
        return limitText(record.id, "", MAX_LABEL_LENGTH) === mainId;
      });
      if (!matches) break;
      sharedPrefix.push(mainItem);
    }

    while (
      firstLane.items.length - sharedPrefix.length - sharedSuffix.length > 0
      && branchRows.every((items) => items.length - sharedPrefix.length - sharedSuffix.length > 0)
    ) {
      const mainIndex = firstLane.items.length - 1 - sharedSuffix.length;
      const mainItem = firstLane.items[mainIndex];
      const mainRecord = (mainItem && typeof mainItem === "object") ? mainItem as Record<string, unknown> : {};
      const mainId = limitText(mainRecord.id, "", MAX_LABEL_LENGTH);
      if (!mainId) break;
      const matches = branchRows.every((items) => {
        const item = items[items.length - 1 - sharedSuffix.length];
        const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
        return limitText(record.id, "", MAX_LABEL_LENGTH) === mainId;
      });
      if (!matches) break;
      sharedSuffix.unshift(mainItem);
    }
  }

  const stages: Array<Record<string, unknown>> = [];
  if (sharedPrefix.length > 0) {
    stages.push({ kind: "series", items: sharedPrefix });
  }
  if (branchRows.length > 0) {
    const branches = lanesInput.map((lane, laneIndex) => {
      const items = lane.items.slice(sharedPrefix.length, lane.items.length - sharedSuffix.length);
      if (laneIndex === 0 && items.length === 0) {
        return { items: [{ id: `${lane.name}_wire`, type: "ground", label: "", color: "#111827" }] };
      }
      return { items };
    }).filter((branch) => branch.items.length > 0);
    if (branches.length > 0) {
      stages.push({ kind: "parallel", branches });
    }
  } else if (firstLane.items.length > 0) {
    stages.push({ kind: "series", items: firstLane.items });
  }
  if (sharedSuffix.length > 0) {
    stages.push({ kind: "series", items: sharedSuffix });
  }

  return buildCircuitLayoutPayload({
    title,
    notes,
    source_label: args.source_label,
    stages,
  });
}

function buildCircuitSceneComponentLayoutPayload(args: Record<string, unknown>, sceneComponents: Array<Record<string, unknown>>): Record<string, unknown> {
  const title = limitText(args.title, "Circuit diagram", MAX_TITLE_LENGTH);
  const notes = ensureArray<unknown>(args.notes).slice(0, 12).map((note) => limitText(note, "", MAX_LABEL_LENGTH));
  const orderedComponents = [...sceneComponents].sort((a, b) => {
    const laneCompare = String(a.lane).localeCompare(String(b.lane));
    if (laneCompare !== 0) return laneCompare;
    const orderCompare = Number(a.order) - Number(b.order);
    if (orderCompare !== 0) return orderCompare;
    return String(a.id).localeCompare(String(b.id));
  });
  const lanes = Array.from(new Set(orderedComponents.map((item) => item.lane)));
  const laneItems = lanes.map((lane) => orderedComponents
    .filter((item) => item.lane === lane)
    .map((item) => ({
      id: item.id,
      type: item.type,
      label: item.label,
      color: item.color,
      orientation: item.orientation,
    })));

  if (laneItems.length === 1) {
    return buildCircuitLayoutPayload({
      title,
      notes,
      source_label: args.source_label,
      stages: [{ kind: "series", items: laneItems[0] }],
    });
  }

  return buildCircuitLayoutPayload({
    title,
    notes,
    source_label: args.source_label,
    stages: [{ kind: "parallel", branches: laneItems.map((items) => ({ items })) }],
  });
}

function sanitizeCircuitPayload(args: Record<string, unknown>): Record<string, unknown> {
  const packedKind = String(args.__circuit_kind || "");
  if (packedKind === "template") {
    const templateArgs = { ...args };
    delete templateArgs.__circuit_kind;
    return sanitizeCircuitTemplatePayload(templateArgs);
  }
  if (packedKind === "scene") {
    const sceneArgs = { ...args };
    delete sceneArgs.__circuit_kind;
    return sanitizeCircuitPayloadFromArgs(sceneArgs);
  }
  if (packedKind === "layout") {
    const layoutArgs = { ...args };
    delete layoutArgs.__circuit_kind;
    return buildCircuitLayoutPayload(layoutArgs);
  }

  const sceneComponents = ensureArray<unknown>(args.scene_components).slice(0, MAX_CIRCUIT_COMPONENTS).map((item, index) => {
    const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
    return {
      id: limitText(record.id, `c${index + 1}`, MAX_LABEL_LENGTH),
      type: limitText(record.type, "resistor", 24),
      label: limitText(record.label, "", MAX_LABEL_LENGTH),
      color: limitText(record.color, "#111827", 32),
      orientation: String(record.orientation || "horizontal") === "vertical" ? "vertical" : "horizontal",
      lane: limitText(record.lane, "main", 24),
      order: parseInteger(record.order, index),
      x: record.x === undefined ? undefined : parseNumber(record.x, 0),
      y: record.y === undefined ? undefined : parseNumber(record.y, 0),
    };
  });

  if (sceneComponents.length > 0) {
    const sceneWires = ensureArray<unknown>(args.scene_wires).slice(0, MAX_CIRCUIT_WIRES).map((item) => normalizeSceneWire(item));
    const attachments = ensureArray<unknown>(args.scene_attachments).map((item, index) => normalizeSceneAttachment(item, index));
    const hasExplicitPositions = sceneComponents.some((item) => item.x !== undefined || item.y !== undefined);
    const hasExtraSceneGeometry = sceneWires.length > 0 || attachments.length > 0;

    if (!hasExplicitPositions && !hasExtraSceneGeometry) {
      return buildCircuitSceneComponentLayoutPayload(args, sceneComponents);
    }

    const title = limitText(args.title, "Circuit diagram", MAX_TITLE_LENGTH);
    const notes = ensureArray<unknown>(args.notes).slice(0, 12).map((note) => limitText(note, "", MAX_LABEL_LENGTH));
    const laneGap = Math.max(64, parseNumber(args.lane_gap, 90));
    const stepX = Math.max(72, parseNumber(args.step_x, 104));
    const laneNames = Array.from(new Set(sceneComponents.map((item) => item.lane)));
    const lanes = new Map(laneNames.map((lane, index) => [lane, 160 + index * laneGap]));
    const components = sceneComponents.map((item, index) => ({
      id: item.id,
      type: item.type,
      label: item.label,
      color: item.color,
      orientation: item.orientation,
      x: item.x ?? (154 + item.order * stepX),
      y: item.y ?? (lanes.get(item.lane) ?? (160 + index * laneGap)),
    }));
    const laneMap = new Map(sceneComponents.map((item) => [item.id, item.lane]));
    const componentsByLane = laneNames.map((lane) => components.filter((component) => laneMap.get(component.id) === lane).sort((a, b) => a.x - b.x));
    const wires: Array<Record<string, unknown>> = [];
    componentsByLane.forEach((laneComponents) => {
      if (laneComponents.length === 0) return;
      for (let i = 0; i < laneComponents.length - 1; i += 1) {
        wires.push(layoutWire(laneComponents[i].x, laneComponents[i].y, laneComponents[i + 1].x, laneComponents[i + 1].y));
      }
    });
    if (componentsByLane.length > 1) {
      const firstLane = componentsByLane[0];
      const lastLane = componentsByLane[componentsByLane.length - 1];
      if (firstLane[0] && lastLane[0]) wires.push(layoutWire(firstLane[0].x - 44, firstLane[0].y, firstLane[0].x, firstLane[0].y));
      if (firstLane[0] && lastLane[0]) wires.push(layoutWire(firstLane[0].x - 44, firstLane[0].y, firstLane[0].x - 44, lastLane[0].y));
      if (lastLane.at(-1) && firstLane.at(-1)) wires.push(layoutWire(firstLane.at(-1)!.x + 44, firstLane.at(-1)!.y, firstLane.at(-1)!.x + 44, lastLane.at(-1)!.y));
      if (lastLane.at(-1) && firstLane.at(-1)) wires.push(layoutWire(lastLane.at(-1)!.x, lastLane.at(-1)!.y, firstLane.at(-1)!.x + 44, lastLane.at(-1)!.y));
    }
    const { extraComponents, extraWires } = buildSceneAttachmentPayload(components, attachments);
    return {
      title,
      components: [...components, ...extraComponents],
      wires: [...wires, ...sceneWires, ...extraWires],
      notes,
    };
  }

  const components = ensureArray<unknown>(args.components).slice(0, MAX_CIRCUIT_COMPONENTS).map((item, index) => {
    const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
    return {
      id: limitText(record.id, `c${index + 1}`, MAX_LABEL_LENGTH),
      x: parseNumber(record.x, 80 + index * 60),
      y: parseNumber(record.y, 180),
      label: limitText(record.label, "", MAX_LABEL_LENGTH),
      type: limitText(record.type, "node", 24),
      color: limitText(record.color, "#111827", 32),
      orientation: String(record.orientation || "horizontal") === "vertical" ? "vertical" : "horizontal",
    };
  });
  const wires = ensureArray<unknown>(args.wires).slice(0, MAX_CIRCUIT_WIRES).map((item) => {
    const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
    return {
      x1: parseNumber(record.x1, 0),
      y1: parseNumber(record.y1, 0),
      x2: parseNumber(record.x2, 0),
      y2: parseNumber(record.y2, 0),
      label: limitText(record.label, "", MAX_LABEL_LENGTH),
    };
  });
  const notes = ensureArray<unknown>(args.notes).slice(0, 12).map((note) => limitText(note, "", MAX_LABEL_LENGTH));
  if (components.length === 0) throw new Error("components is required");
  if (wires.length === 0) throw new Error("wires is required");
  return {
    title: limitText(args.title, "Circuit diagram", MAX_TITLE_LENGTH),
    components,
    wires,
    notes,
  };
}

function layoutComponentId(prefix: string, index: number) {
  return `${prefix}${index + 1}`;
}

type CircuitLayoutItem = Record<string, unknown>;
type CircuitStage = { kind: "series"; items: CircuitLayoutItem[] } | { kind: "parallel"; branches: CircuitLayoutItem[][] };

function normalizeCircuitLayoutItem(item: unknown, fallbackId: string): CircuitLayoutItem {
  const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
  return {
    id: limitText(record.id, fallbackId, MAX_LABEL_LENGTH),
    type: limitText(record.type, "resistor", 24),
    label: limitText(record.label, "", MAX_LABEL_LENGTH),
    color: limitText(record.color, "#111827", 32),
    orientation: String(record.orientation || "horizontal") === "vertical" ? "vertical" : "horizontal",
  };
}

function normalizeCircuitStages(args: Record<string, unknown>): CircuitStage[] {
  const explicitStages = ensureArray<unknown>(args.stages).slice(0, MAX_CIRCUIT_LAYOUT_ITEMS + MAX_CIRCUIT_LAYOUT_BRANCHES + 2);
  if (explicitStages.length > 0) {
    return explicitStages.map((stage, stageIndex) => {
      const record = (stage && typeof stage === "object") ? stage as Record<string, unknown> : {};
      const kind = String(record.kind || "series") === "parallel" ? "parallel" : "series";
      if (kind === "parallel") {
        const branches = ensureArray<unknown>(record.branches).slice(0, MAX_CIRCUIT_LAYOUT_BRANCHES).map((branch, branchIndex) => {
          const branchRecord = (branch && typeof branch === "object") ? branch as Record<string, unknown> : {};
          return ensureArray<unknown>(branchRecord.items).slice(0, MAX_CIRCUIT_LAYOUT_ITEMS).map((item, itemIndex) => normalizeCircuitLayoutItem(item, `p${stageIndex + 1}_${branchIndex + 1}_${itemIndex + 1}`));
        }).filter((items) => items.length > 0);
        if (branches.length === 0) throw new Error(`parallel stage ${stageIndex + 1} requires branches`);
        return { kind: "parallel", branches };
      }
      const items = ensureArray<unknown>(record.items).slice(0, MAX_CIRCUIT_LAYOUT_ITEMS).map((item, itemIndex) => normalizeCircuitLayoutItem(item, `s${stageIndex + 1}_${itemIndex + 1}`));
      if (items.length === 0) throw new Error(`series stage ${stageIndex + 1} requires items`);
      return { kind: "series", items };
    });
  }

  const rowItems = ensureArray<unknown>(args.row).slice(0, MAX_CIRCUIT_LAYOUT_ITEMS).map((item, index) => normalizeCircuitLayoutItem(item, `row_${index + 1}`));
  const branchRows = ensureArray<unknown>(args.branches).slice(0, MAX_CIRCUIT_LAYOUT_BRANCHES).map((branch, branchIndex) => {
    const record = (branch && typeof branch === "object") ? branch as Record<string, unknown> : {};
    return ensureArray<unknown>(record.items).slice(0, MAX_CIRCUIT_LAYOUT_ITEMS).map((item, itemIndex) => normalizeCircuitLayoutItem(item, `branch_${branchIndex + 1}_${itemIndex + 1}`));
  }).filter((items) => items.length > 0);
  const returnItems = ensureArray<unknown>(args.return_path).slice(0, MAX_CIRCUIT_LAYOUT_ITEMS).map((item, index) => normalizeCircuitLayoutItem(item, `return_${index + 1}`));
  const stages: CircuitStage[] = [];
  if (rowItems.length > 0) stages.push({ kind: "series", items: rowItems });
  if (branchRows.length > 0) stages.push({ kind: "parallel", branches: branchRows });
  if (returnItems.length > 0) stages.push({ kind: "series", items: returnItems });
  return stages;
}

function buildCircuitLayoutGeometry(stages: CircuitStage[], sourceLabel: string) {
  if (stages.length === 0) {
    throw new Error("layout requires stages or row/branches/return_path items");
  }

  const components: Array<Record<string, unknown>> = [
    { id: "src", type: "battery", x: 110, y: 300, label: sourceLabel, color: "#111827", orientation: "vertical" },
  ];
  const wires: Array<Record<string, unknown>> = [];
  const mainY = 170;
  const returnY = 420;
  const seriesStepX = 112;
  const stageGapX = 44;
  const branchEntryInset = 54;
  const branchExitInset = 36;
  const branchGapY = 84;
  const entryX = 196;
  let componentIndex = 0;
  let currentX = entryX;

  wires.push(layoutWire(110, 276, 110, mainY));
  wires.push(layoutWire(110, mainY, entryX, mainY));

  const addSeriesStage = (items: CircuitLayoutItem[]) => {
    let previousX = currentX;
    items.forEach((item) => {
      const x = previousX + seriesStepX;
      components.push(layoutComponentFromItem(item, componentIndex, x, mainY, "resistor"));
      componentIndex += 1;
      wires.push(layoutWire(previousX, mainY, x, mainY));
      previousX = x;
    });
    currentX = previousX;
  };

  const addParallelStage = (branches: CircuitLayoutItem[][]) => {
    const branchCount = branches.length;
    const maxItems = Math.max(...branches.map((items) => items.length));
    const compactBranchGapY = branchCount <= 2 ? 72 : branchCount === 3 ? 78 : branchGapY;
    const leftBusX = currentX + stageGapX;
    const branchSpanX = Math.max(0, (maxItems - 1) * seriesStepX);
    const rightBusX = leftBusX + Math.max(120, branchEntryInset + branchSpanX + branchExitInset);
    const startY = mainY - ((branchCount - 1) * compactBranchGapY) / 2;
    const branchYs = branches.map((_, index) => startY + index * compactBranchGapY);
    const topBusY = Math.min(...branchYs);
    const bottomBusY = Math.max(...branchYs);

    wires.push(layoutWire(currentX, mainY, leftBusX, mainY));
    if (topBusY !== mainY) wires.push(layoutWire(leftBusX, mainY, leftBusX, topBusY));
    if (bottomBusY !== topBusY) wires.push(layoutWire(leftBusX, topBusY, leftBusX, bottomBusY));
    if (topBusY !== mainY) wires.push(layoutWire(rightBusX, topBusY, rightBusX, bottomBusY));
    else if (bottomBusY !== mainY) wires.push(layoutWire(rightBusX, mainY, rightBusX, bottomBusY));

    branches.forEach((items, branchIndex) => {
      const y = branchYs[branchIndex];
      let previousX = leftBusX;
      items.forEach((item, itemIndex) => {
        const x = leftBusX + branchEntryInset + itemIndex * seriesStepX;
        components.push(layoutComponentFromItem(item, componentIndex, x, y, "resistor"));
        componentIndex += 1;
        wires.push(layoutWire(previousX, y, x, y));
        previousX = x;
      });
      wires.push(layoutWire(previousX, y, rightBusX, y));
    });

    if (topBusY !== mainY) wires.push(layoutWire(rightBusX, topBusY, rightBusX, mainY));
    else if (bottomBusY !== mainY) wires.push(layoutWire(rightBusX, bottomBusY, rightBusX, mainY));
    currentX = rightBusX;
  };

  stages.forEach((stage) => {
    if (stage.kind === "series") {
      addSeriesStage(stage.items);
    } else {
      addParallelStage(stage.branches);
    }
  });

  const exitX = currentX + stageGapX;
  wires.push(layoutWire(currentX, mainY, exitX, mainY));
  wires.push(layoutWire(exitX, mainY, exitX, returnY));
  wires.push(layoutWire(exitX, returnY, 110, returnY));
  wires.push(layoutWire(110, returnY, 110, 324));

  return { components, wires };
}

function layoutComponentFromItem(item: Record<string, unknown>, index: number, x: number, y: number, fallbackType = "resistor") {
  return {
    id: limitText(item.id, layoutComponentId("n", index), MAX_LABEL_LENGTH),
    type: limitText(item.type, fallbackType, 24),
    x,
    y,
    label: limitText(item.label, "", MAX_LABEL_LENGTH),
    color: limitText(item.color, "#111827", 32),
    orientation: String(item.orientation || "horizontal") === "vertical" ? "vertical" : "horizontal",
  };
}

function layoutWire(x1: number, y1: number, x2: number, y2: number, label = "") {
  return { x1, y1, x2, y2, label };
}

function buildCircuitLayoutPayload(args: Record<string, unknown>): Record<string, unknown> {
  const title = limitText(args.title, "Auto layout circuit", MAX_TITLE_LENGTH);
  const notes = ensureArray<unknown>(args.notes).slice(0, 12).map((note) => limitText(note, "", MAX_LABEL_LENGTH));
  const sourceLabel = limitText(args.source_label, "电源", MAX_LABEL_LENGTH);
  const stages = normalizeCircuitStages(args);
  const { components, wires } = buildCircuitLayoutGeometry(stages, sourceLabel);
  return sanitizeCircuitPayload({
    title,
    components,
    wires,
    notes,
  });
}

function sanitizeCircuitPayloadFromArgs(args: Record<string, unknown>): Record<string, unknown> {
  if (args.__circuit_kind) {
    return sanitizeCircuitPayload(args);
  }
  if (Array.isArray(args.components) && Array.isArray(args.wires)) {
    return sanitizeCircuitPayload(args);
  }
  if (Array.isArray(args.scene_components) || Array.isArray(args.lanes)) {
    return Array.isArray(args.lanes) ? buildCircuitScenePayload(args) : sanitizeCircuitPayload(args);
  }
  if (Array.isArray(args.stages) || Array.isArray(args.row) || Array.isArray(args.branches) || Array.isArray(args.return_path)) {
    return buildCircuitLayoutPayload(args);
  }
  return buildCircuitLayoutPayload(args);
}

function buildCompactCircuitLinkPayload(args: Record<string, unknown>, mode: "template" | "scene" | "layout" | "expanded") {
  if (mode === "template") {
    return {
      __circuit_kind: "template",
      template: limitText(args.template, "series", 24),
      title: args.title === undefined ? undefined : limitText(args.title, "", MAX_TITLE_LENGTH),
      source_label: args.source_label === undefined ? undefined : limitText(args.source_label, "", MAX_LABEL_LENGTH),
      resistor_label: args.resistor_label === undefined ? undefined : limitText(args.resistor_label, "", MAX_LABEL_LENGTH),
      resistor_label_2: args.resistor_label_2 === undefined ? undefined : limitText(args.resistor_label_2, "", MAX_LABEL_LENGTH),
      lamp_label: args.lamp_label === undefined ? undefined : limitText(args.lamp_label, "", MAX_LABEL_LENGTH),
      switch_label: args.switch_label === undefined ? undefined : limitText(args.switch_label, "", MAX_LABEL_LENGTH),
      notes: ensureArray<unknown>(args.notes).slice(0, 12).map((item) => limitText(item, "", MAX_LABEL_LENGTH)),
    };
  }
  if (mode === "scene") {
    return {
      __circuit_kind: "scene",
      title: limitText(args.title, "Circuit diagram", MAX_TITLE_LENGTH),
      notes: ensureArray<unknown>(args.notes).slice(0, 12).map((item) => limitText(item, "", MAX_LABEL_LENGTH)),
      scene_components: ensureArray<unknown>(args.scene_components).slice(0, MAX_CIRCUIT_COMPONENTS),
      scene_wires: ensureArray<unknown>(args.scene_wires).slice(0, MAX_CIRCUIT_WIRES),
      scene_attachments: ensureArray<unknown>(args.scene_attachments).slice(0, MAX_CIRCUIT_WIRES),
      lane_gap: parseNumber(args.lane_gap, 100),
      step_x: parseNumber(args.step_x, 120),
    };
  }
  if (mode === "layout") {
    return {
      __circuit_kind: "layout",
      title: limitText(args.title, "Auto layout circuit", MAX_TITLE_LENGTH),
      notes: ensureArray<unknown>(args.notes).slice(0, 12).map((item) => limitText(item, "", MAX_LABEL_LENGTH)),
      source_label: limitText(args.source_label, "电源", MAX_LABEL_LENGTH),
      stages: ensureArray<unknown>(args.stages).slice(0, MAX_CIRCUIT_LAYOUT_ITEMS + MAX_CIRCUIT_LAYOUT_BRANCHES + 2),
      row: ensureArray<unknown>(args.row).slice(0, MAX_CIRCUIT_LAYOUT_ITEMS),
      branches: ensureArray<unknown>(args.branches).slice(0, MAX_CIRCUIT_LAYOUT_BRANCHES),
      return_path: ensureArray<unknown>(args.return_path).slice(0, MAX_CIRCUIT_LAYOUT_ITEMS),
    };
  }
  return sanitizeCircuitPayloadFromArgs(args);
}

function classifyCircuitLinkPayload(args: Record<string, unknown>): "template" | "scene" | "layout" | "expanded" {
  if (typeof args.template === "string") return "template";
  if (Array.isArray(args.scene_components) || Array.isArray(args.lanes)) return "scene";
  if (Array.isArray(args.stages) || Array.isArray(args.row) || Array.isArray(args.branches) || Array.isArray(args.return_path)) return "layout";
  return "expanded";
}

function sanitizeCircuitTemplatePayload(args: Record<string, unknown>): Record<string, unknown> {
  const template = limitText(args.template, "series", 24);
  const title = limitText(args.title, `${template} circuit`, MAX_TITLE_LENGTH);
  const sourceLabel = limitText(args.source_label, "电源", MAX_LABEL_LENGTH);
  const resistorLabel = limitText(args.resistor_label, "R1", MAX_LABEL_LENGTH);
  const resistorLabel2 = limitText(args.resistor_label_2, "R2", MAX_LABEL_LENGTH);
  const lampLabel = limitText(args.lamp_label, "灯泡 L", MAX_LABEL_LENGTH);
  const switchLabel = limitText(args.switch_label, "开关 S", MAX_LABEL_LENGTH);
  const noteList = ensureArray<unknown>(args.notes).slice(0, 12).map((item) => limitText(item, "", MAX_LABEL_LENGTH));

  if (template === "parallel") {
    return buildCircuitScenePayload({
      title,
      notes: noteList.length ? noteList : ["并联支路共享电源两端"],
      lanes: [
        { name: "main", items: [{ id: "bat", type: "battery", label: sourceLabel }] },
        { name: "branch1", items: [{ id: "r1", type: "resistor", label: resistorLabel }] },
        { name: "branch2", items: [{ id: "r2", type: "resistor", label: resistorLabel2 }] },
      ],
    });
  }

  if (template === "switch_lamp") {
    return buildCircuitScenePayload({
      title,
      notes: noteList.length ? noteList : ["开关闭合时灯泡导通"],
      lanes: [
        {
          name: "main",
          items: [
            { id: "bat", type: "battery", label: sourceLabel },
            { id: "sw", type: "switch", label: switchLabel },
            { id: "lamp", type: "lamp", label: lampLabel },
          ],
        },
      ],
    });
  }

  if (template === "source_resistor") {
    return buildCircuitScenePayload({
      title,
      notes: noteList.length ? noteList : ["基础电源-电阻回路"],
      lanes: [
        {
          name: "main",
          items: [
            { id: "bat", type: "battery", label: sourceLabel },
            { id: "r1", type: "resistor", label: resistorLabel },
            { id: "gnd", type: "ground", label: "地" },
          ],
        },
      ],
    });
  }

  if (template === "transistor_switch") {
    return buildCircuitScenePayload({
      title,
      notes: noteList.length ? noteList : ["基极经电阻驱动三极管开关"],
      lanes: [
        {
          name: "main",
          items: [
            { id: "bat", type: "battery", label: sourceLabel, x: 110, y: 160 },
            { id: "rb", type: "resistor", label: resistorLabel || "Rb", x: 260, y: 160 },
            { id: "q1", type: "transistor", label: "Q1", x: 430, y: 230 },
            { id: "load", type: "lamp", label: lampLabel || "负载", x: 580, y: 160 },
          ],
        },
      ],
      scene_attachments: [
        { type: "base_feed", source: "rb", target: "q1", label: "B" },
        { type: "return_rail", source: "q1", target: "bat", y: 360 },
      ],
      scene_wires: [
        { x1: 430, y1: 206, x2: 430, y2: 160 },
        { x1: 580, y1: 160, x2: 580, y2: 160 },
      ],
    });
  }

  if (template === "relay_driver") {
    return buildCircuitScenePayload({
      title,
      notes: noteList.length ? noteList : ["继电器线圈并联续流二极管"],
      lanes: [
        {
          name: "main",
          items: [
            { id: "bat", type: "battery", label: sourceLabel, x: 110, y: 160 },
            { id: "rb", type: "resistor", label: resistorLabel || "Rb", x: 250, y: 160 },
            { id: "q1", type: "transistor", label: "Q1", x: 400, y: 230 },
            { id: "relay", type: "relay", label: "K1", x: 560, y: 160 },
            { id: "d1", type: "diode", label: "D1", x: 560, y: 100 },
          ],
        },
      ],
      scene_attachments: [
        { type: "base_feed", source: "rb", target: "q1", label: "B" },
        { type: "return_rail", source: "q1", target: "bat", y: 360 },
      ],
      scene_wires: [
        { x1: 400, y1: 206, x2: 400, y2: 160 },
        { x1: 560, y1: 116, x2: 560, y2: 144 },
        { x1: 530, y1: 100, x2: 590, y2: 100 },
        { x1: 530, y1: 100, x2: 530, y2: 160 },
        { x1: 590, y1: 100, x2: 590, y2: 160 },
      ],
    });
  }

  if (template === "buzzer_loop") {
    return buildCircuitScenePayload({
      title,
      notes: noteList.length ? noteList : ["开关闭合后蜂鸣器回路导通"],
      lanes: [
        {
          name: "main",
          items: [
            { id: "bat", type: "battery", label: sourceLabel },
            { id: "sw", type: "switch", label: switchLabel },
            { id: "bz", type: "buzzer", label: lampLabel || "蜂鸣器" },
            { id: "r1", type: "resistor", label: resistorLabel },
          ],
        },
      ],
      scene_attachments: [
        { type: "return_rail", source: "r1", target: "bat", y: 360 },
      ],
    });
  }

  if (template === "opamp_follower") {
    return buildCircuitScenePayload({
      title,
      notes: noteList.length ? noteList : ["输出直接反馈到反相端的电压跟随器"],
      lanes: [
        {
          name: "main",
          items: [
            { id: "src", type: "source", label: "Vin", x: 120, y: 180 },
            { id: "op1", type: "opamp", label: "A1", x: 380, y: 240 },
            { id: "load", type: "lamp", label: lampLabel || "Vout", x: 600, y: 240 },
          ],
        },
      ],
      scene_attachments: [
        { type: "feedback", source: "load", target: "op1", y: 360, label: "反馈" },
      ],
      scene_wires: [
        { x1: 120, y1: 180, x2: 220, y2: 180 },
        { x1: 220, y1: 180, x2: 220, y2: 216, label: "+" },
        { x1: 220, y1: 216, x2: 356, y2: 216 },
      ],
    });
  }

  if (template === "led_resistor") {
    return buildCircuitScenePayload({
      title,
      notes: noteList.length ? noteList : ["LED 前串联限流电阻"],
      lanes: [
        {
          name: "main",
          items: [
            { id: "bat", type: "battery", label: sourceLabel },
            { id: "r1", type: "resistor", label: resistorLabel },
            { id: "led", type: "led", label: lampLabel || "LED" },
          ],
        },
      ],
    });
  }

  if (template === "meter_loop") {
    return buildCircuitScenePayload({
      title,
      notes: noteList.length ? noteList : ["电流表串联，电压表跨接电阻两端"],
      lanes: [
        {
          name: "main",
          items: [
            { id: "bat", type: "battery", label: sourceLabel },
            { id: "amm", type: "ammeter", label: "A" },
            { id: "r1", type: "resistor", label: resistorLabel },
          ],
        },
      ],
      scene_attachments: [
        { type: "voltmeter_parallel", target: "r1", label: "V" },
        { type: "return_rail", source: "r1", target: "bat", y: 360 },
      ],
    });
  }

  return buildCircuitScenePayload({
    title,
    notes: noteList.length ? noteList : ["串联电路中电流依次流过各元件"],
    lanes: [
      {
        name: "main",
        items: [
          { id: "bat", type: "battery", label: sourceLabel },
          { id: "r1", type: "resistor", label: resistorLabel },
          { id: "lamp", type: "lamp", label: lampLabel },
        ],
      },
    ],
  });
}

function normalizeShape3DPoint(item: unknown, path = "point") {
  if (Array.isArray(item)) {
    if (item.length < 3) throw new Error(`${path} must contain 3 numbers`);
    return {
      x: parseNumber(item[0], 0),
      y: parseNumber(item[1], 0),
      z: parseNumber(item[2], 0),
      label: "",
    };
  }
  if (!item || typeof item !== "object") throw new Error(`${path} must be a [x,y,z] array or { x, y, z } object`);
  const record = item as Record<string, unknown>;
  const hasCoords = record.x !== undefined && record.y !== undefined && record.z !== undefined;
  if (!hasCoords) throw new Error(`${path} must include x, y, and z`);
  return {
    x: parseNumber(record.x, 0),
    y: parseNumber(record.y, 0),
    z: parseNumber(record.z, 0),
    label: limitText(record.label, "", MAX_LABEL_LENGTH),
  };
}

function normalizeShape3DPointSet(item: unknown, index: number, fallbackColor: string) {
  const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
  const rawPoints = ensureArray<unknown>(record.points);
  if (rawPoints.length < 1) throw new Error(`points[${index}] must include a points array`);
  const points = rawPoints.slice(0, MAX_3D_POINTS).map((point, pointIndex) => normalizeShape3DPoint(point, `points[${index}].points[${pointIndex}]`));
  if (points.length < 1) throw new Error(`points[${index}] must include at least 1 point`);
  return {
    label: limitText(record.label, `points${index + 1}`, MAX_LABEL_LENGTH),
    color: limitText(record.color, fallbackColor, 32),
    size: Math.max(2, Math.min(14, parseNumber(record.size, 5))),
    labels: Boolean(record.labels),
    points,
  };
}

function sanitizeShapePayload(args: Record<string, unknown>) {
  const allowedShapes = new Set(["cube", "sphere", "cylinder", "cone", "vector3d", "surface3d"]);
  const allowedColorScales = new Set(["Viridis", "Cividis", "Turbo", "Jet", "Plasma"]);
  const shape = String(args.shape || "cube");
  const safeShape = allowedShapes.has(shape) ? shape : "cube";
  const xMin = parseNumber(args.x_min, -3);
  const xMax = parseNumber(args.x_max, 3);
  const yMin = parseNumber(args.y_min, -3);
  const yMax = parseNumber(args.y_max, 3);
  const baseColor = limitText(args.color, "#4f46e5", 32);
  const defaultSamples = Math.max(8, Math.min(MAX_SURFACE_SAMPLES, parseInteger(args.samples, 36)));
  const defaultColorScaleInput = String(args.colorscale || "Viridis");
  const defaultColorScale = allowedColorScales.has(defaultColorScaleInput) ? defaultColorScaleInput : "Viridis";

  const surfaces = ensureArray<unknown>(args.surfaces).slice(0, MAX_3D_SURFACES).map((item, index) => {
    const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
    const expr = limitText(record.expr, "", 400);
    if (!expr) throw new Error(`surfaces[${index}].expr is required`);
    const surfaceXMin = parseNumber(record.x_min, xMin);
    const surfaceXMax = parseNumber(record.x_max, xMax);
    const surfaceYMin = parseNumber(record.y_min, yMin);
    const surfaceYMax = parseNumber(record.y_max, yMax);
    if (!(surfaceXMax > surfaceXMin)) throw new Error(`surfaces[${index}].x_max must be greater than x_min`);
    if (!(surfaceYMax > surfaceYMin)) throw new Error(`surfaces[${index}].y_max must be greater than y_min`);
    const scaleInput = String(record.colorscale || defaultColorScale);
    return {
      expr,
      label: limitText(record.label, `f${index + 1}(x,y)`, MAX_LABEL_LENGTH),
      color: limitText(record.color, baseColor, 32),
      colorscale: allowedColorScales.has(scaleInput) ? scaleInput : defaultColorScale,
      show_scale: record.show_scale === undefined ? args.show_scale !== false : record.show_scale !== false,
      show_contours: record.show_contours === undefined ? Boolean(args.show_contours) : Boolean(record.show_contours),
      x_min: surfaceXMin,
      x_max: surfaceXMax,
      y_min: surfaceYMin,
      y_max: surfaceYMax,
      z_min: record.z_min === undefined ? (args.z_min === undefined ? null : parseNumber(args.z_min, 0)) : parseNumber(record.z_min, 0),
      z_max: record.z_max === undefined ? (args.z_max === undefined ? null : parseNumber(args.z_max, 0)) : parseNumber(record.z_max, 0),
      samples: Math.max(8, Math.min(MAX_SURFACE_SAMPLES, parseInteger(record.samples, defaultSamples))),
      opacity: Math.max(0.15, Math.min(1, parseNumber(record.opacity, 0.88))),
    };
  });

  const lines = ensureArray<unknown>(args.lines).slice(0, MAX_3D_LINES).map((item, index) => {
    const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
    const rawPoints = ensureArray<unknown>(record.points);
    if (rawPoints.length < 2) throw new Error(`lines[${index}] must include a points array with at least 2 points`);
    const points = rawPoints.slice(0, MAX_3D_LINE_POINTS).map((point, pointIndex) => normalizeShape3DPoint(point, `lines[${index}].points[${pointIndex}]`));
    if (points.length < 2) throw new Error(`lines[${index}] must include at least 2 points`);
    return {
      label: limitText(record.label, `line${index + 1}`, MAX_LABEL_LENGTH),
      color: limitText(record.color, baseColor, 32),
      width: Math.max(1, Math.min(10, parseNumber(record.width, 5))),
      points,
    };
  });

  const rawPoints = ensureArray<unknown>(args.points);
  const hasPointSetObjects = rawPoints.some((item) => item && typeof item === "object" && !Array.isArray(item) && Array.isArray((item as Record<string, unknown>).points));
  const hasDirectPoints = rawPoints.some((item) => Array.isArray(item) || (item && typeof item === "object" && !Array.isArray((item as Record<string, unknown>).points)));
  if (hasPointSetObjects && hasDirectPoints) throw new Error("points must be either a direct point list or an array of point-set objects, not both");
  const pointSets = hasPointSetObjects
    ? rawPoints.slice(0, MAX_3D_LINES).map((item, index) => normalizeShape3DPointSet(item, index, baseColor))
    : rawPoints.length > 0
      ? [{
          label: "points",
          color: baseColor,
          size: 5,
          labels: rawPoints.some((item) => !Array.isArray(item) && Boolean((item as Record<string, unknown>).label)),
          points: rawPoints.slice(0, MAX_3D_POINTS).map((item, index) => normalizeShape3DPoint(item, `points[${index}]`)),
        }]
      : [];

  if (safeShape === "surface3d") {
    const expr = limitText(args.expr, "sin(x) * cos(y)", 400);
    if (!(xMax > xMin)) throw new Error("x_max must be greater than x_min");
    if (!(yMax > yMin)) throw new Error("y_max must be greater than y_min");
    const normalizedSurfaces = surfaces.length > 0 ? surfaces : [{
      expr,
      label: limitText(args.title, "surface", MAX_LABEL_LENGTH),
      color: baseColor,
      colorscale: defaultColorScale,
      show_scale: args.show_scale !== false,
      show_contours: Boolean(args.show_contours),
      x_min: xMin,
      x_max: xMax,
      y_min: yMin,
      y_max: yMax,
      z_min: args.z_min === undefined ? null : parseNumber(args.z_min, 0),
      z_max: args.z_max === undefined ? null : parseNumber(args.z_max, 0),
      samples: defaultSamples,
      opacity: 0.9,
    }];
    return {
      shape: safeShape,
      title: limitText(args.title, "3D Function Surface", MAX_TITLE_LENGTH),
      expr,
      x_min: xMin,
      x_max: xMax,
      y_min: yMin,
      y_max: yMax,
      samples: defaultSamples,
      colorscale: defaultColorScale,
      show_scale: args.show_scale !== false,
      show_contours: Boolean(args.show_contours),
      z_min: args.z_min === undefined ? null : parseNumber(args.z_min, 0),
      z_max: args.z_max === undefined ? null : parseNumber(args.z_max, 0),
      color: baseColor,
      surfaces: normalizedSurfaces,
      lines,
      points: pointSets,
    };
  }

  return {
    shape: safeShape,
    title: limitText(args.title, "3D Shape", MAX_TITLE_LENGTH),
    size: parseNumber(args.size, 1),
    radius: parseNumber(args.radius, 1),
    height: parseNumber(args.height, 2),
    vector: ensureArray<unknown>(args.vector).slice(0, 3).map((value) => parseNumber(value, 0)),
    color: baseColor,
    surfaces,
    lines,
    points: pointSets,
  };
}

function normalizePayload(args: Record<string, unknown>, path: string): Record<string, unknown> {
  if (path === "/plot") {
    return {
      __path: "/plot",
      expr: String(args.expr || ""),
      pieces: ensureArray<unknown>(args.pieces).map((item) => {
        const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
        return {
          expr: String(record.expr || ""),
          x_min: parseNumber(record.x_min, -10),
          x_max: parseNumber(record.x_max, 10),
          label: limitText(record.label, "", MAX_LABEL_LENGTH),
          name: limitText(record.name, "", MAX_LABEL_LENGTH),
          color: limitText(record.color, "", 32),
        };
      }),
      x_min: parseNumber(args.x_min, -10),
      x_max: parseNumber(args.x_max, 10),
      points: parseInteger(args.points, 1000),
      title: limitText(args.title, "Function Plot", MAX_TITLE_LENGTH),
      xlabel: limitText(args.xlabel, "x", MAX_LABEL_LENGTH),
      ylabel: limitText(args.ylabel, "y", MAX_LABEL_LENGTH),
      grid: args.grid ?? true,
      annotations: ensureArray<unknown>(args.annotations).slice(0, 24),
    };
  }
  if (path === "/plot_multi") {
    return {
      __path: "/plot_multi",
      exprs: ensureArray<unknown>(args.exprs).map((item) => String(item)),
      labels: Array.isArray(args.labels) ? ensureArray<unknown>(args.labels).map((item) => limitText(item, "", MAX_LABEL_LENGTH)) : args.labels ?? null,
      x_min: parseNumber(args.x_min, -10),
      x_max: parseNumber(args.x_max, 10),
      points: parseInteger(args.points, 1000),
      title: limitText(args.title, "Multi Function Plot", MAX_TITLE_LENGTH),
      xlabel: limitText(args.xlabel, "x", MAX_LABEL_LENGTH),
      ylabel: limitText(args.ylabel, "y", MAX_LABEL_LENGTH),
      grid: args.grid ?? true,
      annotations: ensureArray<unknown>(args.annotations).slice(0, 24),
    };
  }
  if (path === "/plot_bar") {
    return {
      __path: "/plot_bar",
      categories: ensureArray<unknown>(args.categories).map((item) => limitText(item, "", MAX_LABEL_LENGTH)),
      values: ensureArray<unknown>(args.values).map((item) => parseNumber(item, Number.NaN)),
      title: limitText(args.title, "Bar Chart", MAX_TITLE_LENGTH),
      xlabel: limitText(args.xlabel, "Category", MAX_LABEL_LENGTH),
      ylabel: limitText(args.ylabel, "Value", MAX_LABEL_LENGTH),
      grid: args.grid ?? true,
      annotations: ensureArray<unknown>(args.annotations).slice(0, 24),
    };
  }
  return {
    __path: "/plot_series",
    series: ensureArray<unknown>(args.series),
    title: limitText(args.title, "Series Plot", MAX_TITLE_LENGTH),
    xlabel: limitText(args.xlabel, "x", MAX_LABEL_LENGTH),
    ylabel: limitText(args.ylabel, "y", MAX_LABEL_LENGTH),
    grid: args.grid ?? true,
    annotations: ensureArray<unknown>(args.annotations).slice(0, 24),
    y_min: args.y_min,
    y_max: args.y_max,
    y_scale: args.y_scale,
    bar_style: args.bar_style,
    categories: args.categories,
    debug: args.debug,
  };
}

async function buildPackedUrl(path: string, payload: Record<string, unknown>, origin: string) {
  return `${origin}${path}?d=${encodeURIComponent(await toCompressedBase64UrlFromJson(payload))}`;
}

type ShortLinkRecord = {
  path: string;
  payload: Record<string, unknown>;
};

function isSupportedShortLinkPath(path: string) {
  return path === "/png"
    || path === "/force.svg"
    || path === "/force-analysis.svg"
    || path === "/circuit.svg"
    || path === "/venn.svg"
    || path === "/c-memory.svg"
    || path === "/shape3d.html";
}

function shortLinkUrl(origin: string, token: string) {
  return `${origin}${SHORT_LINK_PATH_PREFIX}${token}`;
}

function createShortLinkToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(SHORT_LINK_TOKEN_LENGTH));
  return Array.from(bytes, (byte) => (byte % 36).toString(36)).join("");
}

async function storeShortLink(env: Env, path: string, payload: Record<string, unknown>) {
  if (!isSupportedShortLinkPath(path)) throw new Error("unsupported_short_link_path");
  const record: ShortLinkRecord = { path, payload };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const token = createShortLinkToken();
    const key = `short:${token}`;
    const existing = await env.SHORT_LINKS.get(key);
    if (existing) continue;
    await env.SHORT_LINKS.put(key, JSON.stringify(record), {
      expirationTtl: SHORT_LINK_TTL_SECONDS,
    });
    return token;
  }

  throw new Error("short_link_token_generation_failed");
}

async function buildShortUrl(env: Env, path: string, payload: Record<string, unknown>, origin: string) {
  const packed = await toCompressedBase64UrlFromJson(payload);
  if (packed.length <= 3600) return `${origin}${path}?d=${packed}`;
  const token = await storeShortLink(env, path, payload);
  return shortLinkUrl(origin, token);
}

async function buildPlotLinkData(payload: Record<string, unknown>, origin: string, env: Env) {
  const warnings = collectPayloadWarnings(payload);
  return {
    ok: true,
    kind: "plot",
    title: limitText(payload.title, "Plot", MAX_TITLE_LENGTH),
    warnings,
    mime_type: "image/png",
    png_url: await buildShortUrl(env, "/png", payload, origin),
    payload,
  };
}

function collectPayloadWarnings(payload: Record<string, unknown>) {
  return [payload.warning].filter((item): item is string => typeof item === "string" && item.length > 0);
}

async function buildSvgLinkData(env: Env, path: string, payload: Record<string, unknown>, origin: string, titleFallback: string) {
  return {
    ok: true,
    kind: "diagram",
    title: limitText(payload.title, titleFallback, MAX_TITLE_LENGTH),
    warnings: collectPayloadWarnings(payload),
    svg_url: await buildShortUrl(env, path, payload, origin),
    payload,
  };
}

async function buildHtmlLinkData(env: Env, path: string, payload: Record<string, unknown>, origin: string, titleFallback: string) {
  return {
    ok: true,
    kind: "html3d",
    title: limitText(payload.title, titleFallback, MAX_TITLE_LENGTH),
    warnings: collectPayloadWarnings(payload),
    html_url: await buildShortUrl(env, path, payload, origin),
    payload,
  };
}

async function pngLinkPayload(args: Record<string, unknown>, path: string, origin: string, env: Env) {
  const payload = normalizePayload(args, path);
  const spec = buildSpecFromPayload(payload);
  const base = await buildPlotLinkData(payload, origin, env);
  // Collect all warnings: payload-level + transform-level from spec
  const transformWarnings: string[] = (spec as any).warnings ?? [];
  const payloadWarnings = collectPayloadWarnings(payload);
  const allWarnings = [...payloadWarnings, ...transformWarnings];
  // Attach transform debug trace if available (only when debug:true in args)
  const dbg = (spec as any)?.debug;
  if (args.debug === true && dbg && Array.isArray(dbg.stages) && dbg.stages.length > 0) {
    return { ...base, warnings: allWarnings.length > 0 ? allWarnings : undefined, debug: dbg };
  }
  return { ...base, warnings: allWarnings.length > 0 ? allWarnings : undefined };
}

async function resolveShortLink(env: Env, token: string) {
  const key = `short:${token}`;
  const raw = await env.SHORT_LINKS.get(key);
  if (!raw) return null;
  const record = JSON.parse(raw) as ShortLinkRecord;
  if (!record || typeof record !== "object" || !isSupportedShortLinkPath(String(record.path)) || !record.payload || typeof record.payload !== "object") {
    throw new Error("bad_short_link_record");
  }
  return record;
}

async function renderShortLink(record: ShortLinkRecord, env: Env) {
  if (record.path === "/png") {
    const spec = buildSpecFromPayload(record.payload);
    return renderPngResponse(renderSpecToSvg(spec), env);
  }
  if (record.path === "/force.svg") {
    return new Response(renderForceDiagramSvg(record.payload), {
      status: 200,
      headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" },
    });
  }
  if (record.path === "/force-analysis.svg") {
    return new Response(renderForceAnalysisSvg(record.payload), {
      status: 200,
      headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" },
    });
  }
  if (record.path === "/circuit.svg") {
    return new Response(renderCircuitDiagramSvg(sanitizeCircuitPayloadFromArgs(record.payload)), {
      status: 200,
      headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" },
    });
  }
  if (record.path === "/venn.svg") {
    return new Response(renderVennDiagramSvg(record.payload), {
      status: 200,
      headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" },
    });
  }
  if (record.path === "/c-memory.svg") {
    return new Response(renderCMemoryDiagramSvg(record.payload), {
      status: 200,
      headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" },
    });
  }
  if (record.path === "/shape3d.html") {
    return new Response(renderShape3DHtml(record.payload), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" },
    });
  }
  return Response.json({ ok: false, error: "bad_short_link_record" }, { status: 400, headers: corsHeaders() });
}

function getTeachingParams(args: Record<string, unknown>) {
  return (args.params && typeof args.params === "object") ? args.params as Record<string, unknown> : {};
}

function buildTeachingPlotPayload(args: Record<string, unknown>): Record<string, unknown> {
  const topic = limitText(args.topic, "parabola", 32);
  const params = getTeachingParams(args);
  const title = limitText(args.title, "Teaching template", MAX_TITLE_LENGTH);
  const highlight = args.highlight !== false;
  if (topic === "definite_integral") {
    const expr = limitText(params.expr, "x^2", MAX_EXPR_LENGTH);
    const a = parseNumber(params.a, 0);
    const b = parseNumber(params.b, 2);
    return normalizePayload({
      expr,
      x_min: parseNumber(params.x_min, Math.min(a, b) - 1),
      x_max: parseNumber(params.x_max, Math.max(a, b) + 1),
      points: parseInteger(params.points, 1200),
      title: title === "Teaching template" ? `定积分：${expr}` : title,
      xlabel: "x",
      ylabel: "f(x)",
      annotations: highlight ? [
        { kind: "area", x_min: a, x_max: b, label: `积分区间 [${a}, ${b}]`, color: "#7c3aed", opacity: 0.2 },
        { kind: "vertical_line", x: a, label: `下限 a=${a}`, color: "#9333ea" },
        { kind: "vertical_line", x: b, label: `上限 b=${b}`, color: "#9333ea" },
      ] : [],
    }, "/plot");
  }
  if (topic === "tangent_derivative") {
    const expr = limitText(params.expr, "x^2", MAX_EXPR_LENGTH);
    const x0 = parseNumber(params.x0, 1);
    const y0 = parseNumber(params.y0, x0 * x0);
    const slope = parseNumber(params.slope, 2 * x0);
    const tangent = `${slope}*(x-${x0})+${y0}`;
    return normalizePayload({
      exprs: [expr, tangent],
      labels: ["原函数 f(x)", `切线斜率 f'(${x0})≈${slope}`],
      x_min: parseNumber(params.x_min, x0 - 4),
      x_max: parseNumber(params.x_max, x0 + 4),
      points: parseInteger(params.points, 1200),
      title: title === "Teaching template" ? "导数的切线意义" : title,
      xlabel: "x",
      ylabel: "y",
      annotations: highlight ? [
        { kind: "point", x: x0, y: y0, label: `切点 (${x0}, ${y0})`, color: "#dc2626" },
        { kind: "vertical_line", x: x0, label: `x0=${x0}`, color: "#16a34a" },
        { kind: "label", x: x0 + 0.4, y: y0 + slope, text: `斜率≈${slope}`, color: "#7c3aed" },
      ] : [],
    }, "/plot_multi");
  }
  if (topic === "fourier_series") {
    const terms = Math.max(1, Math.min(15, parseInteger(params.terms, 5)));
    const expr = Array.from({ length: terms }, (_, index) => {
      const n = 2 * index + 1;
      return `sin(${n}*x)/${n}`;
    }).join("+");
    return normalizePayload({
      expr: `(4/${Math.PI})*(${expr})`,
      x_min: parseNumber(params.x_min, -Math.PI),
      x_max: parseNumber(params.x_max, Math.PI),
      points: parseInteger(params.points, 1600),
      title: title === "Teaching template" ? `方波傅里叶级数近似：${terms} 项` : title,
      xlabel: "x",
      ylabel: "S_N(x)",
      annotations: highlight ? [
        { kind: "vertical_line", x: 0, label: "跳变点", color: "#dc2626" },
        { kind: "label", x: 0.35, y: 1.1, text: "Gibbs 现象：跳变附近过冲", color: "#7c3aed" },
      ] : [],
    }, "/plot");
  }
  if (topic === "projectile_motion") {
    const v0 = parseNumber(params.v0, 20);
    const angle = parseNumber(params.angle_deg, 45) * Math.PI / 180;
    const g = Math.max(0.1, parseNumber(params.g, 9.8));
    const vx = v0 * Math.cos(angle);
    const vy = v0 * Math.sin(angle);
    const flight = Math.max(0.1, 2 * vy / g);
    const range = vx * flight;
    const peakT = vy / g;
    const peakX = vx * peakT;
    const peakY = vy * peakT - 0.5 * g * peakT * peakT;
    return normalizePayload({
      expr: `${Math.tan(angle)}*x-${g}/(2*${vx * vx})*x^2`,
      x_min: 0,
      x_max: parseNumber(params.x_max, range * 1.08),
      points: parseInteger(params.points, 1200),
      title: title === "Teaching template" ? "抛体运动轨迹" : title,
      xlabel: "水平位移 x",
      ylabel: "高度 y",
      annotations: highlight ? [
        { kind: "point", x: peakX, y: peakY, label: "最高点", color: "#dc2626" },
        { kind: "point", x: range, y: 0, label: "落点", color: "#2563eb" },
        { kind: "label", x: range * 0.08, y: peakY * 0.7, text: `vx=${vx.toFixed(1)}, vy=${vy.toFixed(1)}`, color: "#7c3aed" },
      ] : [],
    }, "/plot");
  }
  if (topic === "simple_harmonic_motion") {
    const amp = parseNumber(params.amplitude, 1);
    const omega = Math.max(0.01, parseNumber(params.omega, 2));
    const tMax = parseNumber(params.t_max, 2 * Math.PI / omega * 2);
    return normalizePayload({
      exprs: [`${amp}*cos(${omega}*x)`, `-${amp * omega}*sin(${omega}*x)`, `-${amp * omega * omega}*cos(${omega}*x)`],
      labels: ["位移 x(t)", "速度 v(t)", "加速度 a(t)"],
      x_min: 0,
      x_max: tMax,
      points: parseInteger(params.points, 1600),
      title: title === "Teaching template" ? "简谐振动：位移、速度、加速度" : title,
      xlabel: "时间 t",
      ylabel: "归一化量",
      annotations: highlight ? [
        { kind: "vertical_line", x: Math.PI / (2 * omega), label: "T/4", color: "#7c3aed" },
        { kind: "label", x: Math.PI / omega, y: amp, text: "a(t) 与 x(t) 反相", color: "#dc2626" },
      ] : [],
    }, "/plot_multi");
  }
  if (topic === "stress_strain") {
    const yieldStrain = parseNumber(params.yield_strain, 0.02);
    const fractureStrain = parseNumber(params.fracture_strain, 0.3);
    const elasticModulus = parseNumber(params.elastic_modulus, 200);
    const yieldStress = elasticModulus * yieldStrain;
    const peakStress = parseNumber(params.peak_stress, yieldStress * 1.8);
    return normalizePayload({
      series: [{
        name: "应力-应变曲线",
        type: "line+scatter",
        color: "#2563eb",
        points: [
          [0, 0],
          [yieldStrain, yieldStress],
          [fractureStrain * 0.6, peakStress],
          [fractureStrain, peakStress * 0.75],
        ],
      }],
      title: title === "Teaching template" ? "材料应力-应变曲线" : title,
      xlabel: "应变 ε",
      ylabel: "应力 σ",
      annotations: highlight ? [
        { kind: "point", x: yieldStrain, y: yieldStress, label: "屈服点", color: "#dc2626" },
        { kind: "point", x: fractureStrain * 0.6, y: peakStress, label: "抗拉强度", color: "#7c3aed" },
        { kind: "point", x: fractureStrain, y: peakStress * 0.75, label: "断裂", color: "#111827" },
        { kind: "label", x: yieldStrain * 0.35, y: yieldStress * 0.65, text: "弹性区", color: "#16a34a" },
      ] : [],
    }, "/plot_series");
  }
  if (topic === "energy_conservation") {
    const height = parseNumber(params.height, 10);
    const g = Math.max(0.1, parseNumber(params.g, 9.8));
    const total = g * height;
    return normalizePayload({
      exprs: [`${g}*(${height}-x)`, `${g}*x`, `${total}`],
      labels: ["重力势能 Ep", "动能 Ek", "机械能 E"],
      x_min: 0,
      x_max: height,
      points: parseInteger(params.points, 1200),
      title: title === "Teaching template" ? "机械能守恒：势能与动能转换" : title,
      xlabel: "下落距离 s",
      ylabel: "单位质量能量",
      annotations: highlight ? [
        { kind: "label", x: height * 0.15, y: total * 0.95, text: "总机械能保持不变", color: "#16a34a" },
        { kind: "point", x: height / 2, y: total / 2, label: "Ep=Ek", color: "#dc2626" },
      ] : [],
    }, "/plot_multi");
  }
  if (topic === "band_gap") {
    const gap = Math.max(0, parseNumber(params.gap, 1.1));
    const valenceTop = 0;
    const conductionBottom = gap;
    return normalizePayload({
      series: [
        { name: "价带 Ev", type: "line", color: "#2563eb", points: [[0, valenceTop], [1, valenceTop]] },
        { name: "导带 Ec", type: "line", color: "#dc2626", points: [[0, conductionBottom], [1, conductionBottom]] },
        { name: "费米能级 Ef", type: "line", color: "#16a34a", points: [[0, gap / 2], [1, gap / 2]] },
      ],
      title: title === "Teaching template" ? "半导体能带图：带隙 Eg" : title,
      xlabel: "k 空间示意",
      ylabel: "能量 E",
      annotations: highlight ? [
        { kind: "area", x_min: 0, x_max: 1, label: `禁带 Eg=${gap.toFixed(2)} eV`, color: "#f97316", opacity: 0.12 },
        { kind: "label", x: 0.12, y: conductionBottom + 0.12, text: "导带", color: "#dc2626" },
        { kind: "label", x: 0.12, y: valenceTop - 0.12, text: "价带", color: "#2563eb" },
      ] : [],
    }, "/plot_series");
  }
  const a = parseNumber(params.a, 1);
  const h = parseNumber(params.h, 0);
  const k = parseNumber(params.k, 0);
  const p = 1 / (4 * a);
  return normalizePayload({
    expr: `${a}*(x-${h})^2+${k}`,
    x_min: parseNumber(params.x_min, h - 5),
    x_max: parseNumber(params.x_max, h + 5),
    points: parseInteger(params.points, 1200),
    title: title === "Teaching template" ? "抛物线关键几何量" : title,
    xlabel: "x",
    ylabel: "y",
    annotations: highlight ? [
      { kind: "point", x: h, y: k, label: `顶点 (${h}, ${k})`, color: "#dc2626" },
      { kind: "point", x: h, y: k + p, label: "焦点", color: "#2563eb" },
      { kind: "vertical_line", x: h, label: "对称轴", color: "#16a34a" },
      { kind: "label", x: h + 0.4, y: k - p, text: `准线 y=${(k - p).toFixed(2)}`, color: "#7c3aed" },
    ] : [],
  }, "/plot");
}

function buildRcCircuitPayload(title: string) {
  return buildCircuitScenePayload({
    title,
    notes: ["电源通过 R 给 C 充电，形成一阶 RC 回路", "电容电压逐渐接近 V0，电流按指数衰减"],
    lanes: [
      {
        name: "main",
        items: [
          { id: "bat", type: "battery", label: "V0" },
          { id: "r1", type: "resistor", label: "R" },
          { id: "c1", type: "capacitor", label: "C" },
          { id: "gnd", type: "ground", label: "地" },
        ],
      },
    ],
  });
}

function buildRcVoltagePayload(args: Record<string, unknown>) {
  const params = getTeachingParams(args);
  const v0 = parseNumber(params.v0, 5);
  const tau = Math.max(0.01, parseNumber(params.tau, 1));
  const tMax = parseNumber(params.t_max, 5 * tau);
  return normalizePayload({
    expr: `${v0}*(1-exp(-x/${tau}))`,
    x_min: 0,
    x_max: tMax,
    points: 1200,
    title: "RC 电容电压上升曲线",
    xlabel: "时间 t",
    ylabel: "电容电压 Vc(t)",
    annotations: [
      { kind: "vertical_line", x: tau, label: "τ=RC", color: "#7c3aed" },
      { kind: "label", x: tau * 1.08, y: v0 * 0.632, text: "63.2% V0", color: "#7c3aed" },
    ],
  }, "/plot");
}

function buildRcCurrentPayload(args: Record<string, unknown>) {
  const params = getTeachingParams(args);
  const i0 = parseNumber(params.i0, 1);
  const tau = Math.max(0.01, parseNumber(params.tau, 1));
  const tMax = parseNumber(params.t_max, 5 * tau);
  return normalizePayload({
    expr: `${i0}*exp(-x/${tau})`,
    x_min: 0,
    x_max: tMax,
    points: 1200,
    title: "RC 充电电流衰减曲线",
    xlabel: "时间 t",
    ylabel: "电流 i(t)",
    annotations: [{ kind: "vertical_line", x: tau, label: "τ=RC", color: "#7c3aed" }],
  }, "/plot");
}

function buildRlcTransientPayload(args: Record<string, unknown>) {
  const params = getTeachingParams(args);
  const alpha = Math.max(0.01, parseNumber(params.alpha, 0.25));
  const omega = Math.max(0.01, parseNumber(params.omega, 4));
  const v0 = parseNumber(params.v0, 1);
  const tMax = parseNumber(params.t_max, 8 / alpha);
  return normalizePayload({
    expr: `${v0}*exp(-${alpha}*x)*cos(${omega}*x)`,
    x_min: 0,
    x_max: tMax,
    points: 1800,
    title: "RLC 欠阻尼暂态响应",
    xlabel: "时间 t",
    ylabel: "归一化响应",
    annotations: [
      { kind: "label", x: 1 / alpha, y: v0 * 0.37, text: "包络 e^{-αt}", color: "#7c3aed" },
      { kind: "vertical_line", x: Math.PI / omega, label: "半周期", color: "#2563eb" },
    ],
  }, "/plot");
}

function buildVennProbabilityPayload(args: Record<string, unknown>, stage = "formula") {
  const params = getTeachingParams(args);
  const title = limitText(args.title, "Venn probability", MAX_TITLE_LENGTH);
  const a = limitText(params.a_label, "A", MAX_LABEL_LENGTH);
  const b = limitText(params.b_label, "B", MAX_LABEL_LENGTH);
  const pA = parseNumber(params.p_a, 0.6);
  const pB = parseNumber(params.p_b, 0.5);
  const pAB = Math.max(0, Math.min(Math.min(pA, pB), parseNumber(params.p_ab, 0.2)));
  const union = Math.max(0, Math.min(1, pA + pB - pAB));
  const outside = Math.max(0, Math.min(1, 1 - union));
  const aOnly = Math.max(0, pA - pAB);
  const bOnly = Math.max(0, pB - pAB);
  const regions = stage === "intersection"
    ? { A_B: `P(${a}∩${b})=${pAB.toFixed(2)}` }
    : stage === "union"
      ? { A_only: `${a}独有=${aOnly.toFixed(2)}`, A_B: `交集=${pAB.toFixed(2)}`, B_only: `${b}独有=${bOnly.toFixed(2)}`, outside: `外部=${outside.toFixed(2)}` }
      : { A_only: `P(${a})`, A_B: `交集`, B_only: `P(${b})`, outside: `1-P(${a}∪${b})`, };
  return sanitizeVennPayload({
    title: title === "Venn probability" ? `P(${a}∪${b}) = P(${a}) + P(${b}) - P(${a}∩${b})` : title,
    sets: [
      { label: a, color: "#60a5fa" },
      { label: b, color: "#f97316" },
    ],
    regions,
  });
}

function buildCPointerArrayPayload(args: Record<string, unknown>, stage = "array") {
  const params = getTeachingParams(args);
  const title = limitText(args.title, "C pointer and array memory", MAX_TITLE_LENGTH);
  const base = Math.max(0, Math.floor(parseNumber(params.base_address, 0x1000)));
  const values = ensureArray<unknown>(params.values).length > 0 ? ensureArray<unknown>(params.values).slice(0, 6) : [10, 20, 30, 40];
  const elementType = limitText(params.type, "int", MAX_LABEL_LENGTH);
  const elementBytes = Math.max(1, Math.min(16, parseInteger(params.element_bytes, 4)));
  const blocks = values.map((value, index) => ({
    name: `arr[${index}]`,
    type: elementType,
    value: String(value),
    address: `0x${(base + index * elementBytes).toString(16)}`,
    bytes: [String(value)],
    note: index === 0 ? "数组名 arr 表示首元素地址" : `arr+${index} 向后移动 ${index * elementBytes} 字节`,
  }));
  if (stage !== "array") {
    blocks.unshift({
      name: "p",
      type: `${elementType}*`,
      value: stage === "dereference" ? `*(arr+1)=${String(values[1] ?? values[0])}` : "arr",
      address: `0x${(base - elementBytes).toString(16)}`,
      bytes: [`0x${base.toString(16)}`],
      note: stage === "dereference" ? "解引用会读取目标地址里的值" : "指针变量保存地址，不保存整个数组",
    });
  }
  return sanitizeCMemoryPayload({
    title: title === "C pointer and array memory" ? "C 数组退化与指针运算" : title,
    blocks,
  });
}

function buildCStructLayoutPayload(args: Record<string, unknown>, stage = "layout") {
  const params = getTeachingParams(args);
  const rawFields = ensureArray<unknown>(params.fields);
  const fields = rawFields.length > 0 ? rawFields.slice(0, 8) : [
    { name: "id", type: "int", size: 4 },
    { name: "grade", type: "char", size: 1 },
    { name: "score", type: "double", size: 8 },
  ];
  let offset = 0;
  const blocks = fields.map((field) => {
    const record = field && typeof field === "object" ? field as Record<string, unknown> : {};
    const name = limitText(record.name, "field", MAX_LABEL_LENGTH);
    const type = limitText(record.type, "int", MAX_LABEL_LENGTH);
    const size = Math.max(1, Math.min(16, parseInteger(record.size, type === "double" ? 8 : type === "char" ? 1 : 4)));
    const align = Math.min(8, size);
    const padding = (align - (offset % align)) % align;
    if (padding > 0) offset += padding;
    const address = offset;
    offset += size;
    return {
      name,
      type,
      value: `${size}B`,
      address: `+${address}`,
      bytes: [`${size} 字节`],
      note: padding > 0 ? `前面插入 ${padding} 字节 padding 以满足对齐` : "字段按对齐要求放入结构体",
    };
  });
  if (stage === "padding") {
    blocks.unshift({ name: "padding", type: "对齐填充", value: "隐藏字节", address: "+?", bytes: ["pad"], note: "padding 不属于任何字段，但会增加 sizeof(struct)" });
  }
  if (stage === "sizeof") {
    const tailPadding = (8 - (offset % 8)) % 8;
    if (tailPadding > 0) offset += tailPadding;
    blocks.push({ name: "sizeof", type: "总大小", value: `${offset}B`, address: "", bytes: [`${offset} 字节`], note: "结构体数组要求每个元素起始地址也满足最大对齐" });
  }
  return sanitizeCMemoryPayload({ title: "C 结构体内存布局与 padding / sizeof", blocks });
}

async function buildTeachingTemplate(args: Record<string, unknown>, env: Env, origin: string) {
  const topic = limitText(args.topic, "parabola", 32);
  if (topic === "venn_probability") {
    return buildSvgLinkData(env, "/venn.svg", buildVennProbabilityPayload(args), origin, "Venn probability");
  }
  if (topic === "c_pointer_array") {
    return buildSvgLinkData(env, "/c-memory.svg", buildCPointerArrayPayload(args), origin, "C pointer and array memory");
  }
  if (topic === "c_struct_layout") {
    return buildSvgLinkData(env, "/c-memory.svg", buildCStructLayoutPayload(args), origin, "C struct layout");
  }
  if (topic === "rc_charging") {
    const circuitPayload = buildRcCircuitPayload(limitText(args.title, "RC 充电电路", MAX_TITLE_LENGTH));
    return buildSvgLinkData(env, "/circuit.svg", circuitPayload, origin, "RC 充电电路");
  }
  if (topic === "incline_force") {
    const params = getTeachingParams(args);
    const payload = sanitizeForceTemplatePayload({ ...params, title: args.title ?? "斜面受力分析", template: "incline" });
    return buildSvgLinkData(env, "/force-analysis.svg", payload, origin, "斜面受力分析");
  }
  if (topic === "rlc_transient") {
    return buildPlotLinkData(buildRlcTransientPayload(args), origin, env);
  }
  return buildPlotLinkData(buildTeachingPlotPayload(args), origin, env);
}

async function buildTeachingSequence(args: Record<string, unknown>, env: Env, origin: string) {
  const topic = limitText(args.topic, "rc_charging", 32);
  if (topic === "parabola") {
    const params = getTeachingParams(args);
    const a = parseNumber(params.a, 1);
    const h = parseNumber(params.h, 0);
    const k = parseNumber(params.k, 0);
    const base = buildTeachingPlotPayload({ ...args, params: { ...params, a, h, k }, title: "1. 抛物线图像" });
    const vertex = normalizePayload({
      expr: `${a}*(x-${h})^2+${k}`,
      x_min: parseNumber(params.x_min, h - 6),
      x_max: parseNumber(params.x_max, h + 6),
      points: parseInteger(params.points, 1200),
      title: "2. 顶点与对称轴",
      xlabel: "x",
      ylabel: "y",
      annotations: [
        { kind: "vertical_line", x: h, label: `x=${h}`, color: "#7c3aed" },
        { kind: "point", x: h, y: k, label: `V(${h},${k})`, color: "#dc2626" },
      ],
    }, "/plot");
    const items = [
      { title: "1. 抛物线图像", kind: "plot", png_url: await buildShortUrl(env, "/png", base, origin), explanation: "先看开口方向、顶点位置和整体平移。", payload: base },
      { title: "2. 顶点与对称轴", kind: "plot", png_url: await buildShortUrl(env, "/png", vertex, origin), explanation: "顶点决定最值点，对称轴穿过顶点。", payload: vertex },
    ];
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "Parabola sequence", MAX_TITLE_LENGTH), warnings: [], count: items.length, items };
  }
  if (topic === "definite_integral") {
    const params = getTeachingParams(args);
    const expr = limitText(params.expr, "x^2", MAX_EXPR_LENGTH);
    const xMin = parseNumber(params.x_min, 0);
    const xMax = parseNumber(params.x_max, 3);
    const accumulation = normalizePayload({
      expr,
      x_min: xMin,
      x_max: xMax,
      points: parseInteger(params.points, 1200),
      title: "2. 面积累加的含义",
      xlabel: "x",
      ylabel: "f(x)",
      annotations: [
        { kind: "area", x_min: xMin, x_max: xMax, label: `∫[${xMin},${xMax}] f(x)dx`, color: "rgba(59,130,246,0.18)", opacity: 0.28 },
        { kind: "label", x: (xMin + xMax) / 2, y: Math.max(1, ((xMax - xMin) * 0.6)), text: `区间[${xMin},${xMax}]上的累计面积`, color: "#1d4ed8" },
      ],
    }, "/plot");
    const area = buildTeachingPlotPayload({ ...args, params: { ...params, expr, x_min: xMin, x_max: xMax }, title: "1. 曲线与积分区间" });
    const items = [
      { title: "1. 曲线与积分区间", kind: "plot", png_url: await buildShortUrl(env, "/png", area, origin), explanation: "先固定上下限，明确哪一段曲线下面的面积在被累加。", payload: area },
      { title: "2. 面积累加的含义", kind: "plot", png_url: await buildShortUrl(env, "/png", accumulation, origin), explanation: "定积分表示区间内函数值对自变量累计后的总效果。", payload: accumulation },
    ];
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "Definite integral sequence", MAX_TITLE_LENGTH), warnings: [], count: items.length, items };
  }
  if (topic === "tangent_derivative") {
    const params = getTeachingParams(args);
    const x0 = parseNumber(params.x0, 1);
    const y0 = parseNumber(params.y0, x0 * x0);
    const slope = parseNumber(params.slope, 2 * x0);
    const base = buildTeachingPlotPayload({ ...args, params: { ...params, x0, y0, slope } });
    const derivative = normalizePayload({
      expr: limitText(params.derivative_expr, "2*x", MAX_EXPR_LENGTH),
      x_min: parseNumber(params.x_min, x0 - 4),
      x_max: parseNumber(params.x_max, x0 + 4),
      points: parseInteger(params.points, 1200),
      title: "导函数给出每一点斜率",
      xlabel: "x",
      ylabel: "f'(x)",
      annotations: [{ kind: "point", x: x0, y: slope, label: `f'(${x0})≈${slope}`, color: "#dc2626" }],
    }, "/plot");
    const items = [
      { title: "1. 函数与切线", kind: "plot", png_url: await buildShortUrl(env, "/png", base, origin), explanation: "切点附近用直线近似曲线，切线斜率就是该点导数。", payload: base },
      { title: "2. 导函数读斜率", kind: "plot", png_url: await buildShortUrl(env, "/png", derivative, origin), explanation: "导函数图像的纵坐标表示原函数在同一 x 处的瞬时变化率。", payload: derivative },
    ];
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "Derivative tangent sequence", MAX_TITLE_LENGTH), warnings: [], count: items.length, items };
  }
  if (topic === "fourier_series") {
    const params = getTeachingParams(args);
    const stages = [1, 3, Math.max(5, Math.min(15, parseInteger(params.terms, 7)))];
    const items = await Promise.all(stages.map(async (terms, index) => {
      const payload = buildTeachingPlotPayload({ ...args, params: { ...params, terms }, title: `${index + 1}. ${terms} 项傅里叶近似` });
      return { title: `${index + 1}. ${terms} 项近似`, kind: "plot", png_url: await buildShortUrl(env, "/png", payload, origin), explanation: terms === 1 ? "只保留基波，能看出主要周期。" : "增加高次谐波后，方波边缘更陡，但跳变附近仍有过冲。", payload };
    }));
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "Fourier series sequence", MAX_TITLE_LENGTH), warnings: [], count: items.length, items };
  }
  if (topic === "rlc_transient") {
    const params = getTeachingParams(args);
    const stages = [
      { alpha: parseNumber(params.alpha, 0.8), title: "1. 阻尼较强" },
      { alpha: parseNumber(params.alpha_mid, 0.35), title: "2. 欠阻尼振荡" },
      { alpha: parseNumber(params.alpha_low, 0.12), title: "3. 阻尼较弱" },
    ];
    const items = await Promise.all(stages.map(async (stage) => {
      const payload = buildRlcTransientPayload({ ...args, params: { ...params, alpha: stage.alpha }, title: stage.title });
      payload.title = stage.title;
      return { title: stage.title, kind: "plot", png_url: await buildShortUrl(env, "/png", payload, origin), explanation: "α 越小，振荡衰减越慢；α 越大，能量损耗越快。", payload };
    }));
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "RLC transient sequence", MAX_TITLE_LENGTH), warnings: [], count: items.length, items };
  }
  if (topic === "projectile_motion") {
    const params = getTeachingParams(args);
    const stages = [
      { title: "1. 运动轨迹", angle_deg: parseNumber(params.angle_deg, 45) },
      { title: "2. 低角度射程", angle_deg: parseNumber(params.low_angle_deg, 30) },
      { title: "3. 高角度射高", angle_deg: parseNumber(params.high_angle_deg, 60) },
    ];
    const items = await Promise.all(stages.map(async (stage) => {
      const payload = buildTeachingPlotPayload({ ...args, params: { ...params, angle_deg: stage.angle_deg }, title: stage.title });
      return { title: stage.title, kind: "plot", png_url: await buildShortUrl(env, "/png", payload, origin), explanation: "水平速度保持不变，竖直方向受重力产生匀加速运动。", payload };
    }));
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "Projectile motion sequence", MAX_TITLE_LENGTH), warnings: [], count: items.length, items };
  }
  if (topic === "simple_harmonic_motion") {
    const params = getTeachingParams(args);
    const displacement = buildTeachingPlotPayload({ ...args, title: "1. 位移、速度、加速度相位关系" });
    const energy = normalizePayload({
      exprs: ["cos(x)^2", "sin(x)^2", "1"],
      labels: ["势能 Ep", "动能 Ek", "总能量 E"],
      x_min: 0,
      x_max: parseNumber(params.t_max, 2 * Math.PI),
      points: 1200,
      title: "2. 简谐振动能量转换",
      xlabel: "相位 ωt",
      ylabel: "归一化能量",
      annotations: [{ kind: "label", x: Math.PI / 2, y: 1, text: "动能和势能互相转化，总能量守恒", color: "#7c3aed" }],
    }, "/plot_multi");
    const items = [
      { title: "1. 相位关系", kind: "plot", png_url: await buildShortUrl(env, "/png", displacement, origin), explanation: "速度比位移超前 π/2，加速度与位移反相。", payload: displacement },
      { title: "2. 能量转换", kind: "plot", png_url: await buildShortUrl(env, "/png", energy, origin), explanation: "动能和势能周期性交换，总机械能保持不变。", payload: energy },
    ];
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "Simple harmonic motion sequence", MAX_TITLE_LENGTH), warnings: [], count: items.length, items };
  }
  if (topic === "stress_strain") {
    const template = buildTeachingPlotPayload(args);
    const brittle = buildTeachingPlotPayload({ ...args, params: { ...getTeachingParams(args), yield_strain: 0.01, fracture_strain: 0.06, peak_stress: 8 }, title: "1. 脆性材料" });
    const ductile = buildTeachingPlotPayload({ ...args, params: { ...getTeachingParams(args), yield_strain: 0.03, fracture_strain: 0.35, peak_stress: 9 }, title: "2. 延性材料" });
    const items = [
      { title: "1. 标准阶段", kind: "plot", png_url: await buildShortUrl(env, "/png", template, origin), explanation: "曲线依次展示弹性区、屈服、强化与断裂。", payload: template },
      { title: "2. 脆性材料", kind: "plot", png_url: await buildShortUrl(env, "/png", brittle, origin), explanation: "脆性材料塑性变形小，断裂应变较低。", payload: brittle },
      { title: "3. 延性材料", kind: "plot", png_url: await buildShortUrl(env, "/png", ductile, origin), explanation: "延性材料断裂前有更长的塑性变形阶段。", payload: ductile },
    ];
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "Stress strain sequence", MAX_TITLE_LENGTH), warnings: [], count: items.length, items };
  }
  if (topic === "c_struct_layout") {
    const payloads = [buildCStructLayoutPayload(args, "layout"), buildCStructLayoutPayload(args, "padding"), buildCStructLayoutPayload(args, "sizeof")];
    const explanations = ["字段按声明顺序放置，但会受对齐约束影响。", "padding 是编译器插入的隐藏空洞。", "sizeof(struct) 包含字段、内部 padding 和尾部 padding。"];
    const items = await Promise.all(payloads.map(async (payload, index) => ({
      title: `${index + 1}. ${index === 0 ? "字段布局" : index === 1 ? "对齐填充" : "sizeof 总大小"}`,
      kind: "diagram",
      svg_url: await buildShortUrl(env, "/c-memory.svg", payload, origin),
      explanation: explanations[index],
      warnings: collectPayloadWarnings(payload),
      payload,
    })));
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "C struct layout sequence", MAX_TITLE_LENGTH), warnings: items.flatMap((item) => item.warnings), count: items.length, items };
  }
  if (topic === "energy_conservation") {
    const energy = buildTeachingPlotPayload(args);
    const params = getTeachingParams(args);
    const height = parseNumber(params.height, 10);
    const g = Math.max(0.1, parseNumber(params.g, 9.8));
    const velocity = normalizePayload({
      expr: `sqrt(2*${g}*x)`,
      x_min: 0,
      x_max: height,
      points: 1200,
      title: "由能量守恒推出速度",
      xlabel: "下落距离 s",
      ylabel: "速度 v",
      annotations: [{ kind: "label", x: height * 0.35, y: Math.sqrt(2 * g * height) * 0.7, text: "v=sqrt(2gs)", color: "#7c3aed" }],
    }, "/plot");
    const items = [
      { title: "1. 能量转换", kind: "plot", png_url: await buildShortUrl(env, "/png", energy, origin), explanation: "势能减少量等于动能增加量，总机械能不变。", payload: energy },
      { title: "2. 速度随下落距离变化", kind: "plot", png_url: await buildShortUrl(env, "/png", velocity, origin), explanation: "忽略阻力时，下落越远速度越大。", payload: velocity },
    ];
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "Energy conservation sequence", MAX_TITLE_LENGTH), warnings: [], count: items.length, items };
  }
  if (topic === "band_gap") {
    const semiconductor = buildTeachingPlotPayload({ ...args, params: { ...getTeachingParams(args), gap: parseNumber(getTeachingParams(args).gap, 1.1) }, title: "1. 半导体" });
    const conductor = buildTeachingPlotPayload({ ...args, params: { ...getTeachingParams(args), gap: 0 }, title: "2. 导体：无明显禁带" });
    const insulator = buildTeachingPlotPayload({ ...args, params: { ...getTeachingParams(args), gap: 5 }, title: "3. 绝缘体：宽禁带" });
    const payloads = [semiconductor, conductor, insulator];
    const explanations = ["半导体带隙适中，热激发或掺杂可产生载流子。", "导体价带与导带重叠或禁带近似为零。", "绝缘体带隙很宽，常温下难以激发载流子。"];
    const items = await Promise.all(payloads.map(async (payload, index) => ({ title: String(payload.title), kind: "plot", png_url: await buildShortUrl(env, "/png", payload, origin), explanation: explanations[index], payload })));
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "Band gap sequence", MAX_TITLE_LENGTH), warnings: [], count: items.length, items };
  }
  if (topic === "venn_probability") {
    const payloads = [
      buildVennProbabilityPayload(args, "formula"),
      buildVennProbabilityPayload(args, "intersection"),
      buildVennProbabilityPayload(args, "union"),
    ];
    const explanations = [
      "先把两个事件放进同一个样本空间，明确 A 与 B 会重叠。",
      "交集 A∩B 是会被 P(A)+P(B) 重复计算的一块。",
      "并集 A∪B 等于两边相加后减掉重复的交集。",
    ];
    const items = await Promise.all(payloads.map(async (payload, index) => ({
      title: `${index + 1}. ${index === 0 ? "样本空间与事件" : index === 1 ? "标出交集" : "得到并集公式"}`,
      kind: "diagram",
      svg_url: await buildShortUrl(env, "/venn.svg", payload, origin),
      explanation: explanations[index],
      warnings: collectPayloadWarnings(payload),
      payload,
    })));
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "Venn probability sequence", MAX_TITLE_LENGTH), warnings: items.flatMap((item) => item.warnings), count: items.length, items };
  }
  if (topic === "c_pointer_array") {
    const payloads = [
      buildCPointerArrayPayload(args, "array"),
      buildCPointerArrayPayload(args, "pointer"),
      buildCPointerArrayPayload(args, "dereference"),
    ];
    const explanations = [
      "数组元素在内存中连续排列，地址按元素大小递增。",
      "指针变量 p 存的是地址；arr 在表达式里常退化为首元素地址。",
      "*(arr+1) 先移动一个元素宽度，再读取目标地址中的值。",
    ];
    const items = await Promise.all(payloads.map(async (payload, index) => ({
      title: `${index + 1}. ${index === 0 ? "数组连续存储" : index === 1 ? "指针保存地址" : "解引用读取值"}`,
      kind: "diagram",
      svg_url: await buildShortUrl(env, "/c-memory.svg", payload, origin),
      explanation: explanations[index],
      warnings: collectPayloadWarnings(payload),
      payload,
    })));
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "C pointer array sequence", MAX_TITLE_LENGTH), warnings: items.flatMap((item) => item.warnings), count: items.length, items };
  }
  if (topic === "incline_force") {
    const params = getTeachingParams(args);
    const rawIncline = parseNumber(params.incline_deg, 30);
    const stage1 = sanitizeForceTemplatePayload({ ...params, template: "incline", title: "1. 情景与全部受力", show_components: false, show_resultant: false });
    const stage2 = sanitizeForceTemplatePayload({ ...params, template: "incline", title: "2. 分解重力到斜面方向", show_components: true, show_resultant: false });
    const stage3 = sanitizeForceTemplatePayload({ ...params, template: "incline", title: "3. 判断合力方向", show_components: true, show_resultant: true });
    const payloads = [stage1, stage2, stage3];
    const items = await Promise.all(payloads.map(async (payload, index) => ({
      title: limitText(payload.title, `Incline force step ${index + 1}`, MAX_TITLE_LENGTH),
      kind: "diagram",
      svg_url: await buildShortUrl(env, "/force-analysis.svg", payload, origin),
      explanation: index === 0 ? `斜面角取 ${payload.incline_deg}°${rawIncline !== payload.incline_deg ? "，已为稳定排版做钳制" : ""}` : index === 1 ? "把重力分解为沿斜面与垂直斜面的分量" : "比较沿斜面方向的力，确定合力与运动趋势",
      warnings: collectPayloadWarnings(payload),
      payload,
    })));
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "Incline force sequence", MAX_TITLE_LENGTH), warnings: items.flatMap((item) => item.warnings), count: items.length, items };
  }
  const circuitPayload = buildRcCircuitPayload("1. RC 充电电路");
  const voltagePayload = buildRcVoltagePayload(args);
  const currentPayload = buildRcCurrentPayload(args);
  const items = [
    { title: "1. RC 充电电路", kind: "diagram", svg_url: await buildShortUrl(env, "/circuit.svg", circuitPayload, origin), explanation: "电源通过电阻给电容充电，时间常数 τ=RC。", payload: circuitPayload },
    { title: "2. 电容电压上升", kind: "plot", png_url: await buildShortUrl(env, "/png", voltagePayload, origin), explanation: "Vc(t)=V0(1-e^{-t/τ})，t=τ 时约为 63.2% V0。", payload: voltagePayload },
    { title: "3. 电流指数衰减", kind: "plot", png_url: await buildShortUrl(env, "/png", currentPayload, origin), explanation: "i(t)=I0e^{-t/τ}，初始最大后逐渐趋近 0。", payload: currentPayload },
  ];
  return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "RC charging sequence", MAX_TITLE_LENGTH), warnings: [], count: items.length, items };
}

function buildSpecFromPayload(payload: Record<string, unknown>): PlotSpec {
  const path = String(payload.__path || "/plot");
  const cleaned = { ...payload };
  delete cleaned.__path;
  if (path === "/plot") return buildSinglePlot(cleaned);
  if (path === "/plot_multi") return buildMultiPlot(cleaned);
  if (path === "/plot_series") return buildSeriesPlot(cleaned);
  if (path === "/plot_bar") return buildBarChart(cleaned);
  if (path === "/multi_plot") {
    const result = buildSubplot(cleaned);
    const svg = renderMultiPlotSvg(result);
    return { ok: true, status: 200, data: { svg_url: `/multi_plot?spec=${encodeURIComponent(JSON.stringify(result))}` } };
  }
  throw new Error("invalid plot path");
}

async function _legacyToolHandler(name: string, args: Record<string, unknown>, env: Env, origin: string) {
  switch (name) {
    case "health":
      return { ok: true, status: 200, data: { ok: true } };
    case "plot":
    case "plot_json": {
      return { ok: true, status: 200, data: await pngLinkPayload(args, "/plot", origin, env) };
    }
    case "plot_png_link": {
      return { ok: true, status: 200, data: await pngLinkPayload(args, "/plot", origin, env) };
    }
    case "plot_multi":
    case "plot_multi_json": {
      return { ok: true, status: 200, data: await pngLinkPayload(args, "/plot_multi", origin, env) };
    }
    case "plot_multi_png_link": {
      return { ok: true, status: 200, data: await pngLinkPayload(args, "/plot_multi", origin, env) };
    }
    case "multi_plot": {
      const result = buildSubplot(args);
      const svg = renderMultiPlotSvg(result);
      const encoded = encodeURIComponent(JSON.stringify(result));
      return {
        ok: true, status: 200, data: {
          svg_url: `${origin}/multi_plot?spec=${encoded}`,
          png_url: `${origin}/multi_plot.png?spec=${encoded}`,
        },
      };
    }
    case "plot_series":
    case "plot_series_json": {
      return { ok: true, status: 200, data: await pngLinkPayload(args, "/plot_series", origin, env) };
    }
    case "plot_series_png_link": {
      return { ok: true, status: 200, data: await pngLinkPayload(args, "/plot_series", origin, env) };
    }
    case "force_diagram_link": {
      const payload = sanitizeForcePayload(args);
      return { ok: true, status: 200, data: await buildSvgLinkData(env, "/force.svg", payload, origin, "Force diagram") };
    }
    case "force_analysis_link": {
      const payload = sanitizeForceAnalysisPayload(args);
      return { ok: true, status: 200, data: await buildSvgLinkData(env, "/force-analysis.svg", payload, origin, "Force analysis") };
    }
    case "force_analysis_template_link": {
      const payload = sanitizeForceTemplatePayload(args);
      return { ok: true, status: 200, data: await buildSvgLinkData(env, "/force-analysis.svg", payload, origin, "Force analysis template") };
    }
    case "circuit_diagram_link": {
      const linkMode = classifyCircuitLinkPayload(args);
      const packedPayload = buildCompactCircuitLinkPayload(args, linkMode);
      const payload = sanitizeCircuitPayloadFromArgs(packedPayload);
      return { ok: true, status: 200, data: await buildSvgLinkData(env, "/circuit.svg", packedPayload, origin, "Circuit diagram") };
    }
    case "circuit_template_link": {
      const packedPayload = buildCompactCircuitLinkPayload(args, "template");
      const payload = sanitizeCircuitTemplatePayload(args);
      return { ok: true, status: 200, data: await buildSvgLinkData(env, "/circuit.svg", packedPayload, origin, "Circuit template") };
    }
    case "venn_diagram_link": {
      const payload = sanitizeVennPayload(args);
      return { ok: true, status: 200, data: await buildSvgLinkData(env, "/venn.svg", payload, origin, "Venn diagram") };
    }
    case "c_memory_diagram_link": {
      const payload = sanitizeCMemoryPayload(args);
      return { ok: true, status: 200, data: await buildSvgLinkData(env, "/c-memory.svg", payload, origin, "C memory layout") };
    }
    case "shape3d_link": {
      const payload = sanitizeShapePayload(args);
      return { ok: true, status: 200, data: await buildHtmlLinkData(env, "/shape3d.html", payload, origin, "3D shape") };
    }
    case "plot_bar_json": {
      return { ok: true, status: 200, data: await pngLinkPayload(args, "/plot_bar", origin, env) };
    }
    case "plot_multi_images": {
      const jobs = ensureArray<unknown>(args.jobs).slice(0, MAX_MULTI_IMAGE_JOBS);
      const results = await Promise.all(jobs.map(async (job) => {
        const record = (job && typeof job === "object") ? job as Record<string, unknown> : {};
        const kind = String(record.kind || "plot");
        const path = kind === "plot_multi"
          ? "/plot_multi"
          : kind === "plot_series"
            ? "/plot_series"
            : kind === "plot_bar"
              ? "/plot_bar"
              : "/plot";
        const data = await pngLinkPayload(record, path, origin, env);
        return { ...data, job_kind: kind };
      }));
      return { ok: true, status: 200, data: { count: results.length, results } };
    }
    case "teaching_template_link": {
      return { ok: true, status: 200, data: await buildTeachingTemplate(args, env, origin) };
    }
    case "teaching_sequence_link": {
      return { ok: true, status: 200, data: await buildTeachingSequence(args, env, origin) };
    }
    default:
      throw new Error(`unknown_tool:${name}`);
  }
}

/**
 * Public entry point: tries compat mapping first, then routes to legacy handler.
 */
async function handleToolCall(name: string, args: Record<string, unknown>, env: Env, origin: string) {
  // Handle analysis directly (no legacy equivalent)
  if (name === "analysis") {
    return { ok: true, status: 200, data: analyzeData(args) };
  }

  // Check if this is a canonical tool name that needs compat mapping
  const mapping = lookupCompat(name);

  // If it has a compat mapping (legacy name → canonical), resolve and delegate
  if (mapping) {
    const legacyName = resolveCanonicalToLegacy(name, args, mapping);
    return _legacyToolHandler(legacyName, args, env, origin);
  }

  // Try resolving as a canonical name (diagram, geometry_3d, teaching, template, etc.)
  const legacyName = resolveCanonicalToLegacy(name, args, null);
  if (legacyName !== name) {
    return _legacyToolHandler(legacyName, args, env, origin);
  }

  // Pure legacy name — pass through directly
  return _legacyToolHandler(name, args, env, origin);
}

function resolveCanonicalToLegacy(
  name: string,
  args: Record<string, unknown>,
  mapping: { tool?: string; render?: { format: string }; diagram_type?: string; template_type?: string; bar?: boolean } | null,
): string {
  // If mapping provides the routing, use it
  const render = (args.render as Record<string, string>)?.format || mapping?.render?.format;
  const canonical = mapping?.tool || name;

  switch (canonical) {
    case "plot": {
      if (Array.isArray(args.exprs)) {
        if (render === "link") return "plot_multi_png_link";
        if (render === "json") return "plot_multi_json";
        return "plot_multi";
      }
      if (render === "link") return "plot_png_link";
      if (render === "json") return "plot_json";
      return "plot_json";
    }
    case "plot_series": {
      // Only route to plot_bar_json if using legacy categories+values format (not multi-series bar)
      if ((args.categories && args.values) || mapping?.bar) return "plot_bar_json";
      if (render === "link") return "plot_series_png_link";
      if (render === "json") return "plot_series_json";
      return "plot_series";
    }
    case "diagram": {
      const dt = args.diagram_type || mapping?.diagram_type;
      switch (dt) {
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
    case "teaching": {
      if (args.sequence) return "teaching_sequence_link";
      return "teaching_template_link";
    }
    case "template": {
      const tt = args.template_type || mapping?.template_type;
      if (tt === "force_analysis") return "force_analysis_template_link";
      if (tt === "circuit") return "circuit_template_link";
      return "teaching_template_link";
    }
    case "analysis":
      return "analysis";
    case "health":
      return "health";
    default:
      return name;
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/healthz")) {
      return Response.json(healthResult(url.origin), { headers: corsHeaders() });
    }

    if (req.method === "GET" && url.pathname === "/plot") {
      try {
        const packed = url.searchParams.get("d") || "";
        if (!packed) return Response.json({ ok: false, error: "missing_d" }, { status: 400, headers: corsHeaders() });
        const payload = await parseCompressedBase64UrlJson<Record<string, unknown>>(packed);
        const spec = buildSpecFromPayload(payload);
        return new Response(renderSpecToSvg(spec), {
          status: 200,
          headers: {
            "content-type": "image/svg+xml; charset=utf-8",
            "cache-control": "public, max-age=300",
            "access-control-allow-origin": "*",
          },
        });
      } catch (error) {
        return Response.json({ ok: false, error: "bad_plot_query", message: String((error as Error)?.message || error) }, { status: 400, headers: corsHeaders() });
      }
    }

    if (req.method === "GET" && url.pathname === "/png") {
      try {
        const packed = url.searchParams.get("d") || "";
        if (!packed) return Response.json({ ok: false, error: "missing_d" }, { status: 400, headers: corsHeaders() });
        const payload = await parseCompressedBase64UrlJson<Record<string, unknown>>(packed);
        const spec = buildSpecFromPayload(payload);
        return await renderPngResponse(renderSpecToSvg(spec), env);
      } catch (error) {
        return Response.json({ ok: false, error: "bad_png_query", message: String((error as Error)?.message || error) }, { status: 400, headers: corsHeaders() });
      }
    }

    if (req.method === "GET" && url.pathname === "/multi_plot") {
      try {
        const specStr = url.searchParams.get("spec") || "";
        if (!specStr) return Response.json({ ok: false, error: "missing_spec" }, { status: 400, headers: corsHeaders() });
        const result = JSON.parse(decodeURIComponent(specStr)) as MultiPlotResult;
        const svg = renderMultiPlotSvg(result);
        return new Response(svg, { status: 200, headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
      } catch (error) {
        return Response.json({ ok: false, error: "bad_multi_plot_query", message: String((error as Error)?.message || error) }, { status: 400, headers: corsHeaders() });
      }
    }

    if (req.method === "GET" && url.pathname === "/multi_plot.png") {
      try {
        const specStr = url.searchParams.get("spec") || "";
        if (!specStr) return Response.json({ ok: false, error: "missing_spec" }, { status: 400, headers: corsHeaders() });
        const result = JSON.parse(decodeURIComponent(specStr)) as MultiPlotResult;
        const svg = renderMultiPlotSvg(result);
        return await renderPngResponse(svg, env);
      } catch (error) {
        return Response.json({ ok: false, error: "bad_multi_plot_png", message: String((error as Error)?.message || error) }, { status: 400, headers: corsHeaders() });
      }
    }

    if (req.method === "GET" && url.pathname.startsWith(SHORT_LINK_PATH_PREFIX)) {
      try {
        const token = url.pathname.slice(SHORT_LINK_PATH_PREFIX.length);
        if (!token) return Response.json({ ok: false, error: "missing_short_token" }, { status: 400, headers: corsHeaders() });
        const record = await resolveShortLink(env, token);
        if (!record) return Response.json({ ok: false, error: "short_link_not_found" }, { status: 404, headers: corsHeaders() });
        return await renderShortLink(record, env);
      } catch (error) {
        return Response.json({ ok: false, error: "bad_short_link", message: String((error as Error)?.message || error) }, { status: 400, headers: corsHeaders() });
      }
    }

    if (req.method === "GET" && url.pathname === "/force.svg") {
      try {
        const packed = url.searchParams.get("d") || "";
        if (!packed) return Response.json({ ok: false, error: "missing_d" }, { status: 400, headers: corsHeaders() });
        const payload = await parseCompressedBase64UrlJson<Record<string, unknown>>(packed);
        return new Response(renderForceDiagramSvg(payload), { status: 200, headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
      } catch (error) {
        return Response.json({ ok: false, error: "bad_force_query", message: String((error as Error)?.message || error) }, { status: 400, headers: corsHeaders() });
      }
    }

    if (req.method === "GET" && url.pathname === "/force-analysis.svg") {
      try {
        const packed = url.searchParams.get("d") || "";
        if (!packed) return Response.json({ ok: false, error: "missing_d" }, { status: 400, headers: corsHeaders() });
        const payload = await parseCompressedBase64UrlJson<Record<string, unknown>>(packed);
        return new Response(renderForceAnalysisSvg(payload), { status: 200, headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
      } catch (error) {
        return Response.json({ ok: false, error: "bad_force_analysis_query", message: String((error as Error)?.message || error) }, { status: 400, headers: corsHeaders() });
      }
    }

    if (req.method === "GET" && url.pathname === "/circuit.svg") {
      try {
        const packed = url.searchParams.get("d") || "";
        if (!packed) return Response.json({ ok: false, error: "missing_d" }, { status: 400, headers: corsHeaders() });
        const payload = await parseCompressedBase64UrlJson<Record<string, unknown>>(packed);
        return new Response(renderCircuitDiagramSvg(sanitizeCircuitPayloadFromArgs(payload)), { status: 200, headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
      } catch (error) {
        return Response.json({ ok: false, error: "bad_circuit_query", message: String((error as Error)?.message || error) }, { status: 400, headers: corsHeaders() });
      }
    }

    if (req.method === "GET" && url.pathname === "/venn.svg") {
      try {
        const packed = url.searchParams.get("d") || "";
        if (!packed) return Response.json({ ok: false, error: "missing_d" }, { status: 400, headers: corsHeaders() });
        const payload = await parseCompressedBase64UrlJson<Record<string, unknown>>(packed);
        return new Response(renderVennDiagramSvg(payload), { status: 200, headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
      } catch (error) {
        return Response.json({ ok: false, error: "bad_venn_query", message: String((error as Error)?.message || error) }, { status: 400, headers: corsHeaders() });
      }
    }

    if (req.method === "GET" && url.pathname === "/c-memory.svg") {
      try {
        const packed = url.searchParams.get("d") || "";
        if (!packed) return Response.json({ ok: false, error: "missing_d" }, { status: 400, headers: corsHeaders() });
        const payload = await parseCompressedBase64UrlJson<Record<string, unknown>>(packed);
        return new Response(renderCMemoryDiagramSvg(payload), { status: 200, headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
      } catch (error) {
        return Response.json({ ok: false, error: "bad_c_memory_query", message: String((error as Error)?.message || error) }, { status: 400, headers: corsHeaders() });
      }
    }

    if (req.method === "GET" && url.pathname === "/shape3d.html") {
      try {
        const packed = url.searchParams.get("d") || "";
        if (!packed) return Response.json({ ok: false, error: "missing_d" }, { status: 400, headers: corsHeaders() });
        const payload = await parseCompressedBase64UrlJson<Record<string, unknown>>(packed);
        return new Response(renderShape3DHtml(payload), { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
      } catch (error) {
        return Response.json({ ok: false, error: "bad_shape_query", message: String((error as Error)?.message || error) }, { status: 400, headers: corsHeaders() });
      }
    }

    if (req.method !== "POST" || url.pathname !== "/mcp") {
      return Response.json({ ok: false, error: "not_found" }, { status: 404, headers: corsHeaders() });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonRpcError(null, -32700, "Parse error");
    }

    const id = (body?.id as string | number | null | undefined) ?? null;
    const method = String(body?.method || "");
    const params = (body?.params && typeof body.params === "object") ? body.params as Record<string, unknown> : {};

    try {
      if (method === "initialize") {
        return jsonRpc(id, { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: SERVER_NAME, version: SERVER_VERSION } });
      }
      if (method === "notifications/initialized") {
        return new Response(null, { status: 202, headers: corsHeaders() });
      }
      if (method === "tools/list") {
        return jsonRpc(id, { tools: TOOLS });
      }
      if (method === "tools/call") {
        const name = String(params.name || "");
        const args = (params.arguments && typeof params.arguments === "object") ? params.arguments as Record<string, unknown> : {};
        const result = await handleToolCall(name, args, env, url.origin);
        return jsonRpc(id, toolResultPayload(result));
      }
      return jsonRpcError(id, -32601, `Method not found: ${method}`);
    } catch (error) {
      return jsonRpcError(id, -32000, "Tool execution failed", { message: String((error as Error)?.message || error) });
    }
  },
};

