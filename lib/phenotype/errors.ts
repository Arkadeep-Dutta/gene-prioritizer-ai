export class PhenotypeExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 400,
    public readonly warnings: string[] = [],
  ) {
    super(message);
    this.name = "PhenotypeExtractionError";
  }
}
