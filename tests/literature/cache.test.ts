import { describe, expect, it } from "vitest";

import {
  clearLiteratureQueryCache,
  getCachedQueryPmids,
  setCachedQueryPmids,
} from "@/lib/literature/cache";

describe("literature query cache", () => {
  it("stores and clears cached query PMIDs", () => {
    clearLiteratureQueryCache();
    setCachedQueryPmids("query", ["123"], 60);

    expect(getCachedQueryPmids("query")).toEqual(["123"]);
    clearLiteratureQueryCache();
    expect(getCachedQueryPmids("query")).toBeNull();
  });

  it("expires cached query PMIDs", () => {
    clearLiteratureQueryCache();
    setCachedQueryPmids("expired", ["123"], -1);

    expect(getCachedQueryPmids("expired")).toBeNull();
  });
});
