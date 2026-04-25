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
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "plot-force-diagnose-"));
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
    title: "dense-long-label-diagnose",
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

function estimateTextWidth(text, fontSize, weight = 1) {
  return String(text || "").length * fontSize * (0.56 + (weight - 1) * 0.03);
}

function compactForceLabelText(text, maxWidth) {
  const plain = String(text || "").trim();
  if (!plain) return "";
  if (estimateTextWidth(plain, 13, 1.1) <= maxWidth) return plain;
  let compact = plain;
  while (compact.length > 1 && estimateTextWidth(`${compact}…`, 13, 1.1) > maxWidth) {
    compact = compact.slice(0, -1).trimEnd();
  }
  return `${compact || plain[0]}…`;
}

function forceLabelMaxWidth(side) {
  if (side === "left") return 88;
  if (side === "right") return 96;
  return 84;
}

function vectorLabelAnchor(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy) * 1.2) return dx >= 0 ? "start" : "end";
  return "middle";
}

function buildCompactExpectations(payload) {
  const preferLocalAngles = Math.abs(Number(payload.incline_deg || 0)) > 0.01;
  const totalForces = Array.isArray(payload.bodies)
    ? payload.bodies.reduce((sum, body) => sum + ((Array.isArray(body.forces) ? body.forces.length : 0)), 0)
    : Array.isArray(payload.forces) ? payload.forces.length : 0;
  const compactMode = totalForces >= 5 || (preferLocalAngles && Array.isArray(payload.bodies) && payload.bodies.some((body) => Array.isArray(body.forces) && body.forces.length >= 4));
  const labels = (Array.isArray(payload.forces) ? payload.forces : []).map((force) => {
    const angle = Number(force.angle_deg || 0) * Math.PI / 180;
    const dx = Math.cos(angle) * Math.max(0.5, Number(force.magnitude || 1));
    const dy = Math.sin(angle) * Math.max(0.5, Number(force.magnitude || 1));
    const anchor = vectorLabelAnchor(dx, dy);
    const side = anchor === "start" ? "right" : anchor === "end" ? "left" : "center";
    const rawLabel = String(force.label || "F");
    return {
      rawLabel,
      side,
      compactLabel: compactForceLabelText(rawLabel, forceLabelMaxWidth(side)),
    };
  });
  return {
    totalForces,
    preferLocalAngles,
    compactMode,
    labels,
    truncatedLabels: labels.filter((item) => item.compactLabel !== item.rawLabel),
  };
}

function summarizeRemoteSvg(svg) {
  return {
    chipRects: (svg.match(/fill="rgba\(251,253,255,0\.9\)"/g) || []).length,
    chipShadows: (svg.match(/fill="rgba\(148,163,184,0\.16\)"/g) || []).length,
    sheens: (svg.match(/fill="rgba\(255,255,255,0\.72\)"/g) || []).length,
    polylines: (svg.match(/<polyline /g) || []).length,
    ellipsisLabels: (svg.match(/…/g) || []).length,
    fullLongLabelPresent: svg.includes("沿斜面向上的超长教学标签示例"),
  };
}

async function loadLocalRenderer() {
  const tempDir = await prepareTempModuleDir();
  try {
    const { renderForceAnalysisSvg } = await import(pathToFileURL(path.join(tempDir, "extras.ts")).href);
    return { renderForceAnalysisSvg };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

const payload = buildDenseLongLabelPayload();
const expected = buildCompactExpectations(payload);
await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "plot-force-diagnose", version: "0.1.0" } });
const remoteResult = parseToolResult(await rpc("tools/call", { name: "force_analysis_link", arguments: payload }));
const remoteSvg = await fetch(remoteResult.svg_url).then((response) => response.text());
const localModule = await loadLocalRenderer();
const localSvg = localModule.renderForceAnalysisSvg(payload);

const diagnosis = {
  endpoint,
  expected,
  local: summarizeRemoteSvg(localSvg),
  remote: summarizeRemoteSvg(remoteSvg),
  remotePayload: {
    show_components: remoteResult.payload?.show_components,
    show_axes: remoteResult.payload?.show_axes,
    show_resultant: remoteResult.payload?.show_resultant,
    incline_deg: remoteResult.payload?.incline_deg,
  },
  likelyMissingCompactPipeline: expected.compactMode && expected.truncatedLabels.length > 0 && summarizeRemoteSvg(remoteSvg).ellipsisLabels === 0,
};

console.log(JSON.stringify(diagnosis, null, 2));

if (diagnosis.likelyMissingCompactPipeline) {
  process.exitCode = 2;
}
