import { HpoParseError } from "./errors";
import type { ParsedOntology } from "./types";

export function parseHpJsonText(text: string): ParsedOntology {
  void text;
  throw new HpoParseError(
    "hp.json parsing is intentionally not enabled in Phase 3. Use hp.obo, which is the documented Phase 3 ontology format.",
  );
}
