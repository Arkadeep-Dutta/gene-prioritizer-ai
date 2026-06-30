import type { PrismaClient } from "@prisma/client";

import { findCachedValidatedGene } from "./repository";

export const DEFAULT_HGNC_CACHE_TTL_SECONDS = 86_400;

export function readHgncCacheTtlSeconds(environment: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number.parseInt(
    environment.HGNC_CACHE_TTL_SECONDS ?? `${DEFAULT_HGNC_CACHE_TTL_SECONDS}`,
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_HGNC_CACHE_TTL_SECONDS;
}

export async function hasUsableGeneCache(
  prisma: PrismaClient,
  normalizedSymbol: string,
): Promise<boolean> {
  return Boolean(await findCachedValidatedGene(prisma, normalizedSymbol));
}
