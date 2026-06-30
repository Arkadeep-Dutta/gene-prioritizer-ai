import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import summaryFixture from "@/tests/fixtures/pubmed/esummary.json";
import { parsePubMedFetchXml, parsePubMedSummary } from "@/lib/literature/pubmed-parser";

const fetchXml = readFileSync(
  resolve(process.cwd(), "tests/fixtures/pubmed/efetch-pubmed.xml"),
  "utf8",
);

describe("PubMed parser", () => {
  it("parses ESummary metadata", () => {
    const article = parsePubMedSummary(
      summaryFixture.result["12345678"],
      "2026-01-01T00:00:00.000Z",
    );

    expect(article).toMatchObject({
      pmid: "12345678",
      doi: "10.1000/example-scn2a",
      title: expect.stringContaining("SCN2A"),
      journal: "Example Journal of Human Genetics",
      publicationYear: 2021,
      authors: ["Nguyen A", "Patel R"],
      sourceName: "PubMed",
    });
    expect(article.url).toBe("https://pubmed.ncbi.nlm.nih.gov/12345678/");
  });

  it("handles missing DOI and missing abstract gracefully", () => {
    const article = parsePubMedSummary(summaryFixture.result["23456789"]);

    expect(article.doi).toBeNull();
    expect(article.abstract).toBeNull();
    expect(article.authors).toEqual(["Smith J"]);
  });

  it("parses EFetch XML abstracts and author names", () => {
    const [article] = parsePubMedFetchXml(fetchXml, "2026-01-01T00:00:00.000Z");

    expect(article.pmid).toBe("12345678");
    expect(article.abstract).toContain("fixture abstract");
    expect(article.authors).toEqual(["Avery Nguyen", "Rina Patel"]);
    expect(article.doi).toBe("10.1000/example-scn2a");
  });

  it("rejects malformed records without a PMID", () => {
    expect(() => parsePubMedSummary({ title: "No PMID" })).toThrow("PMID");
  });

  it("normalizes whitespace and removes unsafe HTML tags", () => {
    const article = parsePubMedSummary({
      uid: "99999999",
      title: "Safe <script>alert(1)</script> title",
      authors: [],
      articleids: [],
    });

    expect(article.title).not.toContain("<script>");
    expect(article.title).not.toContain("</script>");
  });
});
