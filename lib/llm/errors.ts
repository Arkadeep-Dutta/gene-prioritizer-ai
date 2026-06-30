export class LlmExtractionError extends Error {
  constructor(
    message: string,
    public readonly code = "LLM_EXTRACTION_FAILED",
  ) {
    super(message);
    this.name = "LlmExtractionError";
  }
}
