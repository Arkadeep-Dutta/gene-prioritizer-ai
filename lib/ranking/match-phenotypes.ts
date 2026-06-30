import type { PrismaClient } from "@prisma/client";

import type { ConfirmedHpoTerm, GenePhenotypeForRanking, MatchedPhenotype } from "./types";

export type AncestorLookup = Map<string, Map<string, number>>;

export async function getAncestors(
  prisma: PrismaClient,
  hpoId: string,
  maxDepth = 3,
): Promise<Map<string, number>> {
  const ancestors = new Map<string, number>();
  const visited = new Set<string>([hpoId]);
  let frontier = [{ hpoId, depth: 0 }];

  while (frontier.length > 0) {
    const nextFrontier: typeof frontier = [];
    for (const current of frontier) {
      if (current.depth >= maxDepth) continue;
      const relationships = await prisma.phenotypeRelationship.findMany({
        where: { childTerm: { hpoId: current.hpoId } },
        select: { parentTerm: { select: { hpoId: true } } },
      });

      for (const relationship of relationships) {
        const parentHpoId = relationship.parentTerm.hpoId;
        if (visited.has(parentHpoId)) continue;
        const depth = current.depth + 1;
        visited.add(parentHpoId);
        ancestors.set(parentHpoId, depth);
        nextFrontier.push({ hpoId: parentHpoId, depth });
      }
    }
    frontier = nextFrontier;
  }

  return ancestors;
}

export async function buildAncestorLookup(
  prisma: PrismaClient,
  inputTerms: ConfirmedHpoTerm[],
  maxDepth = 3,
): Promise<AncestorLookup> {
  const lookup: AncestorLookup = new Map();
  for (const term of inputTerms) {
    lookup.set(term.hpoId, await getAncestors(prisma, term.hpoId, maxDepth));
  }
  return lookup;
}

export function matchGenePhenotypes(
  inputTerms: ConfirmedHpoTerm[],
  geneAssociations: GenePhenotypeForRanking[],
  ancestorLookup: AncestorLookup = new Map(),
): MatchedPhenotype[] {
  const matches: MatchedPhenotype[] = [];
  const matchedInputs = new Set<string>();

  for (const inputTerm of inputTerms) {
    const exact = geneAssociations.find(
      (association) => association.phenotype.hpoId === inputTerm.hpoId,
    );
    if (exact) {
      matchedInputs.add(inputTerm.hpoId);
      matches.push({
        inputHpoId: inputTerm.hpoId,
        inputLabel: inputTerm.label,
        matchedHpoId: exact.phenotype.hpoId,
        matchedLabel: exact.phenotype.label,
        matchType: "EXACT",
        matchDepth: 0,
        associationEvidence: exact.evidence,
      });
      continue;
    }

    const ancestors = ancestorLookup.get(inputTerm.hpoId) ?? new Map<string, number>();
    const ancestorMatch = geneAssociations
      .map((association) => ({
        association,
        depth: ancestors.get(association.phenotype.hpoId),
      }))
      .filter(
        (entry): entry is { association: GenePhenotypeForRanking; depth: number } =>
          entry.depth !== undefined,
      )
      .sort((left, right) => left.depth - right.depth)[0];

    if (ancestorMatch) {
      matchedInputs.add(inputTerm.hpoId);
      matches.push({
        inputHpoId: inputTerm.hpoId,
        inputLabel: inputTerm.label,
        matchedHpoId: ancestorMatch.association.phenotype.hpoId,
        matchedLabel: ancestorMatch.association.phenotype.label,
        matchType: "ANCESTOR",
        matchDepth: ancestorMatch.depth,
        associationEvidence: ancestorMatch.association.evidence,
      });
    }
  }

  return matches.filter((match, index, allMatches) => {
    const key = `${match.inputHpoId}:${match.matchedHpoId}:${match.matchType}`;
    return (
      allMatches.findIndex(
        (candidate) =>
          `${candidate.inputHpoId}:${candidate.matchedHpoId}:${candidate.matchType}` === key,
      ) === index
    );
  });
}

export function getRelevantHpoIds(
  inputTerms: ConfirmedHpoTerm[],
  ancestorLookup: AncestorLookup,
): string[] {
  const ids = new Set(inputTerms.map((term) => term.hpoId));
  for (const ancestors of ancestorLookup.values()) {
    for (const hpoId of ancestors.keys()) ids.add(hpoId);
  }
  return Array.from(ids);
}
