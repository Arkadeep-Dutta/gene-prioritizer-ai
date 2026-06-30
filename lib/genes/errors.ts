export class GeneValidationError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code = "GENE_VALIDATION_ERROR", status = 400) {
    super(message);
    this.name = "GeneValidationError";
    this.code = code;
    this.status = status;
  }
}

export class HgncClientError extends Error {
  readonly code: string;

  constructor(message: string, code = "HGNC_CLIENT_ERROR") {
    super(message);
    this.name = "HgncClientError";
    this.code = code;
  }
}
