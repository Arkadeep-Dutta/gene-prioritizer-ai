export class LiteratureError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
    public readonly warnings: string[] = [],
  ) {
    super(message);
    this.name = "LiteratureError";
  }
}
