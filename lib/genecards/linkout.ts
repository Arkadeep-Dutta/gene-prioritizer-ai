import { normalizeGeneSymbol } from "@/lib/genes/normalize";

import { getGeneCardsImportConfig } from "./config";

export function createGeneCardsLinkout(
  symbol: string,
  environment: NodeJS.ProcessEnv = process.env,
): string | null {
  if (!getGeneCardsImportConfig(environment).linkoutEnabled) return null;
  const normalized = normalizeGeneSymbol(symbol);
  if (!normalized) return null;
  return `https://www.genecards.org/cgi-bin/carddisp.pl?gene=${encodeURIComponent(normalized)}`;
}
