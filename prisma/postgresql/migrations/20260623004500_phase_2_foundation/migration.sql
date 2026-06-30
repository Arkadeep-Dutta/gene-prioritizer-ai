-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "DataSourceVersion" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "url" TEXT,
    "checksum" TEXT,
    "downloadedAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSourceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhenotypeTerm" (
    "id" TEXT NOT NULL,
    "hpoId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "definition" TEXT,
    "comment" TEXT,
    "isObsolete" BOOLEAN NOT NULL DEFAULT false,
    "replacedBy" TEXT,
    "altIds" JSONB,
    "sourceVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhenotypeTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhenotypeSynonym" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "synonym" TEXT NOT NULL,
    "synonymType" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhenotypeSynonym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhenotypeRelationship" (
    "id" TEXT NOT NULL,
    "parentTermId" TEXT NOT NULL,
    "childTermId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL DEFAULT 'is_a',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhenotypeRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gene" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "hgncId" TEXT,
    "entrezId" TEXT,
    "ensemblId" TEXT,
    "ncbiGeneId" TEXT,
    "summary" TEXT,
    "isValidated" BOOLEAN NOT NULL DEFAULT false,
    "validationStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "sourceVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneAlias" (
    "id" TEXT NOT NULL,
    "geneId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "aliasType" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenePhenotypeAssociation" (
    "id" TEXT NOT NULL,
    "geneId" TEXT NOT NULL,
    "phenotypeTermId" TEXT NOT NULL,
    "evidenceCode" TEXT,
    "evidenceSource" TEXT,
    "diseaseId" TEXT,
    "diseaseName" TEXT,
    "frequency" TEXT,
    "onset" TEXT,
    "sex" TEXT,
    "modifier" TEXT,
    "reference" TEXT,
    "sourceVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenePhenotypeAssociation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCase" (
    "id" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "inputType" TEXT NOT NULL,
    "consentToStoreRawText" BOOLEAN NOT NULL DEFAULT false,
    "rawTextRedacted" TEXT,
    "rawTextStored" BOOLEAN NOT NULL DEFAULT false,
    "hpoTermsJson" JSONB NOT NULL,
    "candidateGenesJson" JSONB,
    "metadataJson" JSONB,
    "privacyMode" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneRankingResult" (
    "id" TEXT NOT NULL,
    "userCaseId" TEXT NOT NULL,
    "geneId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "scoreBreakdown" JSONB NOT NULL,
    "matchedPhenotypes" JSONB NOT NULL,
    "evidenceJson" JSONB,
    "warningsJson" JSONB,
    "rankingMode" TEXT NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneRankingResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteratureRecord" (
    "id" TEXT NOT NULL,
    "pmid" TEXT,
    "doi" TEXT,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "journal" TEXT,
    "publicationYear" INTEGER,
    "authorsJson" JSONB,
    "url" TEXT,
    "sourceName" TEXT NOT NULL DEFAULT 'PubMed',
    "fetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiteratureRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteratureEvidence" (
    "id" TEXT NOT NULL,
    "literatureRecordId" TEXT NOT NULL,
    "geneId" TEXT,
    "phenotypeTermId" TEXT,
    "rankingResultId" TEXT,
    "evidenceType" TEXT,
    "summary" TEXT,
    "quote" TEXT,
    "sourceQuery" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiteratureEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorType" TEXT,
    "actorHash" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitEvent" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicensedGeneCardsImport" (
    "id" TEXT NOT NULL,
    "uploadedByHash" TEXT,
    "originalFilename" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "licenseConfirmed" BOOLEAN NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowCount" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicensedGeneCardsImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicensedGeneCardsGeneAnnotation" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "geneId" TEXT,
    "symbol" TEXT NOT NULL,
    "fieldsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicensedGeneCardsGeneAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataSourceVersion_sourceName_idx" ON "DataSourceVersion"("sourceName");

-- CreateIndex
CREATE INDEX "DataSourceVersion_sourceType_idx" ON "DataSourceVersion"("sourceType");

-- CreateIndex
CREATE INDEX "DataSourceVersion_importedAt_idx" ON "DataSourceVersion"("importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DataSourceVersion_sourceName_version_key" ON "DataSourceVersion"("sourceName", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PhenotypeTerm_hpoId_key" ON "PhenotypeTerm"("hpoId");

-- CreateIndex
CREATE INDEX "PhenotypeTerm_label_idx" ON "PhenotypeTerm"("label");

-- CreateIndex
CREATE INDEX "PhenotypeTerm_isObsolete_idx" ON "PhenotypeTerm"("isObsolete");

-- CreateIndex
CREATE INDEX "PhenotypeTerm_sourceVersionId_idx" ON "PhenotypeTerm"("sourceVersionId");

-- CreateIndex
CREATE INDEX "PhenotypeSynonym_synonym_idx" ON "PhenotypeSynonym"("synonym");

-- CreateIndex
CREATE INDEX "PhenotypeSynonym_termId_idx" ON "PhenotypeSynonym"("termId");

-- CreateIndex
CREATE UNIQUE INDEX "PhenotypeSynonym_termId_synonym_key" ON "PhenotypeSynonym"("termId", "synonym");

-- CreateIndex
CREATE INDEX "PhenotypeRelationship_parentTermId_idx" ON "PhenotypeRelationship"("parentTermId");

-- CreateIndex
CREATE INDEX "PhenotypeRelationship_childTermId_idx" ON "PhenotypeRelationship"("childTermId");

-- CreateIndex
CREATE UNIQUE INDEX "PhenotypeRelationship_parentTermId_childTermId_relationship_key" ON "PhenotypeRelationship"("parentTermId", "childTermId", "relationshipType");

-- CreateIndex
CREATE UNIQUE INDEX "Gene_symbol_key" ON "Gene"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "Gene_hgncId_key" ON "Gene"("hgncId");

-- CreateIndex
CREATE INDEX "Gene_entrezId_idx" ON "Gene"("entrezId");

-- CreateIndex
CREATE INDEX "Gene_ensemblId_idx" ON "Gene"("ensemblId");

-- CreateIndex
CREATE INDEX "Gene_validationStatus_idx" ON "Gene"("validationStatus");

-- CreateIndex
CREATE INDEX "Gene_sourceVersionId_idx" ON "Gene"("sourceVersionId");

-- CreateIndex
CREATE INDEX "GeneAlias_alias_idx" ON "GeneAlias"("alias");

-- CreateIndex
CREATE INDEX "GeneAlias_geneId_idx" ON "GeneAlias"("geneId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneAlias_geneId_alias_key" ON "GeneAlias"("geneId", "alias");

-- CreateIndex
CREATE INDEX "GenePhenotypeAssociation_geneId_idx" ON "GenePhenotypeAssociation"("geneId");

-- CreateIndex
CREATE INDEX "GenePhenotypeAssociation_phenotypeTermId_idx" ON "GenePhenotypeAssociation"("phenotypeTermId");

-- CreateIndex
CREATE INDEX "GenePhenotypeAssociation_diseaseId_idx" ON "GenePhenotypeAssociation"("diseaseId");

-- CreateIndex
CREATE INDEX "GenePhenotypeAssociation_evidenceSource_idx" ON "GenePhenotypeAssociation"("evidenceSource");

-- CreateIndex
CREATE INDEX "GenePhenotypeAssociation_sourceVersionId_idx" ON "GenePhenotypeAssociation"("sourceVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "GenePhenotypeAssociation_geneId_phenotypeTermId_diseaseId_e_key" ON "GenePhenotypeAssociation"("geneId", "phenotypeTermId", "diseaseId", "evidenceSource");

-- CreateIndex
CREATE UNIQUE INDEX "UserCase_inputHash_key" ON "UserCase"("inputHash");

-- CreateIndex
CREATE INDEX "UserCase_inputType_idx" ON "UserCase"("inputType");

-- CreateIndex
CREATE INDEX "UserCase_createdAt_idx" ON "UserCase"("createdAt");

-- CreateIndex
CREATE INDEX "GeneRankingResult_userCaseId_idx" ON "GeneRankingResult"("userCaseId");

-- CreateIndex
CREATE INDEX "GeneRankingResult_geneId_idx" ON "GeneRankingResult"("geneId");

-- CreateIndex
CREATE INDEX "GeneRankingResult_rank_idx" ON "GeneRankingResult"("rank");

-- CreateIndex
CREATE INDEX "GeneRankingResult_score_idx" ON "GeneRankingResult"("score");

-- CreateIndex
CREATE INDEX "GeneRankingResult_algorithmVersion_idx" ON "GeneRankingResult"("algorithmVersion");

-- CreateIndex
CREATE UNIQUE INDEX "GeneRankingResult_userCaseId_geneId_algorithmVersion_key" ON "GeneRankingResult"("userCaseId", "geneId", "algorithmVersion");

-- CreateIndex
CREATE UNIQUE INDEX "LiteratureRecord_pmid_key" ON "LiteratureRecord"("pmid");

-- CreateIndex
CREATE INDEX "LiteratureRecord_doi_idx" ON "LiteratureRecord"("doi");

-- CreateIndex
CREATE INDEX "LiteratureRecord_publicationYear_idx" ON "LiteratureRecord"("publicationYear");

-- CreateIndex
CREATE INDEX "LiteratureRecord_title_idx" ON "LiteratureRecord"("title");

-- CreateIndex
CREATE INDEX "LiteratureEvidence_literatureRecordId_idx" ON "LiteratureEvidence"("literatureRecordId");

-- CreateIndex
CREATE INDEX "LiteratureEvidence_geneId_idx" ON "LiteratureEvidence"("geneId");

-- CreateIndex
CREATE INDEX "LiteratureEvidence_phenotypeTermId_idx" ON "LiteratureEvidence"("phenotypeTermId");

-- CreateIndex
CREATE INDEX "LiteratureEvidence_rankingResultId_idx" ON "LiteratureEvidence"("rankingResultId");

-- CreateIndex
CREATE INDEX "AuditEvent_eventType_idx" ON "AuditEvent"("eventType");

-- CreateIndex
CREATE INDEX "AuditEvent_actorType_idx" ON "AuditEvent"("actorType");

-- CreateIndex
CREATE INDEX "AuditEvent_requestId_idx" ON "AuditEvent"("requestId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "RateLimitEvent_keyHash_idx" ON "RateLimitEvent"("keyHash");

-- CreateIndex
CREATE INDEX "RateLimitEvent_endpoint_idx" ON "RateLimitEvent"("endpoint");

-- CreateIndex
CREATE INDEX "RateLimitEvent_windowStart_idx" ON "RateLimitEvent"("windowStart");

-- CreateIndex
CREATE INDEX "RateLimitEvent_windowEnd_idx" ON "RateLimitEvent"("windowEnd");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitEvent_keyHash_endpoint_windowStart_key" ON "RateLimitEvent"("keyHash", "endpoint", "windowStart");

-- CreateIndex
CREATE INDEX "LicensedGeneCardsImport_fileHash_idx" ON "LicensedGeneCardsImport"("fileHash");

-- CreateIndex
CREATE INDEX "LicensedGeneCardsImport_importedAt_idx" ON "LicensedGeneCardsImport"("importedAt");

-- CreateIndex
CREATE INDEX "LicensedGeneCardsGeneAnnotation_importId_idx" ON "LicensedGeneCardsGeneAnnotation"("importId");

-- CreateIndex
CREATE INDEX "LicensedGeneCardsGeneAnnotation_geneId_idx" ON "LicensedGeneCardsGeneAnnotation"("geneId");

-- CreateIndex
CREATE INDEX "LicensedGeneCardsGeneAnnotation_symbol_idx" ON "LicensedGeneCardsGeneAnnotation"("symbol");

-- AddForeignKey
ALTER TABLE "PhenotypeTerm" ADD CONSTRAINT "PhenotypeTerm_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "DataSourceVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhenotypeSynonym" ADD CONSTRAINT "PhenotypeSynonym_termId_fkey" FOREIGN KEY ("termId") REFERENCES "PhenotypeTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhenotypeRelationship" ADD CONSTRAINT "PhenotypeRelationship_parentTermId_fkey" FOREIGN KEY ("parentTermId") REFERENCES "PhenotypeTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhenotypeRelationship" ADD CONSTRAINT "PhenotypeRelationship_childTermId_fkey" FOREIGN KEY ("childTermId") REFERENCES "PhenotypeTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gene" ADD CONSTRAINT "Gene_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "DataSourceVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneAlias" ADD CONSTRAINT "GeneAlias_geneId_fkey" FOREIGN KEY ("geneId") REFERENCES "Gene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenePhenotypeAssociation" ADD CONSTRAINT "GenePhenotypeAssociation_geneId_fkey" FOREIGN KEY ("geneId") REFERENCES "Gene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenePhenotypeAssociation" ADD CONSTRAINT "GenePhenotypeAssociation_phenotypeTermId_fkey" FOREIGN KEY ("phenotypeTermId") REFERENCES "PhenotypeTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenePhenotypeAssociation" ADD CONSTRAINT "GenePhenotypeAssociation_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "DataSourceVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneRankingResult" ADD CONSTRAINT "GeneRankingResult_userCaseId_fkey" FOREIGN KEY ("userCaseId") REFERENCES "UserCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneRankingResult" ADD CONSTRAINT "GeneRankingResult_geneId_fkey" FOREIGN KEY ("geneId") REFERENCES "Gene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteratureEvidence" ADD CONSTRAINT "LiteratureEvidence_literatureRecordId_fkey" FOREIGN KEY ("literatureRecordId") REFERENCES "LiteratureRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteratureEvidence" ADD CONSTRAINT "LiteratureEvidence_geneId_fkey" FOREIGN KEY ("geneId") REFERENCES "Gene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteratureEvidence" ADD CONSTRAINT "LiteratureEvidence_phenotypeTermId_fkey" FOREIGN KEY ("phenotypeTermId") REFERENCES "PhenotypeTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteratureEvidence" ADD CONSTRAINT "LiteratureEvidence_rankingResultId_fkey" FOREIGN KEY ("rankingResultId") REFERENCES "GeneRankingResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicensedGeneCardsGeneAnnotation" ADD CONSTRAINT "LicensedGeneCardsGeneAnnotation_importId_fkey" FOREIGN KEY ("importId") REFERENCES "LicensedGeneCardsImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicensedGeneCardsGeneAnnotation" ADD CONSTRAINT "LicensedGeneCardsGeneAnnotation_geneId_fkey" FOREIGN KEY ("geneId") REFERENCES "Gene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

