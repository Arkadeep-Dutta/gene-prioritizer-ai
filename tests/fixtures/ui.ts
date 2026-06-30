import type { GeneValidationResult } from "@/lib/genes/types";
import type { HpoMappedPhenotype } from "@/lib/phenotype/types";
import type { PublicRankedGene, RankingResponseData } from "@/lib/ranking/types";

export const phenotypeTerm: HpoMappedPhenotype = {
  hpoId: "HP:0001250",
  label: "Seizure",
  status: "PRESENT",
  confidence: 0.92,
  sourceText: "seizures",
  mappingMethod: "local_label",
  definition: "A seizure is an intermittent abnormality of nervous system physiology.",
  alternatives: [],
  warnings: [],
};

export const negatedPhenotypeTerm: HpoMappedPhenotype = {
  ...phenotypeTerm,
  hpoId: "HP:0000252",
  label: "Microcephaly",
  status: "NEGATED",
  sourceText: "No microcephaly",
};

export const candidateGene: GeneValidationResult = {
  input: "SCN2A",
  normalizedInput: "SCN2A",
  status: "VALIDATED",
  canonicalSymbol: "SCN2A",
  matchedField: "symbol",
  hgncId: "HGNC:10588",
  name: "sodium voltage-gated channel alpha subunit 2",
  entrezId: "6326",
  ncbiGeneId: "6326",
  ensemblId: "ENSG00000136531",
  aliases: [],
  previousSymbols: [],
  links: {
    hgnc: "https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/HGNC:10588",
    ncbiGene: "https://www.ncbi.nlm.nih.gov/gene/6326",
    clinVarSearch: "https://www.ncbi.nlm.nih.gov/clinvar/?term=SCN2A",
    pubMedSearch: "https://pubmed.ncbi.nlm.nih.gov/?term=SCN2A",
  },
  warnings: [],
};

export const rankedGene: PublicRankedGene = {
  rank: 1,
  gene: {
    symbol: "SCN2A",
    name: "sodium voltage-gated channel alpha subunit 2",
    validationStatus: "VALIDATED",
    hgncId: "HGNC:10588",
    links: candidateGene.links,
  },
  score: 88.5,
  scoreLabel: "Strong",
  scoreBreakdown: {
    exactHpoMatch: 30,
    ancestorHpoMatch: 10,
    specificityWeight: 20,
    evidenceWeight: 15,
    candidateBoost: 8,
    literatureBoost: 5,
    penalties: 0,
  },
  matchedPhenotypes: [
    {
      inputHpoId: "HP:0001250",
      inputLabel: "Seizure",
      matchedHpoId: "HP:0001250",
      matchedLabel: "Seizure",
      matchType: "EXACT",
      matchDepth: 0,
      associationEvidence: {
        evidenceSource: "HPO fixture",
        evidenceCode: "IEA",
        diseaseId: "OMIM:000000",
        diseaseName: "Synthetic fixture condition",
        frequency: null,
        onset: null,
        reference: null,
      },
    },
  ],
  warnings: ["Synthetic test warning"],
  explanation: "SCN2A matched the confirmed HPO term in this synthetic fixture.",
  isCandidateGene: true,
  literatureEvidence: {
    geneSymbol: "SCN2A",
    literatureBoost: 5,
    queries: [
      {
        geneSymbol: "SCN2A",
        hpoTerms: ["HP:0001250"],
        query: '"SCN2A"[Title/Abstract] AND "Seizure"[Title/Abstract]',
        queryType: "gene_phenotype",
        pmids: ["12345678"],
      },
    ],
    records: [
      {
        pmid: "12345678",
        doi: "10.1000/synthetic",
        title: "Synthetic citation fixture for SCN2A",
        abstract: "Synthetic abstract for UI tests.",
        journal: "Fixture Journal",
        publicationYear: 2024,
        authors: ["Tester A", "Tester B"],
        url: "https://pubmed.ncbi.nlm.nih.gov/12345678/",
        sourceName: "PubMed",
        fetchedAt: "2026-06-24T00:00:00.000Z",
      },
    ],
    warnings: [],
  },
};

export const rankingResponse: RankingResponseData = {
  inputHash: "fixture-hash",
  algorithmVersion: "fixture-v1",
  rankingMode: "CANDIDATE_BOOSTED",
  confirmedHpoTerms: [{ hpoId: "HP:0001250", label: "Seizure", isObsolete: false }],
  candidateGenes: [
    {
      input: "SCN2A",
      normalizedInput: "SCN2A",
      symbol: "SCN2A",
      name: "sodium voltage-gated channel alpha subunit 2",
      hgncId: "HGNC:10588",
      entrezId: "6326",
      ncbiGeneId: "6326",
      ensemblId: "ENSG00000136531",
      validationStatus: "VALIDATED",
      isValidated: true,
      links: candidateGene.links,
      warnings: [],
    },
  ],
  results: [rankedGene],
  dataVersions: { SyntheticFixture: { version: "test" } },
  warnings: ["Scores are deterministic prioritization scores, not diagnostic probabilities."],
  disclaimer: "This is not a diagnosis.",
};
