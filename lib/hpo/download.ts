import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import {
  DEFAULT_HPO_DATA_DIR,
  DEFAULT_HPO_DOWNLOAD_RETRIES,
  DEFAULT_HPO_DOWNLOAD_TIMEOUT_MS,
  HPO_APPROVED_DOWNLOAD_URLS,
  HPO_SOURCE_FILES,
  MAX_DOWNLOAD_BYTES,
} from "./constants";
import { HpoDownloadError } from "./errors";
import { sha256File } from "./hash";

export type DownloadedHpoFile = {
  fileName: string;
  url: string;
  path: string;
  sha256: string;
  bytes: number;
  skipped: boolean;
};

export type DownloadHpoOptions = {
  dataDir?: string;
  timeoutMs?: number;
  retries?: number;
  force?: boolean;
  allowNetwork?: boolean;
};

export function resolveHpoDataDir(
  dataDir = process.env.HPO_DATA_DIR ?? DEFAULT_HPO_DATA_DIR,
): string {
  const workspaceRoot = resolve(process.cwd());
  const resolved = resolve(workspaceRoot, dataDir);
  if (!resolved.startsWith(workspaceRoot)) {
    throw new HpoDownloadError("HPO_DATA_DIR must resolve inside the project workspace.");
  }
  return resolved;
}

async function getExistingGoodFile(
  path: string,
  minBytes: number,
): Promise<{ bytes: number } | null> {
  try {
    const file = await stat(path);
    if (file.isFile() && file.size >= minBytes) return { bytes: file.size };
    return null;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  if (!HPO_APPROVED_DOWNLOAD_URLS.has(url)) {
    throw new HpoDownloadError(`Refusing to download from unapproved HPO URL: ${url}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadOne(
  source: { fileName: string; url: string; minBytes: number },
  rawDir: string,
  timeoutMs: number,
  retries: number,
  force: boolean,
): Promise<DownloadedHpoFile> {
  const destination = resolve(rawDir, basename(source.fileName));
  if (!destination.startsWith(rawDir)) {
    throw new HpoDownloadError(`Unsafe HPO destination path for ${source.fileName}.`);
  }

  const existing = await getExistingGoodFile(destination, source.minBytes);
  if (existing && !force) {
    return {
      fileName: source.fileName,
      url: source.url,
      path: destination,
      sha256: await sha256File(destination),
      bytes: existing.bytes,
      skipped: true,
    };
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      const response = await fetchWithTimeout(source.url, timeoutMs);
      if (!response.ok) {
        throw new HpoDownloadError(
          `${source.fileName} download failed with HTTP ${response.status}.`,
        );
      }
      const contentLength = Number.parseInt(response.headers.get("content-length") ?? "0", 10);
      if (contentLength > MAX_DOWNLOAD_BYTES) {
        throw new HpoDownloadError(`${source.fileName} exceeds the maximum allowed download size.`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength < source.minBytes) {
        throw new HpoDownloadError(`${source.fileName} download was unexpectedly small.`);
      }
      if (buffer.byteLength > MAX_DOWNLOAD_BYTES) {
        throw new HpoDownloadError(`${source.fileName} exceeds the maximum allowed download size.`);
      }
      await writeFile(destination, buffer);
      return {
        fileName: source.fileName,
        url: source.url,
        path: destination,
        sha256: await sha256File(destination),
        bytes: buffer.byteLength,
        skipped: false,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new HpoDownloadError(
    `Unable to download ${source.fileName} after ${retries + 1} attempt(s): ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

export async function downloadHpoSources(
  options: DownloadHpoOptions = {},
): Promise<DownloadedHpoFile[]> {
  const allowNetwork =
    options.allowNetwork ?? (process.env.HPO_ALLOW_NETWORK_DOWNLOADS ?? "true") === "true";
  if (!allowNetwork) {
    throw new HpoDownloadError(
      "HPO network downloads are disabled by HPO_ALLOW_NETWORK_DOWNLOADS.",
    );
  }

  const dataDir = resolveHpoDataDir(options.dataDir);
  const rawDir = resolve(dataDir, "raw");
  const metadataDir = resolve(dataDir, "metadata");
  await mkdir(rawDir, { recursive: true });
  await mkdir(metadataDir, { recursive: true });

  const parsedTimeoutMs = Number.parseInt(process.env.HPO_DOWNLOAD_TIMEOUT_MS ?? "", 10);
  const parsedRetries = Number.parseInt(process.env.HPO_DOWNLOAD_RETRIES ?? "", 10);
  const timeoutMs =
    options.timeoutMs ??
    (Number.isFinite(parsedTimeoutMs) ? parsedTimeoutMs : DEFAULT_HPO_DOWNLOAD_TIMEOUT_MS);
  const retries =
    options.retries ??
    (Number.isFinite(parsedRetries) ? parsedRetries : DEFAULT_HPO_DOWNLOAD_RETRIES);

  const downloaded = [];
  for (const source of Object.values(HPO_SOURCE_FILES)) {
    downloaded.push(await downloadOne(source, rawDir, timeoutMs, retries, options.force ?? false));
  }

  await writeFile(
    resolve(metadataDir, "download-manifest.json"),
    JSON.stringify(
      {
        downloadedAt: new Date().toISOString(),
        files: downloaded.map(({ fileName, url, sha256, bytes, skipped }) => ({
          fileName,
          url,
          sha256,
          bytes,
          skipped,
        })),
      },
      null,
      2,
    ),
  );

  return downloaded;
}
