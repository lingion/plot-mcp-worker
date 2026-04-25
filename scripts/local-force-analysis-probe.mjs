import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = "/Users/lingion/plot-mcp-cloudflare";
const sourceDir = path.join(projectRoot, "src");
const files = ["constants.ts", "utils.ts", "extras.ts"];

function patchLocalImports(source) {
  return source.replace(/from "(\.\/.+?)"/g, (_match, specifier) => {
    return `from "${specifier}.ts"`;
  });
}

async function prepareTempModuleDir() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "plot-force-probe-"));
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
    title: "dense-long-label-local",
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

const tempDir = await prepareTempModuleDir();
try {
  const { renderForceAnalysisSvg } = await import(pathToFileURL(path.join(tempDir, "extras.ts")).href);
  const svg = renderForceAnalysisSvg(buildDenseLongLabelPayload());
  console.log(JSON.stringify(summarizeSvg(svg), null, 2));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
