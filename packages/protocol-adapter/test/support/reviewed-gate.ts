import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OPENAPI_INTEGRATION_GATE_PIN } from "../../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

export function findProtocolRoot(): string | null {
  const candidates = [
    process.env.KIX_PROTOCOL_ROOT,
    path.resolve(repoRoot, "../kix-protocol-prod-readiness"),
    path.resolve(repoRoot, "../kix-protocol-http-gate"),
  ].filter((item): item is string => Boolean(item));
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "integration_gate", "__main__.py"))) {
      return candidate;
    }
  }
  return null;
}

export function protocolRoot(): string {
  const root = findProtocolRoot();
  if (root === null) {
    throw new Error("Set KIX_PROTOCOL_ROOT to the kix-protocol checkout that contains integration_gate.");
  }
  return root;
}

/**
 * Whether a missing checkout fails the run. KIX_REQUIRE_GATE=1 or 0 decides
 * outright. Otherwise an explicit KIX_PROTOCOL_ROOT, or a CI run, requires the
 * gate, so a wrong path or a failed checkout step is not a silent skip.
 */
export function gateRequired(env: Record<string, string | undefined> = process.env): boolean {
  if (env.KIX_REQUIRE_GATE === "1") {
    return true;
  }
  if (env.KIX_REQUIRE_GATE === "0") {
    return false;
  }
  return Boolean(env.KIX_PROTOCOL_ROOT) || env.CI === "true" || env.CI === "1";
}

/**
 * The live gate suites need a reviewed kix-protocol checkout. On a local run
 * without one they are skipped with a warning, so `npm test` still runs the
 * rest of the adapter and the web suite. See gateRequired for when a missing
 * checkout fails instead.
 */
export const REVIEWED_GATE_RUNS = findProtocolRoot() !== null || gateRequired();

if (!REVIEWED_GATE_RUNS) {
  console.warn(
    "Skipping live integration-gate suites: no kix-protocol checkout. Set KIX_PROTOCOL_ROOT, or KIX_REQUIRE_GATE=1 to fail instead.",
  );
}

/**
 * The reviewed merge and the feature commit share one tree. Either checkout
 * is the published gate. A dirty tree or any other HEAD is refused.
 */
export function assertReviewedCheckout(root: string): void {
  const gateDoc = path.join(root, OPENAPI_INTEGRATION_GATE_PIN.openApiPath);
  const digest = createHash("sha256").update(readFileSync(gateDoc)).digest("hex");
  if (digest !== OPENAPI_INTEGRATION_GATE_PIN.openApiFileSha256) {
    throw new Error(`integration-gate OpenAPI at ${root} does not match the vendored pin`);
  }
  const catalogue = path.join(root, "docs/contracts/openapi/kix-protocol.contract-only.openapi.json");
  const catalogueDigest = createHash("sha256").update(readFileSync(catalogue)).digest("hex");
  if (catalogueDigest !== OPENAPI_INTEGRATION_GATE_PIN.contractOnlyOpenApiFileSha256) {
    throw new Error(`contract-only OpenAPI at ${root} does not match the vendored pin`);
  }
  const head = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const merge = OPENAPI_INTEGRATION_GATE_PIN.protocolMergeSha;
  const feature = OPENAPI_INTEGRATION_GATE_PIN.protocolFeatureSha;
  if (head !== merge && head !== feature) {
    throw new Error(`protocol HEAD ${head} is not the reviewed merge ${merge} or feature ${feature}`);
  }
  if (head === feature) {
    const headTree = execFileSync("git", ["-C", root, "rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
    const mergeTree = execFileSync("git", ["-C", root, "rev-parse", `${merge}^{tree}`], { encoding: "utf8" }).trim();
    if (headTree !== mergeTree) {
      throw new Error(`feature HEAD tree does not match merge ${merge}`);
    }
  }
  const dirty = execFileSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8" });
  if (dirty.trim()) {
    throw new Error("protocol checkout is dirty");
  }
}

export function startGate(root: string, extraArgs: string[] = []): Promise<{ baseUrl: string; child: ChildProcess }> {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", ["-m", "integration_gate", "--port", "0", ...extraArgs], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`integration gate did not listen\n${stderr}`));
    }, 15000);
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
      const match = stdout.match(/integration-gate listening 127\.0\.0\.1 (\d+)/);
      if (match?.[1] && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ baseUrl: `http://127.0.0.1:${match[1]}`, child });
      }
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(new Error(`integration gate exited ${code}: ${stderr}`));
    });
  });
}

export async function stopGate(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  child.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 2000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
