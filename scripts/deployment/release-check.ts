import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const requiredFiles = [
  "README.md",
  "DEPLOYMENT.md",
  "SECURITY.md",
  "PRIVACY.md",
  "DATA_SOURCES.md",
  "DISCLAIMER.md",
  ".env.example",
  ".env.docker.example",
  ".gitignore",
  ".dockerignore",
  "Dockerfile",
  "docker-compose.yml",
  "docs/ARCHITECTURE.md",
  "docs/FINAL_AUDIT.md",
  "docs/RELEASE_NOTES.md",
  "docs/RELEASE_CANDIDATE_CHECKLIST.md",
  "docs/RELEASE_CHECKLIST.md",
  "docs/OPERATIONS.md",
  "docs/TROUBLESHOOTING.md",
];

const requiredScripts = ["verify", "verify:full", "deploy:check", "release:check", "smoke:api"];
const skipDirs = new Set([".git", ".next", "node_modules", "work", "outputs", "coverage"]);
const localSecretArtifacts = [".env", ".env.docker", ".neon"];
const skipFiles = new Set(["package-lock.json", "tsconfig.tsbuildinfo", ...localSecretArtifacts]);
const skipExtensions = [".db", ".db-journal", ".db-shm", ".db-wal", ".sqlite", ".sqlite3", ".gz"];

function assertFileExists(path: string) {
  if (!existsSync(path)) throw new Error(`Missing release file: ${path}`);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function walkFiles(dir = "."): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(path));
      continue;
    }
    if (
      entry.isFile() &&
      !skipFiles.has(entry.name) &&
      !skipExtensions.some((extension) => entry.name.endsWith(extension))
    ) {
      files.push(path);
    }
  }
  return files;
}

function assertNoScratchArtifacts() {
  const scratchName = /(^|[\\/])(\.codex|000_PHASE|AAA|CODEX_|FAILFILE)/;
  const found = walkFiles().filter((path) => scratchName.test(path));
  if (found.length > 0) {
    throw new Error(`Scratch/debug artifacts remain: ${found.join(", ")}`);
  }
}

function gitCheckIgnored(path: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "--quiet", path], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function gitTracked(path: string): boolean {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", path], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function assertLocalSecretArtifactsIgnored() {
  const unsafe = localSecretArtifacts.filter(
    (path) => existsSync(path) && (!gitCheckIgnored(path) || gitTracked(path)),
  );
  if (unsafe.length > 0) {
    throw new Error(
      "Local secret files must be ignored and untracked before release: " + unsafe.join(", "),
    );
  }
}

function assertNoObviousSecrets() {
  const secretPatterns = [
    /sk-[A-Za-z0-9]{20,}/,
    new RegExp(["BEGIN", "PRIVATE KEY"].join(" ")),
    /DATABASE_URL=postgres:\/\//,
  ];
  const adminSecretPattern = /ADMIN_INGEST_SECRET="?([A-Za-z0-9_-]{16,})"?/;
  const allowedAdminSecretValues = new Set([
    "change-me-in-production",
    "replace-this-local-docker-secret",
  ]);

  for (const file of walkFiles()) {
    const text = readFileSync(file, "utf8");
    for (const pattern of secretPatterns) {
      if (pattern.test(text))
        throw new Error(`Potential secret pattern ${pattern} found in ${file}`);
    }
    const match = text.match(adminSecretPattern);
    if (match && !allowedAdminSecretValues.has(match[1])) {
      throw new Error(`Potential real ADMIN_INGEST_SECRET value found in ${file}`);
    }
  }
}

function assertPackageScripts() {
  const pkg = readJson<{ scripts?: Record<string, string> }>("package.json");
  for (const script of requiredScripts) {
    if (!pkg.scripts?.[script]) throw new Error(`package.json missing script: ${script}`);
  }
}

function assertEnvExample() {
  const text = readFileSync(".env.example", "utf8");
  for (const key of [
    "APP_VERSION",
    "BUILD_COMMIT_SHA",
    "DEPLOYMENT_TARGET",
    "ADMIN_INGEST_SECRET",
    "GENE_CARDS_LICENSED_IMPORT_ENABLED",
  ]) {
    if (!text.includes(`${key}=`)) throw new Error(`.env.example missing ${key}`);
  }
}

function assertSafetyLanguage() {
  const combinedDocs = [
    "README.md",
    "DISCLAIMER.md",
    "SECURITY.md",
    "PRIVACY.md",
    "DATA_SOURCES.md",
    "docs/FINAL_AUDIT.md",
    "docs/RELEASE_NOTES.md",
  ]
    .map((path) => readFileSync(path, "utf8").toLowerCase())
    .join("\n");

  for (const phrase of ["not a diagnosis", "not medical advice", "research"]) {
    if (!combinedDocs.includes(phrase)) {
      throw new Error(`Required safety language missing: ${phrase}`);
    }
  }
}

for (const file of requiredFiles) assertFileExists(file);
assertPackageScripts();
assertEnvExample();
assertSafetyLanguage();
assertNoScratchArtifacts();
assertLocalSecretArtifactsIgnored();
assertNoObviousSecrets();

if (existsSync(".env") && statSync(".env").isFile()) {
  console.log("Local .env exists; verify git status before release and do not commit it.");
}

console.log("Release file/config checks passed. Run npm run verify:full before tagging.");
