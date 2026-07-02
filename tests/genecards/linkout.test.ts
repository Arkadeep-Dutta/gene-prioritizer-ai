import { describe, expect, it, vi } from "vitest";

import { createGeneCardsLinkout } from "@/lib/genecards/linkout";

describe("GeneCards linkout helper", () => {
  it("generates a safe linkout without network calls", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const url = createGeneCardsLinkout("SCN2A", {
      GENE_CARDS_LINKOUT_ENABLED: "true",
    } as unknown as NodeJS.ProcessEnv);

    expect(url).toBe("https://www.genecards.org/cgi-bin/carddisp.pl?gene=SCN2A");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("omits unsafe or disabled linkouts", () => {
    expect(createGeneCardsLinkout("<script>", {} as NodeJS.ProcessEnv)).toBeNull();
    expect(
      createGeneCardsLinkout("SCN2A", {
        GENE_CARDS_LINKOUT_ENABLED: "false",
      } as unknown as NodeJS.ProcessEnv),
    ).toBeNull();
  });
});
