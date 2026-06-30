import type { PrismaClient } from "@prisma/client";

import type { LiteratureConfig } from "./config";
import { getLiteratureConfig, getNcbiConfig } from "./config";
import { getCachedQueryPmids, setCachedQueryPmids } from "./cache";
import { LiteratureError } from "./errors";
import { NcbiClient } from "./ncbi-client";
import { mergeArticleDetails } from "./pubmed-parser";
import { buildPubMedQuery, normalizeLiteratureGeneSymbol } from "./query-builder";
import {
  attachLiteratureEvidence,
  getCachedLiteratureRecords,
  upsertLiteratureRecords,
} from "./repository";
import { summarizeLiteratureRecords } from "./summarize";
import type { LiteratureQuery, LiteratureSearchResult, PubMedArticle } from "./types";

export type LiteratureSearchOptions = {
  client?: Pick<NcbiClient, "searchPubMedIds" | "fetchPubMedSummaries" | "fetchPubMedDetails">;
  config?: LiteratureConfig;
  includeGeneOnlyFallback?: boolean;
  storeEvidence?: boolean;
};

async function resolveHpoTerms(prisma: PrismaClient, hpoIds: string[]) {
  if (hpoIds.length === 0) return [];
  const terms = await prisma.phenotypeTerm.findMany({
    where: { hpoId: { in: hpoIds } },
    select: {
      id: true,
      hpoId: true,
      label: true,
      synonyms: { select: { synonym: true }, take: 5 },
    },
  });
  const byId = new Map(terms.map((term) => [term.hpoId, term]));
  const missing = hpoIds.find((id) => !byId.has(id));
  if (missing) {
    throw new LiteratureError(`HPO term ${missing} was not found.`, "HPO_TERM_NOT_FOUND", 404);
  }
  return hpoIds.map((id) => byId.get(id)!);
}

async function fetchRecords(input: {
  prisma: PrismaClient;
  client: Pick<NcbiClient, "fetchPubMedSummaries" | "fetchPubMedDetails">;
  pmids: string[];
  includeAbstracts: boolean;
  config: LiteratureConfig;
}): Promise<PubMedArticle[]> {
  const cached = await getCachedLiteratureRecords(
    input.prisma,
    input.pmids,
    input.config.cacheTtlSeconds,
  );
  const cachedPmids = new Set(cached.map((record) => record.pmid));
  const missing = input.pmids.filter((pmid) => !cachedPmids.has(pmid));
  let fetched: PubMedArticle[] = [];
  if (missing.length > 0) {
    const summaries = await input.client.fetchPubMedSummaries(missing);
    fetched = input.includeAbstracts
      ? mergeArticleDetails(summaries, await input.client.fetchPubMedDetails(missing))
      : summaries;
    await upsertLiteratureRecords(input.prisma, fetched);
  }
  const byPmid = new Map([...cached, ...fetched].map((record) => [record.pmid, record]));
  return input.pmids
    .map((pmid) => byPmid.get(pmid))
    .filter((record): record is PubMedArticle => Boolean(record));
}

export async function searchLiterature(input: {
  prisma: PrismaClient;
  geneSymbols: string[];
  hpoTerms?: string[];
  retmax?: number;
  includeAbstracts?: boolean;
  summarize?: boolean;
  options?: LiteratureSearchOptions;
}): Promise<LiteratureSearchResult> {
  const config = input.options?.config ?? getLiteratureConfig();
  if (!config.enabled) {
    return { queries: [], records: [], warnings: ["Literature search is disabled."] };
  }
  if (input.geneSymbols.length === 0) {
    throw new LiteratureError("At least one gene symbol is required.", "GENE_SYMBOL_REQUIRED");
  }
  if (input.geneSymbols.length > 25) {
    throw new LiteratureError(
      "At most 25 genes can be searched at once.",
      "GENE_LIMIT_EXCEEDED",
      413,
    );
  }

  const retmax = Math.min(input.retmax ?? config.defaultRetmax, config.maxRetmax);
  const geneSymbols = Array.from(new Set(input.geneSymbols.map(normalizeLiteratureGeneSymbol)));
  const hpoIds = Array.from(new Set(input.hpoTerms ?? []));
  const hpoTerms = await resolveHpoTerms(input.prisma, hpoIds);
  const client = input.options?.client ?? new NcbiClient(getNcbiConfig());
  const warnings: string[] = [];
  const queries: LiteratureQuery[] = [];
  const allPmids: string[] = [];

  for (const geneSymbol of geneSymbols) {
    const primary = buildPubMedQuery(
      {
        geneSymbol,
        hpoTerms: hpoTerms.map((term) => ({
          hpoId: term.hpoId,
          label: term.label,
          synonyms: term.synonyms.map((synonym) => synonym.synonym),
        })),
      },
      config,
    );
    const queryInputs = [primary];
    if ((input.options?.includeGeneOnlyFallback ?? true) && hpoTerms.length > 0) {
      queryInputs.push(buildPubMedQuery({ geneSymbol, geneOnly: true }, config));
    }

    for (const built of queryInputs) {
      const cachedPmids = getCachedQueryPmids(built.query);
      const pmids = cachedPmids ?? (await client.searchPubMedIds(built.query, retmax));
      if (!cachedPmids) setCachedQueryPmids(built.query, pmids, config.cacheTtlSeconds);
      if (pmids.length === 0) warnings.push(`No PubMed records found for ${geneSymbol}.`);
      queries.push({
        geneSymbol,
        hpoTerms: built.hpoTerms,
        query: built.query,
        queryType: built.queryType,
        pmids,
      });
      allPmids.push(...pmids);
    }
  }

  const uniquePmids = Array.from(new Set(allPmids));
  const records = await fetchRecords({
    prisma: input.prisma,
    client,
    pmids: uniquePmids,
    includeAbstracts: input.includeAbstracts ?? false,
    config,
  });
  const summarized = summarizeLiteratureRecords(records, input.summarize ?? false, config);
  warnings.push(...summarized.warnings);

  if (input.options?.storeEvidence) {
    const genes = await input.prisma.gene.findMany({
      where: { symbol: { in: geneSymbols } },
      select: { id: true, symbol: true },
    });
    const geneBySymbol = new Map(genes.map((gene) => [gene.symbol, gene]));
    for (const query of queries) {
      await attachLiteratureEvidence({
        prisma: input.prisma,
        articles: summarized.articles.filter((article) => query.pmids.includes(article.pmid)),
        geneId: geneBySymbol.get(query.geneSymbol)?.id,
        phenotypeTermIds: hpoTerms
          .filter((term) => query.hpoTerms.includes(term.hpoId))
          .map((term) => term.id),
        evidenceType:
          query.queryType === "gene_phenotype" ? "PUBMED_GENE_PHENOTYPE" : "PUBMED_GENE_ONLY",
        sourceQuery: query.query,
      });
    }
  }

  return { queries, records: summarized.articles, warnings };
}
