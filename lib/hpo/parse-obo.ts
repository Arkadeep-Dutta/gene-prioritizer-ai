import { readFile } from "node:fs/promises";

import { HpoParseError } from "./errors";
import type { HpoRelationship, HpoSynonym, HpoTermInput, ParsedOntology } from "./types";
import { normalizeHpoId } from "./validate";

type TermAccumulator = {
  id?: string;
  label?: string;
  definition?: string;
  comment?: string;
  isObsolete: boolean;
  replacedBy?: string;
  altIds: string[];
  synonyms: HpoSynonym[];
  parents: string[];
};

function extractQuotedValue(value: string): string | undefined {
  const match = value.match(/"((?:\\"|[^"])*)"/);
  return match?.[1]?.replace(/\\"/g, '"');
}

function createTermAccumulator(): TermAccumulator {
  return { isObsolete: false, altIds: [], synonyms: [], parents: [] };
}

function parseTermBlock(lines: string[], warnings: string[]): HpoTermInput | null {
  const term = createTermAccumulator();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("!")) continue;

    const delimiterIndex = line.indexOf(":");
    if (delimiterIndex === -1) continue;

    const key = line.slice(0, delimiterIndex);
    const value = line.slice(delimiterIndex + 1).trim();

    if (key === "id") term.id = normalizeHpoId(value) ?? undefined;
    if (key === "name") term.label = value;
    if (key === "def") term.definition = extractQuotedValue(value);
    if (key === "comment") term.comment = value;
    if (key === "is_obsolete") term.isObsolete = value === "true";
    if (key === "replaced_by") term.replacedBy = normalizeHpoId(value) ?? undefined;
    if (key === "alt_id") {
      const altId = normalizeHpoId(value);
      if (altId) term.altIds.push(altId);
    }
    if (key === "synonym") {
      const synonym = extractQuotedValue(value);
      if (synonym) {
        const scope = value.replace(/^"((?:\\"|[^"])*)"\s*/, "").split(/\s+/)[0];
        term.synonyms.push({ value: synonym, scope: scope || undefined, source: "hp.obo" });
      }
    }
    if (key === "is_a") {
      const parentHpoId = normalizeHpoId(value.split(/\s|!/)[0] ?? "");
      if (parentHpoId) term.parents.push(parentHpoId);
    }
  }

  if (!term.id) return null;
  if (!term.label) {
    warnings.push(`Skipping HPO term ${term.id} because it has no name.`);
    return null;
  }

  return {
    hpoId: term.id,
    label: term.label,
    definition: term.definition,
    comment: term.comment,
    isObsolete: term.isObsolete,
    replacedBy: term.replacedBy,
    altIds: Array.from(new Set(term.altIds)).sort(),
    synonyms: dedupeSynonyms(term.synonyms),
    parents: Array.from(new Set(term.parents)).sort(),
  };
}

function dedupeSynonyms(synonyms: HpoSynonym[]): HpoSynonym[] {
  const seen = new Set<string>();
  const deduped: HpoSynonym[] = [];
  for (const synonym of synonyms) {
    const key = synonym.value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(synonym);
  }
  return deduped;
}

export function parseOboText(text: string): ParsedOntology {
  if (!text.trim()) throw new HpoParseError("OBO file is empty.");

  const warnings: string[] = [];
  const terms: HpoTermInput[] = [];
  let currentStanza: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (currentStanza === "Term") {
      const parsed = parseTermBlock(currentLines, warnings);
      if (parsed) terms.push(parsed);
    }
    currentStanza = null;
    currentLines = [];
  };

  for (const line of text.split(/\r?\n/)) {
    const stanzaMatch = line.match(/^\[(.+)]$/);
    if (stanzaMatch) {
      flush();
      currentStanza = stanzaMatch[1] ?? null;
      continue;
    }
    if (currentStanza) currentLines.push(line);
  }
  flush();

  if (terms.length === 0)
    throw new HpoParseError("OBO file did not contain any HPO [Term] stanzas.");

  const hpoIds = new Set(terms.map((term) => term.hpoId));
  const relationships: HpoRelationship[] = [];
  for (const term of terms) {
    for (const parentHpoId of term.parents) {
      if (!hpoIds.has(parentHpoId)) {
        warnings.push(
          `Term ${term.hpoId} references missing parent ${parentHpoId}; relationship skipped.`,
        );
        continue;
      }
      relationships.push({
        parentHpoId,
        childHpoId: term.hpoId,
        relationshipType: "is_a",
      });
    }
  }

  return { terms, relationships, warnings };
}

export async function parseOboFile(path: string): Promise<ParsedOntology> {
  return parseOboText(await readFile(path, "utf8"));
}
