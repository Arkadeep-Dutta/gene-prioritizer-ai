import type { PubMedArticle } from "./types";

function normalizeWhitespace(value: string | null | undefined): string | null {
  if (!value) return null;
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function plain(value: string | null | undefined): string {
  return normalizeWhitespace(value) ?? "";
}

function yearFrom(value: string | number | null | undefined): number | null {
  const match = String(value ?? "").match(/\b(18|19|20)\d{2}\b/);
  return match ? Number.parseInt(match[0], 10) : null;
}

function doiFrom(articleIds: unknown): string | null {
  if (!Array.isArray(articleIds)) return null;
  const doi = articleIds.find((id) => {
    const row = id as { idtype?: string; value?: string };
    return row.idtype?.toLowerCase() === "doi" && row.value;
  }) as { value?: string } | undefined;
  return plain(doi?.value) || null;
}

export function parsePubMedSummary(
  raw: unknown,
  fetchedAt = new Date().toISOString(),
): PubMedArticle {
  const record = raw as Record<string, unknown>;
  const pmid = plain(String(record.uid ?? record.pmid ?? ""));
  if (!pmid) throw new Error("PubMed summary is missing a PMID.");
  const authors = Array.isArray(record.authors)
    ? record.authors
        .map((author) => plain((author as { name?: string }).name))
        .filter((author) => author.length > 0)
    : [];

  return {
    pmid,
    doi: doiFrom(record.articleids),
    title: plain(String(record.title ?? "Untitled PubMed record")) || "Untitled PubMed record",
    abstract: null,
    journal: plain(String(record.fulljournalname ?? record.source ?? "")) || null,
    publicationYear: yearFrom(
      (record.pubdate as string | undefined) ?? (record.epubdate as string | undefined),
    ),
    authors,
    url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    sourceName: "PubMed",
    fetchedAt,
  };
}

function textBetween(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return normalizeWhitespace(match?.[1]);
}

export function parsePubMedFetchXml(
  xml: string,
  fetchedAt = new Date().toISOString(),
): PubMedArticle[] {
  const articles = xml.match(/<PubmedArticle[\s\S]*?<\/PubmedArticle>/gi) ?? [];
  return articles.map((article) => {
    const pmid = plain(textBetween(article, "PMID"));
    if (!pmid) throw new Error("PubMed XML article is missing a PMID.");
    const authorMatches = article.match(/<Author\b[\s\S]*?<\/Author>/gi) ?? [];
    const authors = authorMatches
      .map((author) =>
        plain(
          [textBetween(author, "ForeName"), textBetween(author, "LastName")]
            .filter(Boolean)
            .join(" "),
        ),
      )
      .filter(Boolean);
    const doiMatch = article.match(
      /<ArticleId[^>]*IdType=["']doi["'][^>]*>([\s\S]*?)<\/ArticleId>/i,
    );

    return {
      pmid,
      doi: plain(doiMatch?.[1]) || null,
      title: plain(textBetween(article, "ArticleTitle")) || "Untitled PubMed record",
      abstract:
        plain(
          (article.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gi) ?? [])
            .map((part) => part.replace(/<\/?AbstractText[^>]*>/gi, " "))
            .join(" "),
        ) || null,
      journal:
        plain(textBetween(article, "Title")) ||
        plain(textBetween(article, "ISOAbbreviation")) ||
        null,
      publicationYear: yearFrom(
        textBetween(article, "Year") ?? textBetween(article, "MedlineDate"),
      ),
      authors,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      sourceName: "PubMed",
      fetchedAt,
    };
  });
}

export function mergeArticleDetails(
  summaries: PubMedArticle[],
  details: PubMedArticle[],
): PubMedArticle[] {
  const detailByPmid = new Map(details.map((detail) => [detail.pmid, detail]));
  return summaries.map((summary) => ({ ...summary, ...detailByPmid.get(summary.pmid) }));
}
