import { sql, type SQL } from "drizzle-orm";
import { studies } from "@shared/schema";
import { isPlaceholder, placeholderStrings } from "@shared/seo-markup";

/**
 * Studies whose abstract is real text — not NULL/blank, not a filler such as
 * "No abstract available", not a `__token__` sentinel. AI enrichment jobs
 * must only summarise these: for the rest the model sees the title alone and
 * either refuses or invents findings (audit 2026-11-22: 105 title-only study
 * pages). Mirrors shared/seo-markup isPlaceholder(); callers re-check each row
 * with hasRealAbstract() for the cases SQL can't express (model refusals).
 */
export function realAbstractSql(): SQL {
  const fillers = sql.join(placeholderStrings().map((v) => sql`${v}`), sql`, `);
  return sql`(${studies.abstract} IS NOT NULL
    AND btrim(${studies.abstract}) <> ''
    AND lower(btrim(${studies.abstract})) NOT IN (${fillers})
    AND btrim(${studies.abstract}) !~ '^__[A-Za-z0-9_]+__$')`;
}

export function hasRealAbstract(abstract: string | null | undefined): boolean {
  return !isPlaceholder(abstract);
}
