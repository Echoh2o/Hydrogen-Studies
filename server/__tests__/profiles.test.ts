/**
 * PLAN 4.7 — researcher and journal profile pages, built from the studies
 * table: name grouping by normalized key, thresholds, the rendered pages, the
 * page meta (ProfilePage / CollectionPage + BreadcrumbList) and the author
 * links on study pages.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  JOURNAL_MIN_STUDIES,
  RESEARCHER_MIN_STUDIES,
  authorKey,
  authorSlug,
  displayName,
  pubmedAuthorQuery,
  splitAuthors,
} from "../../shared/profiles";

const state = vi.hoisted(() => ({ studies: [] as any[] }));

vi.mock("../db", () => {
  const dialect = new PgDialect();
  return {
    db: {
      execute: async (q: any) => {
        const { sql } = dialect.sqlToQuery(q);
        if (/FROM studies/i.test(sql) && /authors/i.test(sql)) return { rows: state.studies };
        if (/FROM health_conditions/i.test(sql)) return { rows: [{ name: "Sepsis", slug: "sepsis", study_count: 40, description: null }] };
        return { rows: [] };
      },
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    },
    pool: { query: () => new Promise(() => {}) },
  };
});
vi.mock("../utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
const identities = vi.hoisted(() => ({ rows: [] as any[] }));
vi.mock("../services/researcher-identities", () => ({
  getIdentityMap: async () => new Map(identities.rows.map((r: any) => [r.authorKey, r])),
  getIdentity: async (k: string) => identities.rows.find((r: any) => r.authorKey === k) ?? null,
  __resetIdentitiesForTests: () => {},
}));

const profiles = await import("../services/profiles");
const { renderPageBody, __resetConditionHubsForTests } = await import("../middleware/seo-body-renderer");
const { resolvePageMeta, resolveStaticPageMeta, isContentPath } = await import("../services/page-meta");

const study = (id: number, authors: string, journal = "Medical Gas Research", year = 2020, human = false) => ({
  id,
  slug: `study-${id}`,
  title: `Study ${id}`,
  publish_year: year,
  journal,
  study_design: human ? "rct" : "animal",
  study_type: human ? "human" : "rat",
  is_human_trial: human,
  authors,
  health_conditions: human ? ["Sepsis"] : ["Sepsis", "Oxidative Stress"],
});

beforeEach(() => {
  identities.rows = [];
  profiles.__resetProfilesForTests();
  __resetConditionHubsForTests();
  // Xue-jun Sun on 9 studies (two spellings), Ke-liang Xie on 3, one journal with 10.
  state.studies = [
    ...Array.from({ length: 5 }, (_, i) => study(1 + i, "Xue-jun Sun, Ke-liang Xie, Someone Else", "Medical Gas Research", 2015 + i, i === 0)),
    ...Array.from({ length: 4 }, (_, i) => study(10 + i, "Xuejun Sun, Another Person", "Shock", 2021 + i)),
    study(20, "Ke-liang Xie", "Medical Gas Research", 2019),
    ...Array.from({ length: 4 }, (_, i) => study(30 + i, "Lone Author", "Medical Gas Research", 2010 + i)),
  ];
});

describe("name normalization", () => {
  it("groups spellings of one name and slugs them", () => {
    expect(authorKey("Xue-jun Sun")).toBe("xuejun sun");
    expect(authorKey("Xuejun  Sun")).toBe("xuejun sun");
    expect(authorKey("Sergej M Ostojić")).toBe("sergej m ostojic");
    expect(authorSlug(authorKey("Tyler W. Lebaron"))).toBe("tyler-w-lebaron");
  });
  it("splits comma/semicolon lists and drops et al / empties", () => {
    expect(splitAuthors("A. One, B. Two; et al, ,")).toEqual(["A. One", "B. Two"]);
    expect(splitAuthors(null)).toEqual([]);
  });
  it("picks the most common spelling", () => {
    expect(displayName(new Map([["Xuejun Sun", 4], ["Xue-jun Sun", 5]]))).toBe("Xue-jun Sun");
  });
  it("builds PubMed author queries as Last Initials", () => {
    expect(pubmedAuthorQuery("Xue-jun Sun")).toBe("Sun XJ[Author]");
    expect(pubmedAuthorQuery("Tyler W. Lebaron")).toBe("Lebaron TW[Author]");
    expect(pubmedAuthorQuery("Plato")).toBe("Plato[Author]");
  });
});

describe("author index", () => {
  it("lists only authors at or above the threshold, merging spellings", async () => {
    const { list, bySlug } = await profiles.getAuthorIndex();
    expect(RESEARCHER_MIN_STUDIES).toBe(8);
    expect(list.map((p) => p.name)).toEqual(["Xue-jun Sun"]); // 9 studies; Xie has 6, others fewer
    const sun = bySlug.get("xuejun-sun")!;
    expect(sun.studies).toHaveLength(9);
    expect(sun.variants).toEqual(["Xuejun Sun"]);
    expect(sun.humanCount).toBe(1);
    expect([sun.firstYear, sun.lastYear]).toEqual([2015, 2024]);
    expect(sun.journals[0]).toEqual({ name: "Medical Gas Research", count: 5 });
    expect(sun.conditions[0].name).toBe("Sepsis");
  });

  it("journal index applies its own threshold", async () => {
    const { list } = await profiles.getJournalIndex();
    expect(JOURNAL_MIN_STUDIES).toBe(10);
    expect(list.map((j) => [j.name, j.studies.length])).toEqual([["Medical Gas Research", 10]]);
  });

  it("authorLinksFor links only authors with a profile", async () => {
    expect(await profiles.authorLinksFor("Xuejun Sun, Ke-liang Xie")).toEqual([
      { name: "Xuejun Sun", href: "/researchers/xuejun-sun" },
      { name: "Ke-liang Xie", href: null },
    ]);
  });
});

describe("rendered pages + meta", () => {
  it("/researchers lists profiles with counts; a profile page has one H1 = the name and links every study", async () => {
    const index = (await renderPageBody("/researchers"))!;
    expect(index).toContain("<h1>Researchers publishing on molecular hydrogen</h1>");
    expect(index).toContain('<a href="/researchers/xuejun-sun">Xue-jun Sun</a> — 9 studies, 1 in people (2015–2024)');
    expect(index).not.toContain("Ke-liang Xie");

    const page = (await renderPageBody("/researchers/xuejun-sun"))!;
    expect((page.match(/<h1\b/g) ?? []).length).toBe(1);
    expect(page).toContain("<h1>Xue-jun Sun</h1>");
    expect(page).toContain("Also published as: Xuejun Sun.");
    expect((page.match(/<a href="\/study\/study-\d+">/g) ?? []).length).toBe(9);
    expect(page).toContain('href="/explore-by-condition/sepsis"'); // condition hub link
    expect(page).toContain("pubmed.ncbi.nlm.nih.gov/?term=Sun%20XJ%5BAuthor%5D");
    expect(page).toContain("share a page"); // the name-matching caveat is visible
  });

  it("unknown profiles are null (hard 404) and count as content paths", async () => {
    expect(await renderPageBody("/researchers/nobody-here")).toBeNull();
    expect(await renderPageBody("/journals/nope")).toBeNull();
    expect(await resolvePageMeta("/researchers/nobody-here")).toBeNull();
    expect(isContentPath("/researchers/nobody-here")).toBe(true);
    expect(isContentPath("/journals/x")).toBe(true);
    expect(isContentPath("/researchers")).toBe(false);
  });

  it("profile meta: ProfilePage named by the H1 + BreadcrumbList matching the visible trail", async () => {
    const meta = (await resolvePageMeta("/researchers/xuejun-sun"))!;
    expect(meta.title).toBe("Xue-jun Sun: hydrogen research (9 studies) | Hydrogen Studies");
    expect(meta.canonical).toBe("https://hydrogenstudies.com/researchers/xuejun-sun");
    const [profile, trail] = meta.jsonLd as any[];
    expect(profile["@type"]).toBe("ProfilePage");
    expect(profile.mainEntity).toEqual({ "@type": "Person", name: "Xue-jun Sun" });
    expect(JSON.stringify(profile)).not.toMatch(/affiliation|orcid/i);
    expect(trail.itemListElement.map((n: any) => n.name)).toEqual(["Home", "Researchers", "Xue-jun Sun"]);
    const html = (await renderPageBody("/researchers/xuejun-sun"))!;
    expect(html).toContain('<li><a href="/researchers">Researchers</a></li><li aria-current="page">Xue-jun Sun</li>');
  });

  it("journal page + meta: CollectionPage about a Periodical", async () => {
    const html = (await renderPageBody("/journals/medical-gas-research"))!;
    expect(html).toContain("<h1>Medical Gas Research</h1>");
    expect((html.match(/<a href="\/study\/study-\d+">/g) ?? []).length).toBe(10);
    const meta = (await resolvePageMeta("/journals/medical-gas-research"))!;
    const [page, trail] = meta.jsonLd as any[];
    expect(page["@type"]).toBe("CollectionPage");
    expect(page.name).toBe("Medical Gas Research");
    expect(page.about).toEqual({ "@type": "Periodical", name: "Medical Gas Research" });
    expect(trail.itemListElement.map((n: any) => n.name)).toEqual(["Home", "Journals", "Medical Gas Research"]);
  });

  it("index meta carries CollectionPage + BreadcrumbList named by the visible H1", () => {
    const meta = resolveStaticPageMeta("/journals")!;
    const [page, trail] = meta.jsonLd as any[];
    expect(page.name).toBe("Journals publishing hydrogen research");
    expect(trail.itemListElement.map((n: any) => n.name)).toEqual(["Home", "Journals publishing hydrogen research"]);
    expect(meta.robots).toBeUndefined(); // indexable
  });
});

describe("resolved identity (OpenAlex authorships)", () => {
  it("shows ORCID, affiliation and the author record only when an identity exists; schema sameAs mirrors it", async () => {
    identities.rows = [{ authorKey: "xuejun sun", openalexAuthorId: "A5012345678", displayName: "Xuejun Sun", orcid: "0000-0001-2345-6789", institution: "Naval Medical University", institutionCountry: "CN", institutionRor: null, occurrences: 7, share: 0.9, updatedAt: null }];
    const html = (await renderPageBody("/researchers/xuejun-sun"))!;
    expect(html).toContain('ORCID <a href="https://orcid.org/0000-0001-2345-6789" rel="noopener">0000-0001-2345-6789</a>');
    expect(html).toContain("Naval Medical University (CN)");
    expect(html).toContain('href="https://openalex.org/A5012345678"');
    expect(html).toContain("Resolved from the author lists of 7 of their papers");
    expect(html).not.toContain("we hold no affiliation or credential data for this name");
    const meta = (await resolvePageMeta("/researchers/xuejun-sun"))!;
    const person = (meta.jsonLd as any[])[0].mainEntity;
    expect(person.sameAs).toEqual(["https://orcid.org/0000-0001-2345-6789", "https://openalex.org/A5012345678"]);
    expect(person.affiliation).toEqual({ "@type": "Organization", name: "Naval Medical University" });
  });

  it("without an identity the page stays name-only and the schema makes no identity claims", async () => {
    const html = (await renderPageBody("/researchers/xuejun-sun"))!;
    expect(html).not.toContain("ORCID");
    expect(html).toContain("we hold no affiliation or credential data for this name");
    const person = ((await resolvePageMeta("/researchers/xuejun-sun"))!.jsonLd as any[])[0].mainEntity;
    expect(person.sameAs).toBeUndefined();
    expect(person.affiliation).toBeUndefined();
  });
});
