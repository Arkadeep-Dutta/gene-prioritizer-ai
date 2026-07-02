import { spawn, type ChildProcess } from "node:child_process";

const port = Number.parseInt(process.env.E2E_PORT ?? "3130", 10);
const baseUrl = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
const shouldStartServer = !process.env.E2E_BASE_URL;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url: string, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await wait(1_000);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function expectPage(path: string, expected: string) {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  const html = await response.text();
  if (!html.includes(expected)) throw new Error(`${path} did not include "${expected}"`);
}

async function expectPrioritize() {
  const response = await fetch(`${baseUrl}/api/prioritize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hpoTerms: ["HP:0001250"],
      candidateGenes: ["SCN2A"],
      rankingMode: "CANDIDATE_BOOSTED",
      limit: 3,
      storeResults: false,
      privacyMode: true,
      includeLiterature: false,
      literatureRetmax: 1,
      literatureSummaries: false,
    }),
  });
  const body = (await response.json()) as { ok?: boolean; data?: { results?: unknown[] } };
  if (!response.ok || !body.ok) {
    throw new Error(`/api/prioritize returned HTTP ${response.status}`);
  }
  if (!Array.isArray(body.data?.results)) {
    throw new Error("/api/prioritize did not return a results array");
  }
}

function startServer(): ChildProcess {
  const env = { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? "file:./dev.db" };
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      env,
      stdio: "inherit",
    },
  );
  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });
  return child;
}

let server: ChildProcess | undefined;

async function main() {
  try {
    if (shouldStartServer) server = startServer();
    await waitForServer(`${baseUrl}/`);
    await expectPage("/", "Research and educational use only");
    await expectPage("/about", "About Gene Prioritizer AI");
    await expectPage("/methodology", "Methodology");
    await expectPage("/data-sources", "Data sources");
    await expectPage("/disclaimer", "Disclaimer");
    await expectPage("/privacy", "Privacy");
    await expectPage("/security", "Security");
    await expectPrioritize();
    console.log("Phase 8 E2E smoke passed.");
  } finally {
    if (server) server.kill();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
