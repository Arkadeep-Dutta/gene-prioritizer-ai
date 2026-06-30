import { NextResponse } from "next/server";
import { z } from "zod";

import { errorEnvelope, okEnvelope } from "@/lib/api/response";
import { GeneValidationError } from "@/lib/genes/errors";
import { MAX_GENE_TEXT_LENGTH } from "@/lib/genes/normalize";
import { validateGeneSymbols } from "@/lib/genes/validate-gene-symbols";
import { getSecurityConfig } from "@/lib/security/config";
import { requestParsingErrorResponse } from "@/lib/security/errors";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { readJsonWithLimit } from "@/lib/security/request";

export const dynamic = "force-dynamic";

const geneValidationRequestSchema = z
  .object({
    genes: z.array(z.string().min(1)).max(1_000).optional(),
    genesText: z.string().max(MAX_GENE_TEXT_LENGTH).optional(),
  })
  .refine((value) => Boolean(value.genes?.length) || Boolean(value.genesText?.trim()), {
    message: "Provide genes or genesText.",
  });

export async function POST(request: Request) {
  try {
    const limited = enforceRateLimit(request, "geneValidate");
    if (limited) return limited;

    const body = geneValidationRequestSchema.parse(await readJsonWithLimit(request));
    if ((body.genes?.length ?? 0) > getSecurityConfig().maxCandidateGenes) {
      return NextResponse.json(
        errorEnvelope(
          { results: [], summary: null },
          "GENE_LIMIT_EXCEEDED",
          "Too many candidate genes were submitted.",
        ),
        { status: 400 },
      );
    }
    const input = body.genes ?? body.genesText ?? "";
    const validation = await validateGeneSymbols(input);

    return NextResponse.json(okEnvelope(validation));
  } catch (error) {
    const requestError = requestParsingErrorResponse({ results: [], summary: null }, error);
    if (requestError) return requestError;

    if (error instanceof GeneValidationError) {
      return NextResponse.json(
        errorEnvelope({ results: [], summary: null }, error.code, error.message),
        { status: error.status },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        errorEnvelope(
          { results: [], summary: null },
          "GENE_REQUEST_INVALID",
          "Gene validation request is invalid.",
          error.issues.map((issue) => issue.message),
        ),
        { status: 400 },
      );
    }

    return NextResponse.json(
      errorEnvelope(
        { results: [], summary: null },
        "GENE_VALIDATION_FAILED",
        "Unable to validate gene symbols.",
      ),
      { status: 500 },
    );
  }
}
