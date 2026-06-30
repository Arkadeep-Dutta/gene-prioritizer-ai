import { NextResponse } from "next/server";

import { errorEnvelope, okEnvelope } from "@/lib/api/response";
import { isDatabaseConfigured } from "@/lib/db/env";
import { prisma } from "@/lib/db/prisma";
import { HGNC_SOURCE_NAME } from "@/lib/genes/repository";
import { HPO_SOURCE_NAMES } from "@/lib/hpo/constants";
import { getLiteratureConfig, getNcbiConfig } from "@/lib/literature/config";
import { getPhenotypeExtractionConfig } from "@/lib/phenotype/config";
import { getRankingConfig } from "@/lib/ranking/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = isDatabaseConfigured();
  const rankingConfig = getRankingConfig();
  const phenotypeConfig = getPhenotypeExtractionConfig();
  const literatureConfig = getLiteratureConfig();
  const ncbiConfig = getNcbiConfig();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const sources = await prisma.dataSourceVersion.findMany({
      orderBy: { importedAt: "desc" },
      select: { sourceName: true, version: true, importedAt: true },
      take: 10,
    });
    const [
      hpoTermsCount,
      genesCount,
      validatedGenesCount,
      unvalidatedGenesCount,
      genePhenotypeAssociationsCount,
      rankingResultsCount,
      literatureRecordsCount,
    ] = await Promise.all([
      prisma.phenotypeTerm.count(),
      prisma.gene.count(),
      prisma.gene.count({ where: { isValidated: true } }),
      prisma.gene.count({ where: { isValidated: false } }),
      prisma.genePhenotypeAssociation.count(),
      prisma.geneRankingResult.count(),
      prisma.literatureRecord.count(),
    ]);
    const hpoDataImported = sources.some(
      (source) =>
        source.sourceName === HPO_SOURCE_NAMES.ontology ||
        source.sourceName === HPO_SOURCE_NAMES.geneAssociations,
    );

    return NextResponse.json(
      okEnvelope({
        status: "ok",
        database: { configured, reachable: true },
        data: {
          seeded: sources.length > 0,
          hpoDataImported,
          hgncConfigured: true,
          hgncSourceTracked: sources.some((source) => source.sourceName === HGNC_SOURCE_NAME),
          geneValidationBatchLimit: Number.parseInt(
            process.env.GENE_VALIDATION_BATCH_LIMIT ?? "200",
            10,
          ),
          counts: {
            hpoTerms: hpoTermsCount,
            genes: genesCount,
            validatedGenes: validatedGenesCount,
            unvalidatedGenes: unvalidatedGenesCount,
            genePhenotypeAssociations: genePhenotypeAssociationsCount,
            rankingResults: rankingResultsCount,
            literatureRecords: literatureRecordsCount,
          },
          sources,
        },
        ranking: {
          available: true,
          algorithmVersion: rankingConfig.algorithmVersion,
          defaultLimit: rankingConfig.defaultLimit,
          maxLimit: rankingConfig.maxLimit,
        },
        phenotypeExtraction: {
          available: true,
          deterministicAvailable: true,
          externalLlmAllowed: phenotypeConfig.allowExternalLlm,
          requiresConfirmation: phenotypeConfig.requireConfirmation,
          maxTextChars: phenotypeConfig.textMaxChars,
        },
        literature: {
          enabled: literatureConfig.enabled,
          ncbiBaseUrlConfigured: Boolean(ncbiConfig.baseUrl),
          ncbiApiKeyPresent: Boolean(ncbiConfig.apiKey),
          ncbiEmailPresent: Boolean(ncbiConfig.email),
          defaultRetmax: literatureConfig.defaultRetmax,
          maxRetmax: literatureConfig.maxRetmax,
          rankingBoostMax: literatureConfig.rankingBoostMax,
          recordCount: literatureRecordsCount,
        },
        llm: { configured: false, disabled: true },
      }),
    );
  } catch {
    return NextResponse.json(
      errorEnvelope(
        {
          status: "degraded",
          database: { configured, reachable: false },
          data: {
            seeded: false,
            hpoDataImported: false,
            hgncConfigured: false,
            hgncSourceTracked: false,
            geneValidationBatchLimit: Number.parseInt(
              process.env.GENE_VALIDATION_BATCH_LIMIT ?? "200",
              10,
            ),
            counts: {
              hpoTerms: 0,
              genes: 0,
              validatedGenes: 0,
              unvalidatedGenes: 0,
              genePhenotypeAssociations: 0,
              rankingResults: 0,
              literatureRecords: 0,
            },
            sources: [],
          },
          ranking: {
            available: false,
            algorithmVersion: rankingConfig.algorithmVersion,
            defaultLimit: rankingConfig.defaultLimit,
            maxLimit: rankingConfig.maxLimit,
          },
          phenotypeExtraction: {
            available: false,
            deterministicAvailable: true,
            externalLlmAllowed: phenotypeConfig.allowExternalLlm,
            requiresConfirmation: phenotypeConfig.requireConfirmation,
            maxTextChars: phenotypeConfig.textMaxChars,
          },
          literature: {
            enabled: literatureConfig.enabled,
            ncbiBaseUrlConfigured: Boolean(ncbiConfig.baseUrl),
            ncbiApiKeyPresent: Boolean(ncbiConfig.apiKey),
            ncbiEmailPresent: Boolean(ncbiConfig.email),
            defaultRetmax: literatureConfig.defaultRetmax,
            maxRetmax: literatureConfig.maxRetmax,
            rankingBoostMax: literatureConfig.rankingBoostMax,
            recordCount: 0,
          },
          llm: { configured: false, disabled: true },
        },
        "DATABASE_UNREACHABLE",
        "Database health check failed.",
      ),
      { status: 503 },
    );
  }
}
