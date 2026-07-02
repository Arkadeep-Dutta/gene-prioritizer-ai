export type HpoSynonym = {
  value: string;
  scope?: string;
  source?: string;
};

export type HpoRelationship = {
  parentHpoId: string;
  childHpoId: string;
  relationshipType: string;
};

export type HpoTermInput = {
  hpoId: string;
  label: string;
  definition?: string;
  comment?: string;
  isObsolete: boolean;
  replacedBy?: string;
  altIds: string[];
  synonyms: HpoSynonym[];
  parents: string[];
};

export type ParsedOntology = {
  terms: HpoTermInput[];
  relationships: HpoRelationship[];
  warnings: string[];
};

export type GenePhenotypeAssociationInput = {
  geneSymbol: string;
  hpoId: string;
  hpoLabel?: string;
  geneId?: string;
  diseaseId?: string;
  diseaseName?: string;
  evidenceCode?: string;
  evidenceSource?: string;
  reference?: string;
  frequency?: string;
  onset?: string;
  sex?: string;
  modifier?: string;
  sourceFile: string;
};

export type HpoAssociationParseOptions = {
  limit?: number;
};

export type ParsedGeneAssociations = {
  associations: GenePhenotypeAssociationInput[];
  warnings: string[];
  truncated?: boolean;
};

export type HpoImportInput = {
  ontologyPath: string;
  phenotypeToGenesPath?: string;
  genesToPhenotypePath?: string;
  batchSize?: number;
  associationLimit?: number;
};

export type HpoImportCounts = {
  terms: number;
  synonyms: number;
  relationships: number;
  genes: number;
  associations: number;
  associationsAvailable: number;
  associationsSkipped: number;
  warnings: number;
};

export type HpoSearchResult = {
  hpoId: string;
  label: string;
  definition: string | null;
  synonyms: string[];
  isObsolete: boolean;
  score: number;
};
