export class GeneCardsImportError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly warnings: string[] = [],
  ) {
    super(message);
  }
}
