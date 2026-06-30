import { NextResponse } from "next/server";
import { z } from "zod";

import { errorEnvelope, okEnvelope } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { RankingError } from "@/lib/ranking/errors";
import { normalizeRankingInput } from "@/lib/ranking/input";
import { rankGenes } from "@/lib/ranking/rank-genes";

export const dynamic = "force-dynamic";

const emptyRankingData = {
  caseId: undefined,
  inputHash: "",
  algorithmVersion: "",
  rankingMode: "ALL_GENES",
  confirmedHpoTerms: [],
  candidateGenes: [],
  results: [],
  dataVersions: {},
  warnings: [],
  disclaimer:
    "This is not a diagnosis. Results require review by qualified genetics professionals.",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = await normalizeRankingInput(prisma, body);
    const ranking = await rankGenes(prisma, input);

    return NextResponse.json(okEnvelope(ranking, ranking.warnings));
  } catch (error) {
    if (error instanceof RankingError) {
      return NextResponse.json(
        errorEnvelope(emptyRankingData, error.code, error.message, error.warnings),
        { status: error.status },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        errorEnvelope(
          emptyRankingData,
          "PRIORITIZE_REQUEST_INVALID",
          "Prioritization request is invalid.",
          error.issues.map((issue) => issue.message),
        ),
        { status: 400 },
      );
    }

    return NextResponse.json(
      errorEnvelope(
        emptyRankingData,
        "PRIORITIZATION_FAILED",
        "Unable to prioritize genes from the submitted HPO terms.",
      ),
      { status: 500 },
    );
  }
}
