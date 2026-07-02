import type { GeneLinkouts } from "./types";
import { createGeneCardsLinkout } from "@/lib/genecards/linkout";

function encodeSymbol(symbol: string): string {
  return encodeURIComponent(symbol.trim().toUpperCase());
}

export function generateGeneLinkouts(
  input: {
    symbol: string;
    hgncId?: string | null;
    entrezId?: string | null;
    ncbiGeneId?: string | null;
    ensemblId?: string | null;
  },
  environment: NodeJS.ProcessEnv = process.env,
): GeneLinkouts {
  const symbol = encodeSymbol(input.symbol);
  const links: GeneLinkouts = {
    clinVarSearch: `https://www.ncbi.nlm.nih.gov/clinvar/?term=${symbol}%5Bgene%5D`,
    pubMedSearch: `https://pubmed.ncbi.nlm.nih.gov/?term=${symbol}%5BGene%5D`,
  };

  if (input.hgncId) {
    links.hgnc = `https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/${encodeURIComponent(
      input.hgncId,
    )}`;
  }

  const ncbiId = input.ncbiGeneId ?? input.entrezId;
  if (ncbiId) {
    links.ncbiGene = `https://www.ncbi.nlm.nih.gov/gene/${encodeURIComponent(ncbiId)}`;
  }

  if (input.ensemblId) {
    links.ensembl = `https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${encodeURIComponent(
      input.ensemblId,
    )}`;
  }

  const geneCards = createGeneCardsLinkout(symbol, environment);
  if (geneCards) {
    links.geneCards = geneCards;
  }

  return links;
}
