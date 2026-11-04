/**
 * PLAN 6.2 — the open dataset (CSV/JSON, CC BY 4.0, no abstracts or prose)
 * and the live "State of hydrogen research" report.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import express from "express";
import request from "supertest";
import { DATASET_FIELDS, datasetCitation, deliveryGroup } from "../../shared/dataset";

const rows = [
  {
    id: 1, slug: "a-study-pmid-1", title: 'Hydrogen, "quoted"', authors: "Xue-jun Sun, B. Two", journal: "Medical Gas Research", publish_year: 2024,
    doi: "https://doi.org/10.1/A", pmid: "12345678", study_design: "rct", is_human_trial: true, study_type: "human", sample_size: 40, duration: 56,
    h2_delivery_method: "Water (Electrolysis)", h2_concentration: "1.6 ppm", outcome: "Positive", health_conditions: ["Type 2 Diabetes", "Metabolic Syndrome"], body_systems: ["Endocrine"],
    country: "Japan", funding_sources: "No external funding declared", conflict_of_interest: null, citation_count: 27, citation_source: "openalex",
    citation_count_updated_at: "2026-11-03T20:00:00Z", openalex_id: "W1", abstract: "SECRET ABSTRACT", tldr: "SECRET SUMMARY",
  },
  {
    id: 2, slug: "b-study", title: "Rat study", authors: "C. Zhao", journal: "Shock", publish_year: 2025, doi: null, pmid: "n/a", study_design: "animal",
    is_human_trial: false, study_type: "rat", sample_size: 0, duration: null, h2_delivery_method: "Gas (Sustained Release)", h2_concentration: "2% H2 gas",
    outcome: "neutral", health_conditions: [], body_systems: null, country: "China", funding_sources: "[]", conflict_of_interest: "", citation_count: 812,
    citation_source: null, citation_count_updated_at: null, openalex_id: null, abstract: "SECRET", tldr: "SECRET",
  },
];

vi.mock("../db", () => {
  const dialect = new PgDialect();
  return {
    db: {
      execute: async (q: any) => {
        const { sql } = dialect.sqlToQuery(q);
        if (/AS funding_sources/i.test(sql)) return { rows };
        if (/since2010/i.test(sql)) return { rows: [{ total: 2, human: 1, since2010: 2 }] };
        if (/AS design/i.test(sql)) return { rows: [{ design: "rct", n: 1 }, { design: "animal", n: 1 }] };
        if (/median_n/i.test(sql)) return { rows: [{ with_n: 1, median_n: 40, lt30: 0, lt100: 1, ge100: 0, max_n: 40, with_dur: 1, median_days: 56, single_day: 0, up_to_4w: 0, to_6m: 1, over_6m: 0 }] };
        if (/human_non_positive/i.test(sql)) return { rows: [{ positive: 1, neutral: 1, negative: 0, mixed: 0, with_outcome: 2, human_non_positive: 0 }] };
        if (/SELECT country/i.test(sql)) return { rows: [{ country: "China", n: 1 }, { country: "Japan", n: 1 }] };
        if (/registration_mention/i.test(sql)) return { rows: [{ funding: 1, coi: 0, concentration: 2, registration_mention: 0 }] };
        if (/conditions_with_rct/i.test(sql)) return { rows: [{ conditions_with_rct: 2, conditions_with_2plus: 0 }] };
        if (/FROM studies/i.test(sql) && /authors/i.test(sql) && /health_conditions/i.test(sql)) return { rows }; // profile index
        if (/FROM health_conditions/i.test(sql)) return { rows: [{ name: "Type 2 Diabetes", slug: "type-2-diabetes", study_count: 69, description: null }] };
        if (/count\(\*\)/i.test(sql) && /health_conditions/i.test(sql)) return { rows: [{ n: 1 }] }; // hub has studies
        return { rows: [] };
      },
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    },
    pool: { query: () => new Promise(() => {}) },
  };
});
vi.mock("../utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const exp = await import("../services/dataset-export");
const { default: datasetRoutes } = await import("../routes/dataset-routes");
const { renderPageBody } = await import("../middleware/seo-body-renderer");
const { resolvePageMeta } = await import("../services/page-meta");

beforeEach(() => exp.__resetDatasetForTests());

describe("records", () => {
  it("maps every documented field, normalizes DOI/PMID, blanks what is unknown, and never carries abstracts or summaries", async () => {
    const [a, b] = await exp.getDatasetRecords();
    expect(Object.keys(a)).toEqual(DATASET_FIELDS.map((f) => f.name));
    expect(a).toMatchObject({ id: 1, url: "https://hydrogenstudies.com/study/a-study-pmid-1", doi: "10.1/A", pmid: "12345678", human: true, sample_size: 40, duration_days: 56, outcome_direction: "positive", health_conditions: "Type 2 Diabetes|Metabolic Syndrome", citation_count: 27, citation_count_as_of: "2026-11-03", openalex_id: "W1", excluded: false });
    expect(b).toMatchObject({ pmid: null, doi: null, sample_size: null, duration_days: null, body_systems: null, health_conditions: null, funding_sources: null, conflict_of_interest: null, outcome_direction: "neutral" });
    expect(b.citation_count).toBeNull(); // legacy count of unknown origin is not exported
    expect(JSON.stringify([a, b])).not.toContain("SECRET");
  });

  it("CSV: header = field list, quotes fields with commas/quotes, one line per record", async () => {
    const csv = exp.toCsv(await exp.getDatasetRecords());
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe(DATASET_FIELDS.map((f) => f.name).join(","));
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"Hydrogen, ""quoted"""');
    expect(lines[1]).toContain('"Xue-jun Sun, B. Two"');
    expect(lines[2]).toContain(",neutral,");
  });

  it("groups delivery methods for the chart without touching the raw value", () => {
    expect(deliveryGroup("Gas (Sustained Release)")).toBe("Inhaled gas");
    expect(deliveryGroup("Water (Electrolysis)")).toBe("Hydrogen water");
    expect(deliveryGroup("Saline (Dissolved)")).toBe("Hydrogen-rich saline");
    expect(deliveryGroup("Medium (Dissolved)")).toBe("Culture medium or solution (laboratory)");
    expect(deliveryGroup("")).toBe("Not recorded");
  });

  it("citation names the version date and licence", () => {
    expect(datasetCitation("2026-11-03T20:00:00Z")).toContain("version 2026-11-03");
    expect(datasetCitation("2026-11-03T20:00:00Z")).toContain("CC BY 4.0");
  });
});

describe("downloads", () => {
  const app = express();
  app.use(datasetRoutes);

  it("CSV download: text/csv, attachment, licence link, hour cache, not indexed", async () => {
    const res = await request(app).get("/dataset/hydrogen-studies.csv");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^text\/csv/);
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="hydrogen-studies-\d{4}-\d{2}-\d{2}\.csv"/);
    expect(res.headers["link"]).toContain('rel="license"');
    expect(res.headers["cache-control"]).toBe("public, max-age=3600");
    expect(res.headers["x-robots-tag"]).toBe("noindex");
    expect(res.text.split("\n")[0]).toBe(DATASET_FIELDS.map((f) => f.name).join(","));
  });

  it("JSON download: records + licence + count", async () => {
    const res = await request(app).get("/dataset/hydrogen-studies.json");
    expect(res.status).toBe(200);
    expect(res.body.license).toBe("https://creativecommons.org/licenses/by/4.0/");
    expect(res.body.count).toBe(2);
    expect(res.body.records[0].doi).toBe("10.1/A");
  });
});

describe("pages", () => {
  it("/dataset describes the fields, licence, citation and downloads; Dataset schema matches", async () => {
    const html = (await renderPageBody("/dataset"))!;
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
    expect(html).toContain('<a href="/dataset/hydrogen-studies.csv"');
    expect(html).toContain('<a href="/dataset/hydrogen-studies.json"');
    for (const f of DATASET_FIELDS) expect(html).toContain(`<code>${f.name}</code>`);
    expect(html).toContain("Creative Commons Attribution 4.0");
    expect(html).toContain("<cite>Hydrogen Studies (");
    const meta = (await resolvePageMeta("/dataset"))!;
    const [ds, trail] = meta.jsonLd as any[];
    expect(ds["@type"]).toBe("Dataset");
    expect(ds.license).toBe("https://creativecommons.org/licenses/by/4.0/");
    expect(ds.isAccessibleForFree).toBe(true);
    expect(ds.distribution.map((d: any) => d.encodingFormat)).toEqual(["text/csv", "application/json"]);
    expect(ds.variableMeasured).toHaveLength(DATASET_FIELDS.length);
    expect(trail.itemListElement.map((n: any) => n.name)).toEqual(["Home", "The Hydrogen Studies dataset"]);
  });

  it("/state-of-hydrogen-research renders live figures, charts as SVG + tables, and links the data", async () => {
    const html = (await renderPageBody("/state-of-hydrogen-research"))!;
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
    const t = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(t).toContain("2 studies, 1 of them in people (50%)");
    expect((html.match(/<svg class="chart"/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(html).toContain("<caption>Studies per year since 2010 (in people in brackets)</caption>");
    expect(html).toContain("Hydrogen water"); // delivery grouping
    expect(html).toContain('href="/dataset"');
    expect(html).toContain('href="/explore-by-condition/'); // condition tags link hubs when one exists
    expect(html).not.toMatch(/\$\{/);
    const meta = (await resolvePageMeta("/state-of-hydrogen-research"))!;
    const [page, trail] = meta.jsonLd as any[];
    expect(page["@type"]).toBe("WebPage");
    expect(page.name).toBe("State of hydrogen research");
    expect(trail.itemListElement.map((n: any) => n.name)).toEqual(["Home", "State of hydrogen research"]);
  });
});
