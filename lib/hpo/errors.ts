export class HpoError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "HpoError";
  }
}

export class HpoValidationError extends HpoError {
  constructor(message: string) {
    super(message, "HPO_VALIDATION_ERROR");
    this.name = "HpoValidationError";
  }
}

export class HpoDownloadError extends HpoError {
  constructor(message: string) {
    super(message, "HPO_DOWNLOAD_ERROR");
    this.name = "HpoDownloadError";
  }
}

export class HpoParseError extends HpoError {
  constructor(message: string) {
    super(message, "HPO_PARSE_ERROR");
    this.name = "HpoParseError";
  }
}
