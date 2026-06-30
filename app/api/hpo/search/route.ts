import { NextResponse } from "next/server";

import { errorEnvelope, okEnvelope } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { HpoValidationError } from "@/lib/hpo/errors";
import { normalizeSearchLimit, normalizeSearchQuery, searchTerms } from "@/lib/hpo/search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    const query = normalizeSearchQuery(url.searchParams.get("q"));
    const limit = normalizeSearchLimit(url.searchParams.get("limit") ?? undefined);
    const results = await searchTerms(prisma, query, { limit });

    return NextResponse.json(
      okEnvelope({
        query,
        limit,
        results,
      }),
    );
  } catch (error) {
    const message =
      error instanceof HpoValidationError ? error.message : "Unable to search local HPO data.";
    return NextResponse.json(
      errorEnvelope(
        { query: url.searchParams.get("q") ?? "", results: [] },
        error instanceof HpoValidationError ? error.code : "HPO_SEARCH_FAILED",
        message,
      ),
      { status: error instanceof HpoValidationError ? 400 : 500 },
    );
  }
}
