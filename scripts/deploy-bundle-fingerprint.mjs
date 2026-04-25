import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = "/Users/lingion/plot-mcp-cloudflare";
const wranglerConfig = path.join(projectRoot, "wrangler.toml");

async function buildDryRunBundle() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "plot-bundle-fingerprint-"));
  try {
    await execFileAsync("wrangler", ["deploy", "--dry-run", "--outdir", tempDir, "--config", wranglerConfig], {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024,
      env: process.env,
    });
    const bundlePath = path.join(tempDir, "index.js");
    const bundle = await readFile(bundlePath, "utf8");
    return { tempDir, bundlePath, bundle };
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

function countMatches(text, pattern) {
  return (text.match(pattern) || []).length;
}

function buildFingerprint(bundle) {
  return {
    serverVersion: bundle.match(/SERVER_VERSION\s*=\s*"([^"]+)"/)?.[1] || null,
    compactForceLabelText: bundle.includes("function compactForceLabelText("),
    renderForceLabelChip: bundle.includes("function renderForceLabelChip("),
    renderForceLabelConnector: bundle.includes("function renderForceLabelConnector("),
    assignForceConnectorLanes: bundle.includes("function assignForceConnectorLanes("),
    coordinateForceLabelColumns: bundle.includes("function coordinateForceLabelColumns("),
    compactPlacementFlow: bundle.includes("assignForceConnectorLanes(adjustForceLabelPositions(coordinateForceLabelColumns(pendingLabels)))"),
    compactConnectorPush: bundle.includes("vectorLines.push(renderForceLabelConnector(item, anchorX, anchorY));"),
    compactChipPush: bundle.includes("vectorLines.push(renderForceLabelChip(item));"),
    autoSimplifiedWarning: bundle.includes("auto-simplified") && bundle.includes("dense force layouts readable"),
    forceAnalysisRouteCount: countMatches(bundle, /\/force-analysis\.svg/g),
    plotRouteCount: countMatches(bundle, /url\.pathname === "\/plot"/g),
    badPlotQueryHandler: bundle.includes('error: "bad_plot_query"'),
    svgPlotResponse: bundle.includes('content-type": "image/svg+xml; charset=utf-8"') && bundle.includes("renderPlotSvg(spec)"),
  };
}

const { tempDir, bundlePath, bundle } = await buildDryRunBundle();
try {
  const fingerprint = buildFingerprint(bundle);
  const result = {
    bundlePath,
    fingerprint,
    looksReadyForCompactForceAnalysis: Object.entries(fingerprint)
      .filter(([key]) => !["serverVersion", "forceAnalysisRouteCount", "plotRouteCount"].includes(key))
      .every(([, value]) => value === true),
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.looksReadyForCompactForceAnalysis || fingerprint.serverVersion !== "0.2.0") {
    process.exitCode = 2;
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
