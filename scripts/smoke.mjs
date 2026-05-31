/**
 * Minimal regression test suite for plot-mcp-worker.
 * Run: node scripts/smoke.mjs
 *
 * Must pass before any merge to main.
 */

const BASE = process.env.SMOKE_BASE || "http://127.0.0.1:8799";

async function callTool(name, args) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });
  const resp = await fetch(`${BASE}/mcp`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  return resp.json();
}

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}`); }
}

console.log("Running regression tests...\n");

// 1. corr linear → 1.0
{
  const d = await callTool("analysis", { action: "corr", series: [{ name: "A", data: [1,2,3,4,5] }, { name: "B", data: [2,4,6,8,10] }] });
  const matrix = d?.result?.structuredContent?.data?.matrix;
  assert(matrix && matrix[0][1] === 1, "corr linear → 1.0");
}

// 2. describe 1-10
{
  const d = await callTool("analysis", { action: "describe", data: [1,2,3,4,5,6,7,8,9,10] });
  const stats = d?.result?.structuredContent?.data?.stats;
  assert(stats && stats.mean === 5.5 && stats.median === 5.5, "describe 1-10: mean=5.5, median=5.5");
}

// 3. hist small data
{
  const d = await callTool("plot_series", { series: [{ type: "hist", name: "t", data: [1,2,2,3], bins: 2 }] });
  const data = d?.result?.structuredContent?.data;
  assert(data && data.ok === true && data.png_url, "hist: returns PNG link");
}

// 4. box with outlier
{
  const d = await callTool("plot_series", { series: [{ type: "box", name: "t", data: [1,2,2,3,100] }] });
  const data = d?.result?.structuredContent?.data;
  assert(data && data.ok === true && data.png_url, "box: returns PNG link");
}

// 5. pie simple
{
  const d = await callTool("plot_series", { series: [{ type: "pie", name: "t", labels: ["A","B","C"], values: [30,50,20] }] });
  const data = d?.result?.structuredContent?.data;
  assert(data && data.ok === true && data.png_url, "pie: returns PNG link");
}

// 6. legacy plot_png_link still works
{
  const d = await callTool("plot_png_link", { expr: "sin(x)" });
  const data = d?.result?.structuredContent?.data;
  assert(data && data.ok === true && data.png_url, "legacy plot_png_link: still works");
}

// 7. canonical diagram routing
{
  const d = await callTool("diagram", { diagram_type: "force", forces: [{ label: "F", angle_deg: 90 }] });
  const data = d?.result?.structuredContent?.data;
  assert(data && data.ok === true && data.svg_url, "canonical diagram: routes correctly");
}

// 8. canonical geometry_3d routing
{
  const d = await callTool("geometry_3d", { shape: "cube" });
  const data = d?.result?.structuredContent?.data;
  assert(data && data.ok === true && data.html_url, "canonical geometry_3d: routes correctly");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
