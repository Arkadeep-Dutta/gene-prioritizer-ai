import { NextResponse } from "next/server";

import { errorEnvelope } from "@/lib/api/response";

import { RequestLimitError } from "./request";

export function requestParsingErrorResponse<TData>(
  data: TData,
  error: unknown,
): NextResponse | null {
  if (error instanceof RequestLimitError) {
    return NextResponse.json(errorEnvelope(data, error.code, error.message), {
      status: error.status,
    });
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      errorEnvelope(data, "INVALID_JSON", "Request body must be valid JSON."),
      {
        status: 400,
      },
    );
  }

  return null;
}
