import { getSecurityConfig } from "./config";

export class RequestLimitError extends Error {
  code = "REQUEST_TOO_LARGE";
  status = 413;

  constructor(message = "Request body is too large.") {
    super(message);
  }
}

export async function readJsonWithLimit<T = unknown>(request: Request): Promise<T> {
  const maxBytes = getSecurityConfig().maxJsonBodyBytes;
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number.parseInt(contentLength, 10) > maxBytes) {
    throw new RequestLimitError();
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new RequestLimitError();
  }
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}
