import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = "/Users/lingion/plot-mcp-cloudflare";

async function run(command, args, allowFailure = false) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: projectRoot,
      maxBuffer: 30 * 1024 * 1024,
      env: process.env,
    });
    return { ok: true, exitCode: 0, stdout, stderr };
  } catch (error) {
    const result = {
      ok: false,
      exitCode: Number(error?.code || 1),
      stdout: String(error?.stdout || ""),
      stderr: String(error?.stderr || ""),
    };
    if (!allowFailure) throw Object.assign(new Error(`${command} failed`), { stepResult: result });
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

const preflight = await run("pnpm", ["--dir", projectRoot, "check:deploy-preflight"], true);
steps.push({ name: "preflight", ok: preflight.ok, exitCode: preflight.exitCode });
const preflightSummary = parseJsonFromStdout(preflight.stdout);

const deployCommand = `wrangler deploy --config ${JSON.stringify(`${projectRoot}/wrangler.toml`)}`;

const summary = {
  readyToDeploy: Boolean(preflightSummary?.releaseReady === true),
  deployCommand,
  steps,
  preflight: preflightSummary,
  nextAction: preflightSummary?.releaseReady === true
    ? "safe_to_run_deploy"
    : "fix_remote_or_accept_redeploy_then_run_deploy_and_recheck",
};

console.log(JSON.stringify(summary, null, 2));

if (!summary.readyToDeploy) {
  process.exitCode = 2;
}
