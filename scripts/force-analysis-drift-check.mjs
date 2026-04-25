import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = "/Users/lingion/plot-mcp-cloudflare";
const sourceDir = path.join(projectRoot, "src");
const endpoint = process.env.PLOT_MCP_ENDPOINT || "https://plot-mcp.qdp.qzz.io/mcp";
const files = ["constants.ts", "utils.ts", "extras.ts"];

function patchLocalImports(source) {
  return source.replace(/from "(\.\/.+?)"/g, (_match, specifier) => {
    return `from "${specifier}.ts"`;
  });
}

async function prepareTempModuleDir() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "plot-force-drift-"));
  await Promise.all(files.map(async (file) => {
    const source = await readFile(path.join(sourceDir, file), "utf8");
    const patched = patchLocalImports(source);
    await writeFile(path.join(tempDir, file), patched);
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
    title: "dense-long-label-drift-check",
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

function buildExplicitFlagsPayload() {
  return {
    ...buildDenseLongLabelPayload(),
    title: "dense-long-label-explicit-flags",
    show_components: false,
    show_axes: false,
    show_resultant: false,
  };
}

function summarizeSvg(svg) {
  return {
    rects: (svg.match(/<rect /g) || []).length,
    chipFill: (svg.match(/fill="rgba\(251,253,255,0\.9\)"/g) || []).length,
    chipShadow: (svg.match(/fill="rgba\(148,163,184,0\.16\)"/g) || []).length,
    sheen: (svg.match(/fill="rgba\(255,255,255,0\.72\)"/g) || []).length,
    polyline: (svg.match(/<polyline /g) || []).length,
    ellipsis: (svg.match(/…/g) || []).length,
    middle: (svg.match(/text-anchor="middle"/g) || []).length,
    start: (svg.match(/text-anchor="start"/g) || []).length,
    end: (svg.match(/text-anchor="end"/g) || []).length,
    hasWarning: svg.includes("已自动简化"),
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

async function renderLocalSummary(payload) {
  const tempDir = await prepareTempModuleDir();
  try {
    const { renderForceAnalysisSvg } = await import(pathToFileURL(path.join(tempDir, "extras.ts")).href);
    return summarizeSvg(renderForceAnalysisSvg(payload));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function renderRemoteSummary(payload) {
  const initialize = await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "plot-force-drift", version: "0.1.0" } });
  const result = parseToolResult(await rpc("tools/call", { name: "force_analysis_link", arguments: payload }));
  const svg = await fetch(result.svg_url).then((response) => response.text());
  return {
    summary: summarizeSvg(svg),
    warnings: result.warnings || [],
    payload: result.payload,
    serverInfo: initialize?.result?.serverInfo || null,
  };
}

const densePayload = buildDenseLongLabelPayload();
const explicitFlagsPayload = buildExplicitFlagsPayload();
const [localDense, remoteDense, localExplicit, remoteExplicit] = await Promise.all([
  renderLocalSummary(densePayload),
  renderRemoteSummary(densePayload),
  renderLocalSummary(explicitFlagsPayload),
  renderRemoteSummary(explicitFlagsPayload),
]);

const featureKeys = ["chipFill", "chipShadow", "sheen", "polyline", "ellipsis"];
const missingOnRemoteDense = featureKeys.filter((key) => localDense[key] > 0 && remoteDense.summary[key] === 0);
const missingOnRemoteExplicit = featureKeys.filter((key) => localExplicit[key] > 0 && remoteExplicit.summary[key] === 0);
const versionMismatch = remoteDense.serverInfo?.version && remoteDense.serverInfo.version !== "0.2.0";

console.log(JSON.stringify({
  endpoint,
  dense: {
    local: localDense,
    remote: remoteDense.summary,
    remoteWarnings: remoteDense.warnings,
    remotePayload: {
      show_components: remoteDense.payload?.show_components,
      show_axes: remoteDense.payload?.show_axes,
      show_resultant: remoteDense.payload?.show_resultant,
      incline_deg: remoteDense.payload?.incline_deg,
    },
    missingOnRemote: missingOnRemoteDense,
  },
  explicitFlags: {
    local: localExplicit,
    remote: remoteExplicit.summary,
    remoteWarnings: remoteExplicit.warnings,
    remotePayload: {
      show_components: remoteExplicit.payload?.show_components,
      show_axes: remoteExplicit.payload?.show_axes,
      show_resultant: remoteExplicit.payload?.show_resultant,
      incline_deg: remoteExplicit.payload?.incline_deg,
    },
    missingOnRemote: missingOnRemoteExplicit,
  },
  remoteServerInfo: remoteDense.serverInfo,
  versionMismatch,
}, null, 2));

if (missingOnRemoteDense.length > 0 || missingOnRemoteExplicit.length > 0 || versionMismatch) {
  process.exitCode = 2;
}
