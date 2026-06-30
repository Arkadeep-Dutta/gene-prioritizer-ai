import { afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { validateGeneSymbols } from "@/lib/genes/validate-gene-symbols";
import type { GeneValidationResult, HgncResolver } from "@/lib/genes/types";

const cleanupSymbols = [
  "PHASE4A",
  "PHASE4B",
  "PHASE4C",
  "PHASE4CACHE",
  "PHASE4DUP",
  "OLDALIAS4",
  "OLDPREV4",
];

function result(overrides: Partial<GeneValidationResult>): GeneValidationResult {
  const canonicalSymbol = overrides.canonicalSymbol ?? "PHASE4A";
  return {
    input: overrides.input ?? canonicalSymbol,
    normalizedInput: overrides.normalizedInput ?? canonicalSymbol,
    status: overrides.status ?? "VALIDATED",
    canonicalSymbol,
    matchedField: overrides.matchedField ?? "symbol",
    hgncId: overrides.hgncId ?? `HGNC:${canonicalSymbol}`,
    name: overrides.name ?? `${canonicalSymbol} test gene`,
    entrezId: overrides.entrezId ?? "1234",
    ncbiGeneId: overrides.ncbiGeneId ?? "1234",
    ensemblId: overrides.ensemblId ?? "ENSGPHASE4",
    aliases: overrides.aliases ?? [],
    previousSymbols: overrides.previousSymbols ?? [],
    links: overrides.links ?? null,
    warnings: overrides.warnings ?? [],
  };
}

function resolverFor(validationResult: GeneValidationResult): HgncResolver {
  return { resolveHgncSymbol: vi.fn().mockResolvedValue(validationResult) };
}

afterEach(async () => {
  await prisma.gene.deleteMany({ where: { symbol: { in: cleanupSymbols } } });
  await prisma.dataSourceVersion.deleteMany({ where: { sourceName: "HGNC" } });
});

describe("validateGeneSymbols", () => {
  it("stores approved symbols as validated canonical genes", async () => {
    const validation = await validateGeneSymbols(["PHASE4A"], {
      hgncClient: resolverFor(result({ canonicalSymbol: "PHASE4A" })),
      useCache: false,
    });

    expect(validation.results[0]).toMatchObject({
      status: "VALIDATED",
      canonicalSymbol: "PHASE4A",
    });
    await expect(prisma.gene.findUnique({ where: { symbol: "PHASE4A" } })).resolves.toMatchObject({
      isValidated: true,
      validationStatus: "VALIDATED",
    });
  });

  it("stores alias and previous symbol resolutions in GeneAlias", async () => {
    await validateGeneSymbols(["OLDALIAS4"], {
      hgncClient: resolverFor(
        result({
          input: "OLDALIAS4",
          normalizedInput: "OLDALIAS4",
          status: "ALIAS_RESOLVED",
          canonicalSymbol: "PHASE4B",
          matchedField: "alias_symbol",
          aliases: ["OLDALIAS4"],
        }),
      ),
      useCache: false,
    });
    await validateGeneSymbols(["OLDPREV4"], {
      hgncClient: resolverFor(
        result({
          input: "OLDPREV4",
          normalizedInput: "OLDPREV4",
          status: "PREVIOUS_SYMBOL_RESOLVED",
          canonicalSymbol: "PHASE4C",
          matchedField: "prev_symbol",
          previousSymbols: ["OLDPREV4"],
        }),
      ),
      useCache: false,
    });

    await expect(
      prisma.geneAlias.findFirst({ where: { alias: "OLDALIAS4" } }),
    ).resolves.toMatchObject({ aliasType: "alias" });
    await expect(
      prisma.geneAlias.findFirst({ where: { alias: "OLDPREV4" } }),
    ).resolves.toMatchObject({ aliasType: "previous_symbol" });
  });

  it("does not create validated genes for invalid or unavailable results", async () => {
    const invalid = await validateGeneSymbols(["PHASE4A"], {
      hgncClient: resolverFor(
        result({
          status: "INVALID",
          canonicalSymbol: null,
          hgncId: null,
          name: null,
          matchedField: null,
        }),
      ),
      useCache: false,
    });
    const unavailable = await validateGeneSymbols(["PHASE4B"], {
      hgncClient: resolverFor(
        result({
          status: "UNVALIDATED",
          canonicalSymbol: "PHASE4B",
          hgncId: null,
          name: null,
          matchedField: null,
        }),
      ),
      useCache: false,
    });

    expect(invalid.results[0].status).toBe("INVALID");
    expect(unavailable.results[0].status).toBe("UNVALIDATED");
    await expect(prisma.gene.findUnique({ where: { symbol: "PHASE4A" } })).resolves.toBeNull();
    await expect(prisma.gene.findUnique({ where: { symbol: "PHASE4B" } })).resolves.toBeNull();
  });

  it("does not downgrade an existing validated gene when live HGNC fails", async () => {
    await prisma.gene.create({
      data: { symbol: "PHASE4CACHE", isValidated: true, validationStatus: "VALIDATED" },
    });

    const validation = await validateGeneSymbols(["PHASE4CACHE"], {
      hgncClient: resolverFor(
        result({
          status: "UNVALIDATED",
          canonicalSymbol: "PHASE4CACHE",
          hgncId: null,
          matchedField: null,
        }),
      ),
      useCache: false,
    });

    expect(validation.results[0]).toMatchObject({
      status: "VALIDATED",
      canonicalSymbol: "PHASE4CACHE",
    });
    expect(validation.results[0].warnings.join(" ")).toContain("previously validated");
    await expect(
      prisma.gene.findUnique({ where: { symbol: "PHASE4CACHE" } }),
    ).resolves.toMatchObject({ isValidated: true, validationStatus: "VALIDATED" });
  });

  it("deduplicates inputs before validation calls", async () => {
    const resolver = resolverFor(result({ canonicalSymbol: "PHASE4DUP" }));

    const validation = await validateGeneSymbols(["phase4dup", "PHASE4DUP"], {
      hgncClient: resolver,
      useCache: false,
    });

    expect(validation.results).toHaveLength(1);
    expect(resolver.resolveHgncSymbol).toHaveBeenCalledTimes(1);
  });
});
