import { NextResponse } from "next/server";

import { okEnvelope } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { getBuildInfo } from "@/lib/deployment/build-info";
import { HGNC_SOURCE_NAME } from "@/lib/genes/repository";
import { HPO_SOURCE_NAMES } from "@/lib/hpo/constants";
import { getDataSourceVersions } from "@/lib/hpo/repository";
import { getLiteratureConfig, getNcbiConfig } from "@/lib/literature/config";
import { getPhenotypeExtractionConfig } from "@/lib/phenotype/config";
import { getRankingConfig } from "@/lib/ranking/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const versions = await getDataSourceVersions(prisma);
  const hpoOntology = versions.find((version) => version.sourceName === HPO_SOURCE_NAMES.ontology);
  const hpoGeneAssociations = versions.find(
    (version) => version.sourceName === HPO_SOURCE_NAMES.geneAssociations,
  );
  const hgnc = versions.find((version) => version.sourceName === HGNC_SOURCE_NAME);
  const syntheticFixture = versions.find((version) => version.sourceName === "SyntheticFixture");
  const rankingConfig = getRankingConfig();
  const phenotypeConfig = getPhenotypeExtractionConfig();
  const literatureConfig = getLiteratureConfig();
  const ncbiConfig = getNcbiConfig();
  const literatureRecordCount = await prisma.literatureRecord.count();

  return NextResponse.json(
    okEnvelope({
      build: getBuildInfo(),
      phenotypeExtraction: {
        deterministicMatcher: true,
        requiresConfirmation: phenotypeConfig.requireConfirmation,
        externalLlmAllowed: phenotypeConfig.allowExternalLlm,
      },
      ranking: {
        algorithmVersion: rankingConfig.algorithmVersion,
        literatureBoostImplemented: true,
      },
      literature: {
        sourceName: "NCBI PubMed E-utilities",
        mode: "live_query_with_local_metadata_cache",
        enabled: literatureConfig.enabled,
        ncbiBaseUrlConfigured: Boolean(ncbiConfig.baseUrl),
        ncbiApiKeyPresent: Boolean(ncbiConfig.apiKey),
        ncbiEmailPresent: Boolean(ncbiConfig.email),
        cachedRecordCount: literatureRecordCount,
        htmlScraping: false,
        pdfDownload: false,
      },
      imported: {
        hpoOntology: Boolean(hpoOntology),
        hpoGeneAssociations: Boolean(hpoGeneAssociations),
        hgnc: Boolean(hgnc),
        syntheticFixture: Boolean(syntheticFixture),
      },
      sources: versions.map((version) => ({
        sourceName: version.sourceName,
        sourceType: version.sourceType,
        version: version.version,
        checksum: version.checksum,
        downloadedAt: version.downloadedAt,
        importedAt: version.importedAt,
        metadata: version.metadata,
      })),
    }),
  );
}
