/**
 * Redirect suggestions must target routes that exist on THIS host.
 * Until 2026-09-23 condition candidates were built as
 * `/tools/hydrogen-research/condition/<slug>` — the echowater.com App Proxy
 * path, which 404s on hydrogenstudies.com — and the backfill auto-promoted
 * ~40 of them into live 302 rows pointing at dead pages.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// select().from(table)… resolves to rows for that table; execute() routes on
// the FROM clause of the rendered SQL.
const selectRows = vi.hoisted(() => ({ current: {} as Record<string, any[]> }));
const executeRows = vi.hoisted(() => ({ current: {} as Record<string, any[]> }));

vi.mock("../db", async () => {
  const { getTableName } = await import("drizzle-orm");
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  function chain(state: { table?: string } = {}): any {
    const p: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: any, reject: any) =>
            Promise.resolve([...(selectRows.current[state.table ?? ""] ?? [])]).then(resolve, reject);
        }
        if (prop === "catch") return () => p;
        if (prop === "from") {
          return (table: any) => {
            try { state.table = getTableName(table); } catch { /* not a table */ }
            return p;
          };
        }
        return () => p;
      },
      apply() {
        return p;
      },
    });
    return p;
  }
  return {
    db: {
      select: () => chain({}),
      update: () => chain({}),
      insert: () => chain({}),
      execute: async (q: any) => {
        const { sql } = dialect.sqlToQuery(q);
        const m = /FROM\s+(studies|blog_articles|health_conditions)\b/i.exec(sql);
        return { rows: m ? executeRows.current[m[1].toLowerCase()] ?? [] : [] };
      },
    },
    pool: { query: () => new Promise(() => {}) },
  };
});

import { getRankedSuggestions, conditionHubPath } from "../services/redirect-service";

beforeEach(() => {
  selectRows.current = {};
  executeRows.current = {};
});

describe("conditionHubPath", () => {
  it("builds the on-site condition hub URL", () => {
    expect(conditionHubPath("kidney-health")).toBe("/explore-by-condition/kidney-health");
  });
});

describe("getRankedSuggestions — condition targets", () => {
  it("exact condition-slug match targets /explore-by-condition/<slug>", async () => {
    selectRows.current = { health_conditions: [{ slug: "parkinsons-disease", name: "Parkinson's Disease" }] };
    const out = await getRankedSuggestions("/condition/parkinsons-disease");
    expect(out).toHaveLength(1);
    expect(out[0].target).toBe("/explore-by-condition/parkinsons-disease");
    expect(out[0].contentType).toBe("condition");
  });

  it("trigram condition candidates target /explore-by-condition/<slug>, never the proxy path", async () => {
    executeRows.current = {
      health_conditions: [
        { slug: "kidney-health", name: "Kidney Health", description: null, slug_sim: 0.6, name_sim: 0.7, desc_sim: 0 },
      ],
    };
    const out = await getRankedSuggestions("/secondary-topic/kidney-healthy");
    const cond = out.filter((c) => c.contentType === "condition");
    expect(cond.length).toBeGreaterThan(0);
    for (const c of cond) {
      expect(c.target).toBe("/explore-by-condition/kidney-health");
      expect(c.target.startsWith("/tools/")).toBe(false);
    }
  });
});
