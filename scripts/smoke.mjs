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
for (const name of ["plot_json", "force_analysis_template_link", "venn_diagram_link", "c_memory_diagram_link", "teaching_template_link", "teaching_sequence_link"]) {
  assert(names.has(name), `tools/list missing ${name}`);
}

const validPlot = parseToolResult(await rpc("tools/call", { name: "plot_json", arguments: { expr: "sin(x)", annotations: [{ kind: "vertical_line", x: 0, label: "origin" }] } }));
assert(validPlot.png_url, "plot_json missing png_url");

const invalidPlot = await rpc("tools/call", { name: "plot_json", arguments: { expr: "sin(" } });
assert(invalidPlot.error?.data?.message?.includes("invalid expression syntax"), "invalid expression did not fail clearly");

const incline = parseToolResult(await rpc("tools/call", { name: "force_analysis_template_link", arguments: { template: "incline", incline_deg: 89 } }));
assert(incline.payload.incline_deg === 85, "incline clamp failed");
assert(incline.warnings?.length > 0, "incline warning missing");

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

const vennTeaching = parseToolResult(await rpc("tools/call", { name: "teaching_template_link", arguments: { topic: "venn_probability", params: { p_a: 0.6, p_b: 0.5, p_ab: 0.2 } } }));
assert(vennTeaching.svg_url && vennTeaching.payload.regions?.A_B, "venn probability teaching template incomplete");

const cTeaching = parseToolResult(await rpc("tools/call", { name: "teaching_template_link", arguments: { topic: "c_pointer_array", params: { values: [10, 20, 30] } } }));
assert(cTeaching.svg_url && cTeaching.payload.blocks?.length >= 3, "C pointer array teaching template incomplete");

const rc = parseToolResult(await rpc("tools/call", { name: "teaching_sequence_link", arguments: { topic: "rc_charging", params: { v0: 5, tau: 1 } } }));
assert(rc.count === 3 && rc.items?.[0]?.svg_url && rc.items?.[1]?.png_url && rc.items?.[2]?.png_url, "rc teaching sequence incomplete");

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

const vennSequence = parseToolResult(await rpc("tools/call", { name: "teaching_sequence_link", arguments: { topic: "venn_probability", params: { p_a: 0.6, p_b: 0.5, p_ab: 0.2 } } }));
assert(vennSequence.count === 3 && vennSequence.items?.every((item) => item.svg_url), "venn probability sequence incomplete");

const cSequence = parseToolResult(await rpc("tools/call", { name: "teaching_sequence_link", arguments: { topic: "c_pointer_array", params: { values: [10, 20, 30] } } }));
assert(cSequence.count === 3 && cSequence.items?.every((item) => item.svg_url), "C pointer array sequence incomplete");

console.log(`Smoke tests passed against ${endpoint}`);
