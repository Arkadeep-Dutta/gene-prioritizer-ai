import { NextResponse } from "next/server";
import { z } from "zod";

import { errorEnvelope, okEnvelope } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { PhenotypeExtractionError } from "@/lib/phenotype/errors";
import { extractPhenotypes, PHENOTYPE_EXTRACTION_DISCLAIMER } from "@/lib/phenotype/extract";

export const dynamic = "force-dynamic";

const emptyExtractionData = {
  extractionId: null,
  method: "deterministic",
  requiresConfirmation: true,
  terms: [],
  negatedTerms: [],
  uncertainTerms: [],
  familyHistoryTerms: [],
  unmappedTerms: [],
  metadata: {
    ageOfOnset: null,
    sex: null,
    inheritancePattern: null,
    warnings: [],
  },
  confirmedHpoTermsForRanking: [],
  warnings: [],
  disclaimer: PHENOTYPE_EXTRACTION_DISCLAIMER,
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const extraction = await extractPhenotypes(prisma, body);
    return NextResponse.json(okEnvelope(extraction, extraction.warnings));
  } catch (error) {
    if (error instanceof PhenotypeExtractionError) {
      return NextResponse.json(
        errorEnvelope(emptyExtractionData, error.code, error.message, error.warnings),
        { status: error.status },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        errorEnvelope(
          emptyExtractionData,
          "PHENOTYPE_EXTRACT_REQUEST_INVALID",
          "Phenotype extraction request is invalid.",
          error.issues.map((issue) => issue.message),
        ),
        { status: 400 },
      );
    }

    return NextResponse.json(
      errorEnvelope(
        emptyExtractionData,
        "PHENOTYPE_EXTRACTION_FAILED",
        "Unable to extract HPO terms from the submitted text.",
      ),
      { status: 500 },
    );
  }
}
