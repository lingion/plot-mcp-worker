const endpoint = process.env.PLOT_MCP_ENDPOINT || "https://plot-mcp.qdp.qzz.io/mcp";
let id = 1;

async function rpc(method, params = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: id++, method, params }),
  });
  const json = await response.json();
  return { status: response.status, json };
}

function parseToolResult(json) {
  if (json?.error) {
    return { ok: false, error: json.error };
  }
  const text = json?.result?.content?.[0]?.text;
  if (!text) {
    return { ok: false, error: { message: `missing tool text: ${JSON.stringify(json)}` } };
  }
  try {
    const parsed = JSON.parse(text);
    return { ok: true, data: parsed.data || parsed };
  } catch (error) {
    return { ok: false, error: { message: String(error?.message || error) } };
  }
}

const init = await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "plot-health", version: "0.1.0" } });
const tools = await rpc("tools/list");
const piecewise = await rpc("tools/call", { name: "plot_json", arguments: {
  title: "piecewise-health",
  x_min: -4,
  x_max: 4,
  points: 200,
  pieces: [
    { expr: "x+2", x_min: -4, x_max: -1, label: "x+2" },
    { expr: "x^2", x_min: -1, x_max: 1, label: "x^2" },
    { expr: "sqrt(x+1)", x_min: 1, x_max: 4, label: "sqrt(x+1)" }
  ]
} });
const force = await rpc("tools/call", { name: "force_analysis_link", arguments: {
  title: "health-force",
  incline_deg: 55,
  forces: [
    { label: "沿斜面向上的超长教学标签示例", angle_deg: 125, magnitude: 2.5 },
    { label: "法向支持力说明文字特别长", angle_deg: 35, magnitude: 3.1 },
    { label: "重力沿竖直向下保持不变", angle_deg: -90, magnitude: 4.2 },
    { label: "摩擦力方向与相对运动趋势相反", angle_deg: 125, magnitude: 1.4 },
    { label: "额外外力标签也很长", angle_deg: 150, magnitude: 1.2 }
  ]
} });

const formulaPlot = await rpc("tools/call", { name: "plot_json", arguments: {
  title: "y=x^2, V_{out}, sqrt(x)",
  expr: "x^2",
  x_min: -3,
  x_max: 3,
  xlabel: "x_1",
  ylabel: "V_{out} >= 0",
  annotations: [
    { kind: "vertical_line", x: 1, label: "x_1" },
    { kind: "point", x: 2, y: 4, label: "y=x^2" },
    { kind: "label", x: 0, y: 0, text: "sqrt(x^2)" }
  ]
} });

const initInfo = init.json?.result?.serverInfo || null;
const toolNames = tools.json?.result?.tools?.map((tool) => tool.name) || [];
const piecewiseResult = parseToolResult(piecewise.json);
const formulaPlotResult = parseToolResult(formulaPlot.json);
const forceResult = parseToolResult(force.json);

let formulaSvgSummary = null;
if (formulaPlotResult.ok && formulaPlotResult.data?.png_url) {
  const packed = formulaPlotResult.data?.png_url?.match(/[?&]d=([^&]+)/)?.[1];
  if (packed) {
    const svgUrl = `https://plot-mcp.qdp.qzz.io/plot?d=${packed}`;
    const response = await fetch(svgUrl);
    const svg = await response.text();
    formulaSvgSummary = {
      status: response.status,
      contentType: response.headers.get("content-type"),
      hasSuperscript: svg.includes("x²"),
      hasSubscript: svg.includes("x₁") || svg.includes("Vₒᵤₜ"),
      hasSqrt: svg.includes("√(x)") || svg.includes("√(x²)"),
      hasGeq: svg.includes("≥"),
      rawCaretStillVisible: svg.includes("x^2") || svg.includes("x_1") || svg.includes("V_{out}"),
      svgShell: svg.includes("<svg") && svg.includes("Function Plot"),
      notFound: svg.includes('"error":"not_found"'),
    };
  }
}

let forceSvgSummary = null;
if (forceResult.ok && forceResult.data?.svg_url) {
  const svg = await fetch(forceResult.data.svg_url).then((response) => response.text());
  forceSvgSummary = {
    ellipsis: (svg.match(/…/g) || []).length,
    chipFill: (svg.match(/fill="rgba\(251,253,255,0\.9\)"/g) || []).length,
    sheen: (svg.match(/fill="rgba\(255,255,255,0\.72\)" opacity="0\.85"/g) || []).length,
    polylines: (svg.match(/<polyline /g) || []).length,
  };
}

console.log(JSON.stringify({
  endpoint,
  initialize: {
    status: init.status,
    serverInfo: initInfo,
  },
  tools: {
    status: tools.status,
    count: toolNames.length,
    hasPlotJson: toolNames.includes("plot_json"),
    hasForceAnalysis: toolNames.includes("force_analysis_link"),
  },
  piecewise: piecewiseResult.ok
    ? {
        ok: true,
        png_url: Boolean(piecewiseResult.data?.png_url),
        pieceCount: piecewiseResult.data?.payload?.pieces?.length || 0,
      }
    : {
        ok: false,
        error: piecewiseResult.error,
      },
  formulaPlot: formulaPlotResult.ok
    ? {
        ok: true,
        png_url: Boolean(formulaPlotResult.data?.png_url),
        svg: formulaSvgSummary,
      }
    : {
        ok: false,
        error: formulaPlotResult.error,
      },
  forceAnalysis: forceResult.ok
    ? {
        ok: true,
        svg_url: Boolean(forceResult.data?.svg_url),
        payload: {
          show_components: forceResult.data?.payload?.show_components,
          show_axes: forceResult.data?.payload?.show_axes,
          show_resultant: forceResult.data?.payload?.show_resultant,
        },
        svg: forceSvgSummary,
      }
    : {
        ok: false,
        error: forceResult.error,
      },
}, null, 2));
