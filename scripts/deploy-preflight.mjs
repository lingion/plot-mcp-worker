import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = "/Users/lingion/plot-mcp-cloudflare";

async function run(command, args) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd: projectRoot,
    maxBuffer: 30 * 1024 * 1024,
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
    if (!allowFailure) {
      return result;
    }
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

function extractSmokeFailure(step) {
  const text = `${step?.stdout || ""}\n${step?.stderr || ""}`;
  const missingToolText = text.match(/missing tool text: (\{[\s\S]*\})/);
  if (missingToolText) {
    try {
      const parsed = JSON.parse(missingToolText[1]);
      return {
        kind: "missing_tool_text",
        rpcError: parsed?.error || null,
      };
    } catch {
      return {
        kind: "missing_tool_text",
        raw: missingToolText[1],
      };
    }
  }
  const errorLine = text.split("\n").find((line) => line.startsWith("Error: "));
  return errorLine ? { kind: "assertion", message: errorLine.slice("Error: ".length) } : null;
}

const specs = [
  { name: "typecheck", command: "pnpm", args: ["--dir", projectRoot, "check"] },
  { name: "bundleFingerprint", command: "pnpm", args: ["--dir", projectRoot, "check:bundle-fingerprint"] },
  { name: "forceVerify", command: "pnpm", args: ["--dir", projectRoot, "check:force-verify"], allowFailure: true },
  { name: "smoke", command: "pnpm", args: ["--dir", projectRoot, "test:smoke"], allowFailure: true },
];

const steps = [];
for (const spec of specs) {
  const step = await runStep(spec.name, spec.command, spec.args, spec.allowFailure);
  steps.push(step);
  if (!step.ok && !spec.allowFailure) break;
}

const forceVerify = parseJsonFromStdout(steps.find((step) => step.name === "forceVerify")?.stdout || "");
const bundleFingerprint = parseJsonFromStdout(steps.find((step) => step.name === "bundleFingerprint")?.stdout || "");
const smokeStep = steps.find((step) => step.name === "smoke");
const smokeFailure = smokeStep && !smokeStep.ok ? extractSmokeFailure(smokeStep) : null;

const releaseReady = Boolean(
  steps.find((step) => step.name === "typecheck")?.ok
  && steps.find((step) => step.name === "bundleFingerprint")?.ok
  && steps.find((step) => step.name === "forceVerify")?.ok
  && steps.find((step) => step.name === "smoke")?.ok
);

const summary = {
  releaseReady,
  steps: steps.map((step) => ({
    name: step.name,
    ok: step.ok,
    exitCode: step.exitCode,
  })),
  bundleFingerprint,
  forceVerify: forceVerify ? {
    steps: forceVerify.steps,
    compactDiagnosis: forceVerify.compactDiagnosis,
    driftDiagnosis: forceVerify.driftDiagnosis,
  } : null,
  smoke: smokeStep ? {
    ok: smokeStep.ok,
    exitCode: smokeStep.exitCode,
    passed: smokeStep.ok && /Smoke tests passed against/.test(smokeStep.stdout),
    failure: smokeFailure,
  } : null,
};

console.log(JSON.stringify(summary, null, 2));

if (!releaseReady) {
  process.exitCode = 2;
}
