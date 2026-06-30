import { normalizeGeneSymbol } from "./normalize";
import { HgncClientError } from "./errors";
import { generateGeneLinkouts } from "./linkouts";
import type { GeneValidationResult, HgncClientOptions, HgncRecord } from "./types";

const DEFAULT_HGNC_API_BASE_URL = "https://rest.genenames.org";
const DEFAULT_HGNC_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_HGNC_REQUEST_RETRIES = 2;

type HgncApiDoc = {
  symbol?: unknown;
  hgnc_id?: unknown;
  name?: unknown;
  status?: unknown;
  alias_symbol?: unknown;
  prev_symbol?: unknown;
  ensembl_gene_id?: unknown;
  entrez_id?: unknown;
};

type HgncApiResponse = {
  response?: {
    numFound?: unknown;
    docs?: unknown;
  };
};

function readConfig(options: HgncClientOptions = {}) {
  return {
    baseUrl: (
      options.baseUrl ??
      process.env.HGNC_API_BASE_URL ??
      DEFAULT_HGNC_API_BASE_URL
    ).replace(/\/+$/, ""),
    timeoutMs:
      options.timeoutMs ??
      Number.parseInt(
        process.env.HGNC_REQUEST_TIMEOUT_MS ?? `${DEFAULT_HGNC_REQUEST_TIMEOUT_MS}`,
        10,
      ),
    retries:
      options.retries ??
      Number.parseInt(process.env.HGNC_REQUEST_RETRIES ?? `${DEFAULT_HGNC_REQUEST_RETRIES}`, 10),
    fetchFn: options.fetchFn ?? fetch,
  };
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(asString).filter((entry): entry is string => Boolean(entry));
  }
  const single = asString(value);
  return single ? [single] : [];
}

export function parseHgncRecord(doc: HgncApiDoc): HgncRecord | null {
  const symbol = asString(doc.symbol);
  const hgncId = asString(doc.hgnc_id);
  if (!symbol || !hgncId) return null;

  return {
    symbol: symbol.toUpperCase(),
    hgncId,
    name: asString(doc.name),
    status: asString(doc.status),
    aliases: asStringArray(doc.alias_symbol).map((alias) => alias.toUpperCase()),
    previousSymbols: asStringArray(doc.prev_symbol).map((symbol) => symbol.toUpperCase()),
    ensemblId: asString(doc.ensembl_gene_id),
    entrezId: asString(doc.entrez_id),
  };
}

function parseHgncResponse(json: HgncApiResponse): HgncRecord[] {
  const docs = json.response?.docs;
  if (!Array.isArray(docs)) {
    throw new HgncClientError("HGNC response did not contain a document list.", "HGNC_MALFORMED");
  }
  return docs
    .map((doc) => parseHgncRecord(doc as HgncApiDoc))
    .filter((record): record is HgncRecord => Boolean(record));
}

async function requestHgnc(path: string, options: HgncClientOptions = {}): Promise<HgncRecord[]> {
  const config = readConfig(options);
  const attempts = Math.max(0, config.retries) + 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1, config.timeoutMs));

    try {
      const response = await config.fetchFn(`${config.baseUrl}${path}`, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new HgncClientError(`HGNC returned HTTP ${response.status}.`, "HGNC_HTTP_ERROR");
      }

      const json = (await response.json()) as HgncApiResponse;
      return parseHgncResponse(json);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError instanceof HgncClientError) throw lastError;
  throw new HgncClientError("HGNC validation request failed.", "HGNC_UNAVAILABLE");
}

export async function fetchHgncBySymbol(
  symbol: string,
  options: HgncClientOptions = {},
): Promise<HgncRecord | null> {
  const normalized = normalizeGeneSymbol(symbol);
  if (!normalized) return null;
  const records = await requestHgnc(`/fetch/symbol/${encodeURIComponent(normalized)}`, options);
  return records.find((record) => record.symbol === normalized) ?? records[0] ?? null;
}

export async function searchHgncByAlias(
  symbol: string,
  options: HgncClientOptions = {},
): Promise<HgncRecord[]> {
  const normalized = normalizeGeneSymbol(symbol);
  if (!normalized) return [];
  return requestHgnc(`/search/alias_symbol/${encodeURIComponent(normalized)}`, options);
}

export async function searchHgncByPreviousSymbol(
  symbol: string,
  options: HgncClientOptions = {},
): Promise<HgncRecord[]> {
  const normalized = normalizeGeneSymbol(symbol);
  if (!normalized) return [];
  return requestHgnc(`/search/prev_symbol/${encodeURIComponent(normalized)}`, options);
}

function resultFromRecord(
  input: string,
  normalizedInput: string,
  record: HgncRecord,
  status: GeneValidationResult["status"],
  matchedField: GeneValidationResult["matchedField"],
): GeneValidationResult {
  const warnings =
    status === "ALIAS_RESOLVED"
      ? ["Input symbol was resolved from an alias; review canonical symbol."]
      : status === "PREVIOUS_SYMBOL_RESOLVED"
        ? [`Input symbol was a previous HGNC symbol; canonical symbol is now ${record.symbol}.`]
        : [];

  return {
    input,
    normalizedInput,
    status,
    canonicalSymbol: record.symbol,
    matchedField,
    hgncId: record.hgncId,
    name: record.name,
    entrezId: record.entrezId,
    ncbiGeneId: record.entrezId,
    ensemblId: record.ensemblId,
    aliases: record.aliases,
    previousSymbols: record.previousSymbols,
    links: generateGeneLinkouts({
      symbol: record.symbol,
      hgncId: record.hgncId,
      entrezId: record.entrezId,
      ncbiGeneId: record.entrezId,
      ensemblId: record.ensemblId,
    }),
    warnings,
  };
}

export async function resolveHgncSymbol(
  symbol: string,
  options: HgncClientOptions = {},
): Promise<GeneValidationResult> {
  const normalized = normalizeGeneSymbol(symbol);
  if (!normalized) {
    return {
      input: symbol,
      normalizedInput: null,
      status: "INVALID",
      canonicalSymbol: null,
      matchedField: null,
      hgncId: null,
      name: null,
      entrezId: null,
      ncbiGeneId: null,
      ensemblId: null,
      aliases: [],
      previousSymbols: [],
      links: null,
      warnings: ["Input is not a plausible gene symbol."],
    };
  }

  try {
    const exact = await fetchHgncBySymbol(normalized, options);
    if (exact?.symbol === normalized) {
      return resultFromRecord(symbol, normalized, exact, "VALIDATED", "symbol");
    }

    const previousMatches = await searchHgncByPreviousSymbol(normalized, options);
    const previous = previousMatches.find((record) => record.previousSymbols.includes(normalized));
    if (previous) {
      return resultFromRecord(
        symbol,
        normalized,
        previous,
        "PREVIOUS_SYMBOL_RESOLVED",
        "prev_symbol",
      );
    }

    const aliasMatches = await searchHgncByAlias(normalized, options);
    const alias = aliasMatches.find((record) => record.aliases.includes(normalized));
    if (alias) {
      return resultFromRecord(symbol, normalized, alias, "ALIAS_RESOLVED", "alias_symbol");
    }

    return {
      input: symbol,
      normalizedInput: normalized,
      status: "INVALID",
      canonicalSymbol: null,
      matchedField: null,
      hgncId: null,
      name: null,
      entrezId: null,
      ncbiGeneId: null,
      ensemblId: null,
      aliases: [],
      previousSymbols: [],
      links: null,
      warnings: ["No approved HGNC symbol or alias match found."],
    };
  } catch (error) {
    const unavailableMessage =
      error instanceof HgncClientError && error.code === "HGNC_MALFORMED"
        ? "HGNC validation returned an unexpected response; this symbol was not confirmed."
        : "HGNC validation was unavailable; this symbol was not confirmed.";

    return {
      input: symbol,
      normalizedInput: normalized,
      status: "UNVALIDATED",
      canonicalSymbol: normalized,
      matchedField: null,
      hgncId: null,
      name: null,
      entrezId: null,
      ncbiGeneId: null,
      ensemblId: null,
      aliases: [],
      previousSymbols: [],
      links: generateGeneLinkouts({ symbol: normalized }),
      warnings: [unavailableMessage],
    };
  }
}
