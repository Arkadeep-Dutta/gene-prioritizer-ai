import { NextResponse } from "next/server";
import { z } from "zod";

import { errorEnvelope, okEnvelope } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { getLiteratureConfig } from "@/lib/literature/config";
import { LiteratureError } from "@/lib/literature/errors";
import { searchLiterature } from "@/lib/literature/search";

export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    geneSymbol: z.string().min(1).optional(),
    geneSymbols: z.array(z.string().min(1)).max(25).optional(),
    hpoTerms: z
      .array(z.string().regex(/^HP:\d{7}$/))
      .max(25)
      .optional(),
    retmax: z.number().int().positive().optional(),
    includeAbstracts: z.boolean().optional(),
    summarize: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Boolean(body.geneSymbol || body.geneSymbols?.length), {
    message: "Provide geneSymbol or geneSymbols.",
  });

const emptyLiteratureData = {
  queries: [],
  records: [],
  warnings: [],
};

export async function POST(request: Request) {
  try {
    const config = getLiteratureConfig();
    const body = requestSchema.parse(await request.json());
    const geneSymbols = body.geneSymbols ?? (body.geneSymbol ? [body.geneSymbol] : []);
    const result = await searchLiterature({
      prisma,
      geneSymbols,
      hpoTerms: body.hpoTerms ?? [],
      retmax: Math.min(body.retmax ?? config.defaultRetmax, config.maxRetmax),
      includeAbstracts: body.includeAbstracts ?? false,
      summarize: body.summarize ?? false,
      options: { config, storeEvidence: true },
    });

    return NextResponse.json(okEnvelope(result, result.warnings));
  } catch (error) {
    if (error instanceof LiteratureError) {
      return NextResponse.json(
        errorEnvelope(emptyLiteratureData, error.code, error.message, error.warnings),
        { status: error.status },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        errorEnvelope(
          emptyLiteratureData,
          "LITERATURE_SEARCH_REQUEST_INVALID",
          "Literature search request is invalid.",
          error.issues.map((issue) => issue.message),
        ),
        { status: 400 },
      );
    }
    return NextResponse.json(
      errorEnvelope(
        emptyLiteratureData,
        "LITERATURE_SEARCH_FAILED",
        "Unable to retrieve PubMed literature evidence.",
      ),
      { status: 502 },
    );
  }
}
