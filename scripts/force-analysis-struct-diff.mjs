import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = "/Users/lingion/plot-mcp-cloudflare";
const sourceDir = path.join(projectRoot, "src");
const endpoint = process.env.PLOT_MCP_ENDPOINT || "https://plot-mcp.qdp.qzz.io/mcp";
const files = ["constants.ts", "utils.ts", "extras.ts"];

function patchLocalImports(source) {
  return source.replace(/from "(\.\/.+?)"/g, (_match, specifier) => `from "${specifier}.ts"`);
}

async function prepareTempModuleDir() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "plot-force-struct-"));
  await Promise.all(files.map(async (file) => {
    const source = await readFile(path.join(sourceDir, file), "utf8");
    await writeFile(path.join(tempDir, file), patchLocalImports(source));
  }));
  return tempDir;
}

function buildDenseLongLabelPayload() {
  const forces = [
    { label: "沿斜面向上的超长教学标签示例", angle_deg: 125, magnitude: 2.5, color: "#2563eb" },
    { label: "法向支持力说明文字特别长", angle_deg: 35, magnitude: 3.1, color: "#2563eb" },
    { label: "重力沿竖直向下保持不变", angle_deg: -90, magnitude: 4.2, color: "#2563eb" },
    { label: "摩擦力方向与相对运动趋势相反", angle_deg: 125, magnitude: 1.4, color: "#2563eb" },
    { label: "额外外力标签也很长", angle_deg: 150, magnitude: 1.2, color: "#2563eb" },
  ];
  return {
    title: "dense-long-label-struct-diff",
    body_label: "m",
    forces,
    show_components: true,
    show_axes: true,
    show_resultant: true,
    show_angle_labels: false,
    incline_deg: 55,
    bodies: [{
      id: "body1",
      label: "m",
      kind: "block",
      x: 0,
      y: 0,
      width: 72,
      height: 48,
      radius: 24,
      angle_deg: 55,
      forces,
    }],
    surfaces: [],
    connectors: [],
  };
}

async function rpc(method, params = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return response.json();
}

function parseToolResult(json) {
  const text = json?.result?.content?.[0]?.text;
  if (!text) throw new Error(`missing tool text: ${JSON.stringify(json)}`);
  const parsed = JSON.parse(text);
  return parsed.data || parsed;
}

function extractMatches(svg, pattern) {
  return Array.from(svg.matchAll(pattern), (match) => match[0]);
}

function analyzeSvg(svg) {
  return {
    chipRects: extractMatches(svg, /<rect [^>]*fill="rgba\(251,253,255,0\.9\)"[^>]*>/g),
    chipShadows: extractMatches(svg, /<rect [^>]*fill="rgba\(148,163,184,0\.16\)"[^>]*>/g),
    sheens: extractMatches(svg, /<rect [^>]*fill="rgba\(255,255,255,0\.72\)"[^>]*>/g),
    polylines: extractMatches(svg, /<polyline [^>]*>/g),
    ellipsisLabels: extractMatches(svg, /<text [^>]*>[^<]*…[^<]*<\/text>/g),
    forceLabels: extractMatches(svg, /<text [^>]*fill="#2563eb"[^>]*>[^<]+<\/text>/g),
  };
}

function summarizeDiff(local, remote) {
  return {
    localCounts: {
      chipRects: local.chipRects.length,
      chipShadows: local.chipShadows.length,
      sheens: local.sheens.length,
      polylines: local.polylines.length,
      ellipsisLabels: local.ellipsisLabels.length,
      forceLabels: local.forceLabels.length,
    },
    remoteCounts: {
      chipRects: remote.chipRects.length,
      chipShadows: remote.chipShadows.length,
      sheens: remote.sheens.length,
      polylines: remote.polylines.length,
      ellipsisLabels: remote.ellipsisLabels.length,
      forceLabels: remote.forceLabels.length,
    },
    missingBlocksOnRemote: [
      local.chipRects.length > 0 && remote.chipRects.length === 0 ? "chipRects" : null,
      local.chipShadows.length > 0 && remote.chipShadows.length === 0 ? "chipShadows" : null,
      local.sheens.length > 0 && remote.sheens.length === 0 ? "sheens" : null,
      local.polylines.length > 0 && remote.polylines.length === 0 ? "polylines" : null,
      local.ellipsisLabels.length > 0 && remote.ellipsisLabels.length === 0 ? "ellipsisLabels" : null,
    ].filter(Boolean),
    examples: {
      localChipRect: local.chipRects[0] || null,
      localPolyline: local.polylines[0] || null,
      localEllipsis: local.ellipsisLabels[0] || null,
      remoteForceLabel: remote.forceLabels[0] || null,
    },
  };
}

async function renderLocalSvg(payload) {
  const tempDir = await prepareTempModuleDir();
  try {
    const { renderForceAnalysisSvg } = await import(pathToFileURL(path.join(tempDir, "extras.ts")).href);
    return renderForceAnalysisSvg(payload);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function renderRemoteSvg(payload) {
  await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "plot-force-struct", version: "0.1.0" } });
  const result = parseToolResult(await rpc("tools/call", { name: "force_analysis_link", arguments: payload }));
  return fetch(result.svg_url).then((response) => response.text());
}

const payload = buildDenseLongLabelPayload();
const [localSvg, remoteSvg] = await Promise.all([
  renderLocalSvg(payload),
  renderRemoteSvg(payload),
]);

const diff = summarizeDiff(analyzeSvg(localSvg), analyzeSvg(remoteSvg));
console.log(JSON.stringify(diff, null, 2));

if (diff.missingBlocksOnRemote.length > 0) {
  process.exitCode = 2;
}
