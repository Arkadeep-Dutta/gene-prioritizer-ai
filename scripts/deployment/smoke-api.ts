import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
};

type SmokeFetch = typeof fetch;

const SECRET_PATTERNS = [
  /ADMIN_INGEST_SECRET/i,
  /DATABASE_URL/i,
  /OPENAI_API_KEY/i,
  /ANTHROPIC_API_KEY/i,
  /GEMINI_API_KEY/i,
  /change-me-in-production/i,
];

function wait(ms: number) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function canReach(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(url: string, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await canReach(url)) return;
    await wait(1_000);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startLocalServer(baseUrl: string): ChildProcess {
  const parsed = new URL(baseUrl);
  const hostname = parsed.hostname || "127.0.0.1";
  const port = parsed.port || "3000";
  const env = { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? "file:./dev.db" };
  return spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "--hostname", hostname, "--port", port],
    { env, stdio: "inherit" },
  );
}

function assertNoSecretLeak(text: string, label: string) {
  const leaked = SECRET_PATTERNS.find((pattern) => pattern.test(text));
  if (leaked) throw new Error(`${label} leaked secret-like text matching ${leaked}`);
}

async function expectOk(response: Response, label: string): Promise<string> {
  const text = await response.text();
  assertNoSecretLeak(text, label);
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}: ${text}`);
  return text;
}

async function getJson<T>(
  fetchFn: SmokeFetch,
  baseUrl: string,
  path: string,
): Promise<ApiEnvelope<T>> {
  const response = await fetchFn(`${baseUrl}${path}`);
  return JSON.parse(await expectOk(response, path)) as ApiEnvelope<T>;
}

async function postJson<T>(
  fetchFn: SmokeFetch,
  baseUrl: string,
  path: string,
  body: unknown,
): Promise<ApiEnvelope<T>> {
  const response = await fetchFn(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return JSON.parse(await expectOk(response, path)) as ApiEnvelope<T>;
}

export async function runSmokeApi(options: {
  baseUrl: string;
  fetchFn?: SmokeFetch;
  includeNetworkTests?: boolean;
}) {
  const fetchFn = options.fetchFn ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, "");

  const home = await fetchFn(`${baseUrl}/`);
  const homeText = await expectOk(home, "GET /");
  if (!homeText.includes("Research and educational use only")) {
    throw new Error("GET / did not include safety disclaimer text.");
  }

  const health = await getJson<{ status?: string }>(fetchFn, baseUrl, "/api/health");
  if (!health.ok || health.data?.status !== "ok")
    throw new Error("Health check did not return ok.");

  const version = await getJson<Record<string, unknown>>(fetchFn, baseUrl, "/api/data/version");
  if (!version.ok) throw new Error("Data version endpoint did not return ok.");

  const phenotype = await postJson<{ terms?: unknown[] }>(
    fetchFn,
    baseUrl,
    "/api/phenotype/extract",
    {
      text: "Synthetic note: seizures and developmental delay.",
      useLLM: false,
    },
  );
  if (!phenotype.ok) throw new Error("Phenotype extraction smoke failed.");

  const prioritize = await postJson<{ results?: unknown[] }>(fetchFn, baseUrl, "/api/prioritize", {
    hpoTerms: ["HP:0001250"],
    candidateGenes: ["SCN2A"],
    rankingMode: "CANDIDATE_BOOSTED",
    limit: 3,
    storeResults: false,
    privacyMode: true,
    includeLiterature: false,
    literatureRetmax: 1,
    literatureSummaries: false,
  });
  if (!prioritize.ok || !Array.isArray(prioritize.data?.results)) {
    throw new Error("Prioritize smoke did not return results.");
  }

  if (options.includeNetworkTests) {
    const genes = await postJson<{ results?: unknown[] }>(fetchFn, baseUrl, "/api/genes/validate", {
      genes: ["SCN2A"],
      useCache: true,
    });
    if (!genes.ok) throw new Error("Gene validation network-optional smoke failed.");
  }
}

async function main() {
  const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
  const includeNetworkTests = process.env.SMOKE_INCLUDE_NETWORK_TESTS === "true";
  let server: ChildProcess | undefined;
  try {
    if (!process.env.SMOKE_BASE_URL && !(await canReach(baseUrl))) {
      server = startLocalServer(baseUrl);
      await waitForServer(baseUrl);
    }
    await runSmokeApi({ baseUrl, includeNetworkTests });
    console.log(`Smoke API checks passed for ${baseUrl}`);
  } finally {
    if (server) server.kill();
  }
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? "")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
