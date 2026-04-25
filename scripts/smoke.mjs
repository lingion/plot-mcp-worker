const endpoint = process.env.PLOT_MCP_ENDPOINT || "https://plot-mcp.qdp.qzz.io/mcp";
let id = 1;

async function rpc(method, params = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: id++, method, params }),
  });
  const json = await response.json();
  return json;
}

function parseToolResult(json) {
  const rpcError = json?.error;
  if (rpcError) {
    const detail = rpcError?.data?.message || rpcError?.message || JSON.stringify(rpcError);
    throw new Error(`tool error: ${detail}`);
  }
  const text = json?.result?.content?.[0]?.text;
  if (!text) throw new Error(`missing tool text: ${JSON.stringify(json)}`);
  const parsed = JSON.parse(text);
  return parsed.data || parsed;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "plot-smoke", version: "0.1.0" } });
const list = await rpc("tools/list");
const names = new Set(list?.result?.tools?.map((tool) => tool.name));
for (const name of ["plot_json", "force_analysis_template_link", "venn_diagram_link", "c_memory_diagram_link", "teaching_template_link", "teaching_sequence_link", "circuit_diagram_link"]) {
  assert(names.has(name), `tools/list missing ${name}`);
}

const validPlot = parseToolResult(await rpc("tools/call", { name: "plot_json", arguments: { expr: "sin(x)", annotations: [{ kind: "vertical_line", x: 0, label: "origin" }] } }));
assert(validPlot.png_url, "plot_json missing png_url");

const formulaPlot = parseToolResult(await rpc("tools/call", { name: "plot_json", arguments: {
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
} }));
assert(formulaPlot.png_url, "formula plot missing png_url");
const formulaPacked = formulaPlot.png_url.match(/[?&]d=([^&]+)/)?.[1];
assert(formulaPacked, "formula plot missing packed payload");
const formulaSvgText = await fetch(`https://plot-mcp.qdp.qzz.io/plot?d=${formulaPacked}`).then((response) => response.text());
assert(formulaSvgText.includes("x²"), "formula plot svg missing superscript rendering");
assert(formulaSvgText.includes("x₁"), "formula plot svg missing subscript rendering");
assert(formulaSvgText.includes("√(x²)") || formulaSvgText.includes("√(x)"), "formula plot svg missing sqrt rendering");
assert(formulaSvgText.includes("≥"), "formula plot svg missing inequality rendering");
assert(!formulaSvgText.includes("x^2"), "formula plot svg leaked raw caret exponent");
assert(!formulaSvgText.includes("x_1"), "formula plot svg leaked raw underscore subscript");

const piecewise = parseToolResult(await rpc("tools/call", { name: "plot_json", arguments: { title: "piecewise", x_min: -4, x_max: 4, points: 1000, pieces: [ { expr: "x+2", x_min: -4, x_max: -1, label: "x+2" }, { expr: "x^2", x_min: -1, x_max: 1, label: "x^2" }, { expr: "sqrt(x+1)", x_min: 1, x_max: 4, label: "sqrt(x+1)" } ] } }));
assert(piecewise.png_url && piecewise.payload?.pieces?.length === 3, "piecewise plot incomplete");

const invalidPlot = await rpc("tools/call", { name: "plot_json", arguments: { expr: "sin(" } });
assert(invalidPlot.error?.data?.message?.includes("invalid expression syntax"), "invalid expression did not fail clearly");

const incline = parseToolResult(await rpc("tools/call", { name: "force_analysis_template_link", arguments: { template: "incline", incline_deg: 89 } }));
assert(incline.payload.incline_deg === 85, "incline clamp failed");
assert(incline.warnings?.length > 0, "incline warning missing");

const denseForce = parseToolResult(await rpc("tools/call", { name: "force_analysis_link", arguments: { title: "dense", incline_deg: 60, forces: [
  { label: "重力", angle_deg: -90, magnitude: 4 },
  { label: "支持力", angle_deg: 30, magnitude: 3.4 },
  { label: "摩擦力", angle_deg: 120, magnitude: 1.2 },
  { label: "拉力", angle_deg: 120, magnitude: 1.5 },
  { label: "推力", angle_deg: 150, magnitude: 1.1 }
] } }));
assert(denseForce.svg_url, "dense force analysis svg_url missing");
assert(denseForce.payload.show_components === false, "dense force analysis should auto-disable components");
assert(denseForce.payload.show_axes === false, "dense incline analysis should auto-disable axes");
assert(denseForce.payload.show_resultant === false, "dense force analysis should auto-disable resultant");
assert(denseForce.warnings?.some((item) => String(item).includes("auto-simplified")), "dense force analysis warning missing");

const denseSvgText = await fetch(denseForce.svg_url).then((response) => response.text());
assert(denseSvgText.includes('已自动简化'), "dense force analysis svg missing simplification note");
assert(denseSvgText.includes('x1="320" y1="250"'), "dense force analysis svg missing centroid-anchored force origins");
assert(denseSvgText.includes('opacity="0.28"'), "dense force analysis svg missing separated vector stems");
assert(denseSvgText.includes('text-anchor="middle"') || denseSvgText.includes('text-anchor="start"') || denseSvgText.includes('text-anchor="end"'), "dense force analysis svg missing labels");
assert(denseSvgText.includes('重力') || denseSvgText.includes('支持力') || denseSvgText.includes('摩擦力'), "dense force analysis svg missing expected label text");
assert(denseSvgText.includes('ringCount') === false, "dense force analysis svg leaked implementation text");
assert(denseSvgText.includes('adjustForceLabelPositions') === false, "dense force analysis svg leaked collision helper text");
assert(denseSvgText.includes('side:') === false, "dense force analysis svg leaked side metadata");

const longLabelForce = parseToolResult(await rpc("tools/call", { name: "force_analysis_link", arguments: { title: "dense-long-label", incline_deg: 55, forces: [
  { label: "沿斜面向上的超长教学标签示例", angle_deg: 125, magnitude: 2.5 },
  { label: "法向支持力说明文字特别长", angle_deg: 35, magnitude: 3.1 },
  { label: "重力沿竖直向下保持不变", angle_deg: -90, magnitude: 4.2 },
  { label: "摩擦力方向与相对运动趋势相反", angle_deg: 125, magnitude: 1.4 },
  { label: "额外外力标签也很长", angle_deg: 150, magnitude: 1.2 }
] } }));
const longLabelSvgText = await fetch(longLabelForce.svg_url).then((response) => response.text());
assert(longLabelSvgText.includes('…'), "dense long-label force analysis svg missing compacted ellipsis");
assert(longLabelSvgText.match(/…/g)?.length >= 2, "dense long-label force analysis svg missing repeated compacted ellipsis labels");
assert(longLabelSvgText.match(/width="([0-9.]+)"/g)?.length >= 6, "dense long-label force analysis svg missing measurable chip widths");
assert(longLabelSvgText.includes('stroke-dasharray="3 3"'), "dense long-label force analysis svg missing leader lines");
assert(longLabelSvgText.includes('<rect '), "dense long-label force analysis svg missing label chip rect");
assert(longLabelSvgText.includes('rx="8"'), "dense long-label force analysis svg missing rounded label chip");
assert(longLabelSvgText.includes('fill="rgba(251,253,255,0.9)"'), "dense long-label force analysis svg missing label chip fill");
assert(longLabelSvgText.includes('fill="rgba(148,163,184,0.16)"'), "dense long-label force analysis svg missing chip shadow layer");
assert(longLabelSvgText.includes('fill="rgba(255,255,255,0.72)"'), "dense long-label force analysis svg missing chip sheen layer");
assert(longLabelSvgText.includes('opacity="0.85"'), "dense long-label force analysis svg missing chip sheen opacity");
assert(longLabelSvgText.match(/rx="4(\.[0-4][0-9]+)?" fill="rgba\(255,255,255,0\.72\)" opacity="0\.85"/g)?.length >= 1, "dense long-label force analysis svg missing tightened sheen radius for wider chips");
assert(longLabelSvgText.match(/rx="4\.[5-9][0-9]+" fill="rgba\(255,255,255,0\.72\)" opacity="0\.85"/g)?.length >= 1, "dense long-label force analysis svg missing preserved wider sheen radius for narrower chips");
assert(longLabelSvgText.match(/fill="rgba\(255,255,255,0\.72\)" opacity="0\.85"/g)?.length >= 2, "dense long-label force analysis svg missing repeated chip sheen layers");
assert(longLabelSvgText.match(/<rect /g)?.length >= 6, "dense long-label force analysis svg missing layered label chip rects");
assert(longLabelSvgText.match(/text-anchor="middle"/g)?.length >= 1, "dense long-label force analysis svg missing centered label text");
assert(longLabelSvgText.match(/text-anchor="middle"/g)?.length <= 4, "dense long-label force analysis svg has unexpectedly crowded centered labels");
assert(longLabelSvgText.match(/stroke-dasharray="3 3"/g)?.length >= 2, "dense long-label force analysis svg missing multiple separated leader lines");
assert(longLabelSvgText.match(/<polyline /g)?.length >= 2, "dense long-label force analysis svg missing multiple staggered leader connectors");
assert(longLabelSvgText.match(/text-anchor="start"|text-anchor="end"/g)?.length >= 2, "dense long-label force analysis svg missing side-column labels");
assert(longLabelSvgText.includes('stroke-linejoin="round"'), "dense long-label force analysis svg missing rounded leader connector joins");
assert(longLabelSvgText.includes('stroke-linecap="round"'), "dense long-label force analysis svg missing rounded leader connector caps");
assert(longLabelSvgText.match(/points="[^"]+ [^"]+ [^"]+"/g)?.length >= 2, "dense long-label force analysis svg missing explicit multi-segment connector bend points");
assert(longLabelSvgText.includes('fill="none"'), "dense long-label force analysis svg missing connector no-fill rendering");
assert(longLabelSvgText.includes('opacity="0.4"'), "dense long-label force analysis svg missing softened connector opacity");
assert(longLabelSvgText.includes('points="'), "dense long-label force analysis svg missing explicit connector bend points");
assert(longLabelSvgText.includes('x2="') && longLabelSvgText.includes('y2="'), "dense long-label force analysis svg missing explicit leader attachment coordinates");
assert(longLabelSvgText.includes('opacity="0.9"'), "dense long-label force analysis svg missing side-aware chip shadow opacity");

const boundaryForce = parseToolResult(await rpc("tools/call", { name: "force_analysis_link", arguments: { title: "boundary-columns", incline_deg: 58, forces: [
  { label: "左列第一条极长教学标签用于压缩左列边界与连接线", angle_deg: 156, magnitude: 1.9 },
  { label: "左列第二条极长教学标签继续挤压左列边界与连接线弯折", angle_deg: 148, magnitude: 1.6 },
  { label: "顶部中心第一条极长说明用于测试节奏分流与堆叠间距", angle_deg: 96, magnitude: 3.9 },
  { label: "顶部中心第二条极长说明继续测试节奏分流与堆叠间距", angle_deg: 84, magnitude: 3.4 },
  { label: "右列第一条极长教学标签用于压缩右列边界与连接线", angle_deg: 22, magnitude: 2.8 },
  { label: "右列第二条极长教学标签继续挤压右列边界与连接线弯折", angle_deg: 14, magnitude: 2.5 },
  { label: "左斜向额外说明继续增加碰撞密度与列压缩", angle_deg: 132, magnitude: 1.5 },
  { label: "右斜向额外说明继续增加碰撞密度与列压缩", angle_deg: 42, magnitude: 1.7 }
] } }));
assert(boundaryForce.payload.show_components === false, "boundary dense force analysis should auto-disable components");
assert(boundaryForce.payload.show_axes === false, "boundary dense force analysis should auto-disable axes");
assert(boundaryForce.payload.show_resultant === false, "boundary dense force analysis should auto-disable resultant");
assert(boundaryForce.warnings?.some((item) => String(item).includes("auto-simplified")), "boundary dense force analysis warning missing");
const boundarySvgText = await fetch(boundaryForce.svg_url).then((response) => response.text());
assert(boundarySvgText.match(/text-anchor="end"/g)?.length >= 2, "boundary dense force analysis svg missing multiple left-column labels");
assert(boundarySvgText.match(/text-anchor="start"/g)?.length >= 2, "boundary dense force analysis svg missing multiple right-column labels");
assert(boundarySvgText.match(/text-anchor="middle"/g)?.length >= 2, "boundary dense force analysis svg missing multiple center labels");
assert(boundarySvgText.match(/<polyline /g)?.length >= 4, "boundary dense force analysis svg missing multiple connector lanes");
assert(boundarySvgText.match(/stroke-dasharray="3 3"/g)?.length >= 4, "boundary dense force analysis svg missing repeated dashed connectors");
assert(boundarySvgText.match(/points="[^"]+ [^"]+ [^"]+"/g)?.length >= 4, "boundary dense force analysis svg missing repeated bent connectors");
assert(boundarySvgText.includes('左列第二条极长教学标签'), "boundary dense force analysis svg missing left-column clipped label");
assert(boundarySvgText.includes('右列第二条极长教学标签'), "boundary dense force analysis svg missing right-column clipped label");
assert(boundarySvgText.includes('顶部中心第二条极长说…'), "boundary dense force analysis svg missing centered stacked label");
assert(boundarySvgText.match(/opacity="0\.9"/g)?.length >= 4, "boundary dense force analysis svg missing repeated chip shadows");

const circuitMixedOrientation = parseToolResult(await rpc("tools/call", { name: "circuit_diagram_link", arguments: {
  title: "mixed orientation",
  components: [
    { id: "r1", type: "resistor", x: 220, y: 180, orientation: "vertical", label: "R1" },
    { id: "c1", type: "capacitor", x: 340, y: 180, orientation: "horizontal", label: "C1" },
    { id: "l1", type: "lamp", x: 460, y: 260, orientation: "vertical", label: "L1" }
  ],
  wires: [
    { x1: 220, y1: 180, x2: 340, y2: 180, label: "top bus" },
    { x1: 340, y1: 180, x2: 340, y2: 260 },
    { x1: 340, y1: 260, x2: 460, y2: 260 }
  ]
} }));
assert(circuitMixedOrientation.svg_url, "mixed orientation circuit missing svg_url");
const circuitMixedSvg = await fetch(circuitMixedOrientation.svg_url).then((response) => response.text());
assert(circuitMixedSvg.includes('x1="234" y1="180" x2="310" y2="180"'), "mixed orientation circuit did not snap horizontal wire to vertical resistor side lead");
assert(circuitMixedSvg.includes('x1="340" y1="202" x2="340" y2="260"'), "mixed orientation circuit did not snap vertical wire to horizontal capacitor lower lead");
assert(circuitMixedSvg.includes('x1="340" y1="260" x2="442" y2="260"'), "mixed orientation circuit did not snap horizontal wire to vertical lamp side envelope");
assert(circuitMixedSvg.includes('x1="220" y1="144" x2="220" y2="158"'), "mixed orientation circuit missing vertical resistor top stub");
assert(circuitMixedSvg.includes('x1="460" y1="224" x2="460" y2="242"'), "mixed orientation circuit missing vertical lamp top stub");

const venn = parseToolResult(await rpc("tools/call", { name: "venn_diagram_link", arguments: { sets: [{ label: "A" }, { label: "B" }], regions: { A_B: "A∩B" } } }));
assert(venn.svg_url, "venn svg_url missing");

const cmem = parseToolResult(await rpc("tools/call", { name: "c_memory_diagram_link", arguments: { blocks: [{ name: "p", type: "int*", value: "&x" }, { name: "x", type: "int", value: "42" }] } }));
assert(cmem.svg_url, "c memory svg_url missing");

const parabola = parseToolResult(await rpc("tools/call", { name: "teaching_template_link", arguments: { topic: "parabola", params: { a: 1, h: 0, k: 0 } } }));
assert(parabola.png_url && parabola.payload.annotations?.length >= 3, "parabola teaching template missing annotations");

const tangent = parseToolResult(await rpc("tools/call", { name: "teaching_template_link", arguments: { topic: "tangent_derivative", params: { x0: 1 } } }));
assert(tangent.png_url && tangent.payload.labels?.[1]?.includes("切线斜率"), "tangent derivative template incomplete");

const fourier = parseToolResult(await rpc("tools/call", { name: "teaching_template_link", arguments: { topic: "fourier_series", params: { terms: 5 } } }));
assert(fourier.png_url && fourier.payload.title?.includes("傅里叶"), "fourier series template incomplete");

const rlcTemplate = parseToolResult(await rpc("tools/call", { name: "teaching_template_link", arguments: { topic: "rlc_transient", params: { alpha: 0.25, omega: 4 } } }));
assert(rlcTemplate.png_url && rlcTemplate.payload.title?.includes("RLC"), "RLC transient template incomplete");

const projectile = parseToolResult(await rpc("tools/call", { name: "teaching_template_link", arguments: { topic: "projectile_motion", params: { v0: 20, angle_deg: 45 } } }));
assert(projectile.png_url && JSON.stringify(projectile.payload).includes("最高点"), "projectile motion template incomplete");

const shm = parseToolResult(await rpc("tools/call", { name: "teaching_template_link", arguments: { topic: "simple_harmonic_motion", params: { amplitude: 1, omega: 2 } } }));
assert(shm.png_url && shm.payload.labels?.length === 3, "simple harmonic motion template incomplete");

const stress = parseToolResult(await rpc("tools/call", { name: "teaching_template_link", arguments: { topic: "stress_strain", params: {} } }));
assert(stress.png_url && JSON.stringify(stress.payload).includes("屈服点"), "stress strain template incomplete");

const structLayout = parseToolResult(await rpc("tools/call", { name: "teaching_template_link", arguments: { topic: "c_struct_layout", params: {} } }));
assert(structLayout.svg_url && JSON.stringify(structLayout.payload).includes("padding"), "C struct layout template incomplete");

const energy = parseToolResult(await rpc("tools/call", { name: "teaching_template_link", arguments: { topic: "energy_conservation", params: {} } }));
assert(energy.png_url && JSON.stringify(energy.payload).includes("机械能"), "energy conservation template incomplete");

const bandGap = parseToolResult(await rpc("tools/call", { name: "teaching_template_link", arguments: { topic: "band_gap", params: { gap: 1.1 } } }));
assert(bandGap.png_url && JSON.stringify(bandGap.payload).includes("禁带"), "band gap template incomplete");

const vennTeaching = parseToolResult(await rpc("tools/call", { name: "teaching_template_link", arguments: { topic: "venn_probability", params: { p_a: 0.6, p_b: 0.5, p_ab: 0.2 } } }));
assert(vennTeaching.svg_url && vennTeaching.payload.regions?.A_B, "venn probability teaching template incomplete");

const cTeaching = parseToolResult(await rpc("tools/call", { name: "teaching_template_link", arguments: { topic: "c_pointer_array", params: { values: [10, 20, 30] } } }));
assert(cTeaching.svg_url && cTeaching.payload.blocks?.length >= 3, "C pointer array teaching template incomplete");

const rc = parseToolResult(await rpc("tools/call", { name: "teaching_sequence_link", arguments: { topic: "rc_charging", params: { v0: 5, tau: 1 } } }));
assert(rc.count === 3 && rc.items?.[0]?.svg_url && rc.items?.[1]?.png_url && rc.items?.[2]?.png_url, "rc teaching sequence incomplete");

const parabolaSequence = parseToolResult(await rpc("tools/call", { name: "teaching_sequence_link", arguments: { topic: "parabola", params: { a: 1, h: 0, k: 0 } } }));
assert(parabolaSequence.count === 2 && parabolaSequence.items?.every((item) => item.png_url), "parabola teaching sequence incomplete");

const definiteIntegralSequence = parseToolResult(await rpc("tools/call", { name: "teaching_sequence_link", arguments: { topic: "definite_integral", params: { expr: "x^2", x_min: 0, x_max: 3 } } }));
assert(definiteIntegralSequence.count === 2 && definiteIntegralSequence.items?.every((item) => item.png_url), "definite integral teaching sequence incomplete");
assert(definiteIntegralSequence.title?.includes("Definite integral"), "definite integral teaching sequence title incorrect");
assert(definiteIntegralSequence.items?.every((item) => !String(item.title || "").includes("RC")), "definite integral teaching sequence leaked RC routing");

const derivativeSequence = parseToolResult(await rpc("tools/call", { name: "teaching_sequence_link", arguments: { topic: "tangent_derivative", params: { x0: 1 } } }));
assert(derivativeSequence.count === 2 && derivativeSequence.items?.every((item) => item.png_url), "derivative teaching sequence incomplete");

const fourierSequence = parseToolResult(await rpc("tools/call", { name: "teaching_sequence_link", arguments: { topic: "fourier_series", params: { terms: 7 } } }));
assert(fourierSequence.count === 3 && fourierSequence.items?.every((item) => item.png_url), "fourier teaching sequence incomplete");

const rlcSequence = parseToolResult(await rpc("tools/call", { name: "teaching_sequence_link", arguments: { topic: "rlc_transient", params: { omega: 4 } } }));
assert(rlcSequence.count === 3 && rlcSequence.items?.every((item) => item.png_url), "RLC teaching sequence incomplete");

const projectileSequence = parseToolResult(await rpc("tools/call", { name: "teaching_sequence_link", arguments: { topic: "projectile_motion", params: { v0: 20 } } }));
assert(projectileSequence.count === 3 && projectileSequence.items?.every((item) => item.png_url), "projectile teaching sequence incomplete");

const shmSequence = parseToolResult(await rpc("tools/call", { name: "teaching_sequence_link", arguments: { topic: "simple_harmonic_motion", params: {} } }));
assert(shmSequence.count === 2 && shmSequence.items?.every((item) => item.png_url), "SHM teaching sequence incomplete");

const stressSequence = parseToolResult(await rpc("tools/call", { name: "teaching_sequence_link", arguments: { topic: "stress_strain", params: {} } }));
assert(stressSequence.count === 3 && stressSequence.items?.every((item) => item.png_url), "stress strain sequence incomplete");

const structSequence = parseToolResult(await rpc("tools/call", { name: "teaching_sequence_link", arguments: { topic: "c_struct_layout", params: {} } }));
assert(structSequence.count === 3 && structSequence.items?.every((item) => item.svg_url), "C struct layout sequence incomplete");

const energySequence = parseToolResult(await rpc("tools/call", { name: "teaching_sequence_link", arguments: { topic: "energy_conservation", params: {} } }));
assert(energySequence.count === 2 && energySequence.items?.every((item) => item.png_url), "energy conservation sequence incomplete");

const bandGapSequence = parseToolResult(await rpc("tools/call", { name: "teaching_sequence_link", arguments: { topic: "band_gap", params: {} } }));
assert(bandGapSequence.count === 3 && bandGapSequence.items?.every((item) => item.png_url), "band gap sequence incomplete");

const vennSequence = parseToolResult(await rpc("tools/call", { name: "teaching_sequence_link", arguments: { topic: "venn_probability", params: { p_a: 0.6, p_b: 0.5, p_ab: 0.2 } } }));
assert(vennSequence.count === 3 && vennSequence.items?.every((item) => item.svg_url), "venn probability sequence incomplete");

const cSequence = parseToolResult(await rpc("tools/call", { name: "teaching_sequence_link", arguments: { topic: "c_pointer_array", params: { values: [10, 20, 30] } } }));
assert(cSequence.count === 3 && cSequence.items?.every((item) => item.svg_url), "C pointer array sequence incomplete");

console.log(`Smoke tests passed against ${endpoint}`);
