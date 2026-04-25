import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = "/Users/lingion/plot-mcp-cloudflare";

async function run(command, args) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd: projectRoot,
    maxBuffer: 20 * 1024 * 1024,
    env: process.env,
  });
  return { stdout, stderr };
}

async function runStep(name, command, args, allowFailure = false) {
  try {
    const result = await run(command, args);
    return { name, ok: true, exitCode: 0, ...result };
  } catch (error) {
    const result = {
      name,
      ok: false,
      exitCode: Number(error?.code || 1),
      stdout: String(error?.stdout || ""),
      stderr: String(error?.stderr || ""),
    };
    if (!allowFailure) throw Object.assign(new Error(`${name} failed`), { stepResult: result });
    return result;
  }
}

function parseJsonFromStdout(stdout) {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(stdout.slice(start, end + 1));
  } catch {
    return null;
  }
}

const steps = [];
let failed = false;

for (const spec of [
  { name: "bundleFingerprint", command: "pnpm", args: ["--dir", projectRoot, "check:bundle-fingerprint"] },
  { name: "compactDiagnosis", command: "pnpm", args: ["--dir", projectRoot, "check:force-compact"], allowFailure: true },
  { name: "driftCheck", command: "pnpm", args: ["--dir", projectRoot, "check:force-drift"], allowFailure: true },
  { name: "typecheck", command: "pnpm", args: ["--dir", projectRoot, "check"] },
]) {
  const step = await runStep(spec.name, spec.command, spec.args, spec.allowFailure);
  steps.push(step);
  if (!step.ok && !spec.allowFailure) {
    failed = true;
    break;
  }
}

const compactDiagnosis = parseJsonFromStdout(steps.find((step) => step.name === "compactDiagnosis")?.stdout || "");
const driftDiagnosis = parseJsonFromStdout(steps.find((step) => step.name === "driftCheck")?.stdout || "");
const bundleFingerprint = parseJsonFromStdout(steps.find((step) => step.name === "bundleFingerprint")?.stdout || "");

const summary = {
  steps: steps.map((step) => ({
    name: step.name,
    ok: step.ok,
    exitCode: step.exitCode,
  })),
  bundleFingerprint,
  compactDiagnosis: compactDiagnosis ? {
    likelyMissingCompactPipeline: compactDiagnosis.likelyMissingCompactPipeline,
    local: compactDiagnosis.local,
    remote: compactDiagnosis.remote,
  } : null,
  driftDiagnosis: driftDiagnosis ? {
    versionMismatch: driftDiagnosis.versionMismatch,
    denseMissingOnRemote: driftDiagnosis.dense?.missingOnRemote,
    explicitMissingOnRemote: driftDiagnosis.explicitFlags?.missingOnRemote,
    remoteServerInfo: driftDiagnosis.remoteServerInfo,
  } : null,
};

console.log(JSON.stringify(summary, null, 2));

if (failed) {
  process.exitCode = 2;
}
