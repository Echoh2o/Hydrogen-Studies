/**
 * Title-only studies (audit 2026-11-22, reports/audit-2026-11-22/08-…csv):
 * 105 live studies have the abstract "No abstract available" but AI summaries
 * written from the title alone (e.g. 3955 claims "COVID-19 patients"). Their
 * AI fields never render — crawler renderer, Next page data, page meta — and
 * the page shows a neutral note instead. The page stays indexable.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const dialect = new PgDialect();
const state = vi.hoisted(() => ({ row: null as any }));

vi.mock("../db", () => ({
  db: {
    execute: async (query: any) => {
      const { sql: text } = dialect.sqlToQuery(query);
      return { rows: /FROM studies WHERE slug/.test(text.replace(/\s+/g, " ")) && state.row ? [state.row] : [] };
    },
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
  },
  pool: { query: async () => ({ rows: [] }) },
}));
vi.mock("../services/live-blog-index", () => ({
  getLiveBlogPredicate: async () => () => false,
  invalidateLiveBlogIndex: () => {},
}));
vi.mock("../utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { renderStudy } = await import("../middleware/seo-body-renderer");
const { buildStudyMeta } = await import("../services/page-meta");
const {
  NO_ABSTRACT_NOTE,
  isPlaceholder,
  isTitleOnlyStudy,
  studyDescription,
  withoutPlaceholders,
  withoutTitleOnlyAiContent,
} = await import("../../shared/seo-markup");

const AI = {
  tldr: "Hydrogen helped COVID-19 patients breathe.",
  key_finding: "Mice did not develop pain.",
  plain_summary: "Researchers at a Japanese institution studied COVID-19 patients.",
  summary_100_words: "A 100-word AI summary.",
  practical_takeaway: "Drink hydrogen water.",
  how_to_apply: "Apply it daily.",
  plain_language_title: "Hydrogen Water Stops Nerve Pain",
  outcome: "positive",
};

function row(abstract: string | null) {
  return {
    id: 3955, slug: "t-pmid-12345678", title: "Consumption of hydrogen water prevents neuropathic pain in mice",
    authors: "A. Author", journal: "J Neurol Sci", publish_year: 2015, doi: "10.1016/j.jns.2015.08.1290",
    pmid: "12345678", study_type: "Rat", abstract, ...AI,
  };
}

beforeEach(() => {
  state.row = null;
});

describe("isTitleOnlyStudy / withoutTitleOnlyAiContent", () => {
  it("treats 'No abstract available' as a placeholder", () => {
    expect(isPlaceholder("No abstract available")).toBe(true);
    expect(isPlaceholder("No abstract available.")).toBe(true);
  });

  it("strips AI fields only when the abstract is loaded and empty", () => {
    expect(isTitleOnlyStudy({ abstract: "No abstract available" })).toBe(true);
    expect(isTitleOnlyStudy({ abstract: null })).toBe(true);
    expect(isTitleOnlyStudy({ abstractExcerpt: "" })).toBe(true);
    expect(isTitleOnlyStudy({ abstract: "Background: real text." })).toBe(false);
    // Abstract not selected → can't tell → nothing hidden.
    expect(isTitleOnlyStudy({ tldr: "x" })).toBe(false);

    const s = withoutTitleOnlyAiContent({ abstract: null, title: "T", tldr: "x", keyFinding: "y", plainLanguageTitle: "P", doi: "d" });
    expect(s).toMatchObject({ title: "T", tldr: null, keyFinding: null, plainLanguageTitle: null, doi: "d" });
  });

  it("studyDescription falls back to a neutral line, never empty", () => {
    const d = studyDescription({ title: "Some title", abstract: null }, 300);
    expect(d.startsWith(NO_ABSTRACT_NOTE)).toBe(true);
    expect(d).toContain("Some title");
  });
});

describe("crawler renderer", () => {
  it("title-only study: no AI sections, original title, neutral note, citation + source link", async () => {
    state.row = row("No abstract available");
    const html = (await renderStudy("t-pmid-12345678"))!;
    expect(html).toContain(NO_ABSTRACT_NOTE.replace(/'/g, "&#39;"));
    for (const v of Object.values(AI)) expect(html).not.toContain(v);
    expect(html).not.toContain("<h2>TL;DR</h2>");
    expect(html).toContain("<h1>Consumption of hydrogen water prevents neuropathic pain in mice</h1>");
    expect(html).toContain("J Neurol Sci");
    expect(html).toContain("https://pubmed.ncbi.nlm.nih.gov/12345678/");
  });

  it("study with a real abstract still renders its summary", async () => {
    state.row = row("Background: hydrogen water was given to mice with nerve injury.");
    const html = (await renderStudy("t-pmid-12345678"))!;
    expect(html).toContain(AI.tldr);
    expect(html).not.toContain("no-abstract");
  });
});

describe("page meta", () => {
  it("title-only study: no AI title/description, still indexable", () => {
    const camel = {
      id: 3955, slug: "t-pmid-12345678", title: "Consumption of hydrogen water prevents neuropathic pain in mice",
      abstract: "No abstract available", plainLanguageTitle: AI.plain_language_title,
      metaDescription: "AI meta about COVID-19 patients.", summary100Words: AI.summary_100_words,
    };
    const meta = buildStudyMeta(camel);
    expect(meta.title).toContain("Consumption of hydrogen water");
    expect(meta.title).not.toContain("Stops Nerve Pain");
    expect(meta.description).not.toContain("COVID-19");
    expect(meta.description.startsWith("No abstract is available")).toBe(true);
    expect((meta as any).robots).toBeUndefined();
    expect(JSON.stringify(meta.jsonLd)).not.toContain("COVID-19");
  });
});

describe("page data for Next", () => {
  it("withoutPlaceholders + withoutTitleOnlyAiContent leave only non-AI fields", () => {
    const s = withoutTitleOnlyAiContent(withoutPlaceholders({ abstract: "No abstract available", title: "T", tldr: "x", summary100Words: "y" }));
    expect(s.tldr).toBeNull();
    expect(s.summary100Words).toBeNull();
    expect(s.title).toBe("T");
  });
});
