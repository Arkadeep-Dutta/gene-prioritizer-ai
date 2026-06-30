import { NextResponse } from "next/server";

import { errorEnvelope, okEnvelope } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { generateGeneLinkouts } from "@/lib/genes/linkouts";
import { normalizeGeneSymbol } from "@/lib/genes/normalize";
import { getGeneDetailBySymbolOrAlias } from "@/lib/genes/repository";
import { validateGeneSymbols } from "@/lib/genes/validate-gene-symbols";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ symbol: string }>;
};

function toGeneDetail(gene: NonNullable<Awaited<ReturnType<typeof getGeneDetailBySymbolOrAlias>>>) {
  return {
    symbol: gene.symbol,
    name: gene.name,
    hgncId: gene.hgncId,
    entrezId: gene.entrezId,
    ncbiGeneId: gene.ncbiGeneId,
    ensemblId: gene.ensemblId,
    validationStatus: gene.validationStatus,
    isValidated: gene.isValidated,
    aliases: gene.aliases.map((alias) => ({
      alias: alias.alias,
      aliasType: alias.aliasType,
      source: alias.source,
    })),
    associatedPhenotypes: gene.phenotypeLinks.map((association) => ({
      hpoId: association.phenotypeTerm.hpoId,
      label: association.phenotypeTerm.label,
      isObsolete: association.phenotypeTerm.isObsolete,
      evidenceSource: association.evidenceSource,
      evidenceCode: association.evidenceCode,
      diseaseId: association.diseaseId,
      diseaseName: association.diseaseName,
      links: {
        hpo: `https://hpo.jax.org/browse/term/${encodeURIComponent(
          association.phenotypeTerm.hpoId,
        )}`,
      },
    })),
    links: generateGeneLinkouts({
      symbol: gene.symbol,
      hgncId: gene.hgncId,
      entrezId: gene.entrezId,
      ncbiGeneId: gene.ncbiGeneId,
      ensemblId: gene.ensemblId,
    }),
    warnings: gene.isValidated
      ? []
      : ["This local gene record has not been validated against HGNC."],
  };
}

export async function GET(request: Request, context: RouteContext) {
  const { symbol } = await context.params;
  const decodedSymbol = decodeURIComponent(symbol);
  const normalized = normalizeGeneSymbol(decodedSymbol);

  if (!normalized) {
    return NextResponse.json(
      errorEnvelope(
        { symbol: decodedSymbol, gene: null },
        "GENE_SYMBOL_INVALID",
        "The requested gene symbol is not valid.",
      ),
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const shouldValidate = url.searchParams.get("validate") === "true";

  if (shouldValidate) {
    await validateGeneSymbols([decodedSymbol], { useCache: false });
  }

  const gene = await getGeneDetailBySymbolOrAlias(prisma, normalized);
  if (!gene) {
    return NextResponse.json(
      errorEnvelope(
        { symbol: normalized, gene: null },
        "GENE_NOT_FOUND",
        "The requested gene was not found in the local database.",
      ),
      { status: 404 },
    );
  }

  return NextResponse.json(okEnvelope(toGeneDetail(gene)));
}
