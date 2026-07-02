export type ApiEnvelope<TData> = {
  ok: boolean;
  data: TData;
  warnings: string[];
  meta: {
    requestId: string;
    timestamp: string;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export function createRequestMeta() {
  return {
    requestId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
}

export function okEnvelope<TData>(data: TData, warnings: string[] = []): ApiEnvelope<TData> {
  return { ok: true, data, warnings, meta: createRequestMeta() };
}

export function errorEnvelope<TData>(
  data: TData,
  code: string,
  message: string,
  warnings: string[] = [],
  details?: Record<string, unknown>,
): ApiEnvelope<TData> {
  return {
    ok: false,
    data,
    warnings,
    meta: createRequestMeta(),
    error: details ? { code, message, details } : { code, message },
  };
}
