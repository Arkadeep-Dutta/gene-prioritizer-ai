import { NextResponse } from "next/server";

import { errorEnvelope, okEnvelope } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { HpoValidationError } from "@/lib/hpo/errors";
import { getTermWithRelationships } from "@/lib/hpo/repository";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params;
  const decodedId = decodeURIComponent(params.id);

  try {
    const term = await getTermWithRelationships(prisma, decodedId);
    if (!term) {
      return NextResponse.json(
        errorEnvelope(
          { hpoId: decodedId, term: null },
          "HPO_TERM_NOT_FOUND",
          "The requested HPO term was not found in the local database.",
        ),
        { status: 404 },
      );
    }

    return NextResponse.json(
      okEnvelope({
        hpoId: term.hpoId,
        label: term.label,
        definition: term.definition,
        comment: term.comment,
        synonyms: term.synonyms.map((synonym) => synonym.synonym),
        parents: term.childRelations.map((relation) => relation.parentTerm),
        children: term.parentRelations.map((relation) => relation.childTerm),
        isObsolete: term.isObsolete,
        replacedBy: term.replacedBy,
        associatedGenesCount: term._count.geneAssociations,
        associatedGenes: term.geneAssociations.map((association) => ({
          symbol: association.gene.symbol,
          name: association.gene.name,
          validationStatus: association.gene.validationStatus,
          diseaseId: association.diseaseId,
          diseaseName: association.diseaseName,
          evidenceSource: association.evidenceSource,
        })),
      }),
    );
  } catch (error) {
    const message =
      error instanceof HpoValidationError ? error.message : "Unable to retrieve HPO term details.";
    return NextResponse.json(
      errorEnvelope(
        { hpoId: decodedId, term: null },
        error instanceof HpoValidationError ? error.code : "HPO_TERM_LOOKUP_FAILED",
        message,
      ),
      { status: error instanceof HpoValidationError ? 400 : 500 },
    );
  }
}
