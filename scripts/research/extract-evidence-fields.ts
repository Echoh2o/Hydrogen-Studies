/**
 * docs/TRUST-BADGE-PLAN.md Phase 0.7 — extract the evidence fields (migration
 * 032) from each study's abstract with Claude, validate them, and (on --apply)
 * store them as auto_approved under the reviewer (Josh, 2026-11-05: assume
 * Sarah approved; she can unapprove later).
 *
 * Abstracts are used for extraction only; nothing here republishes them. The
 * effect-direction quote is kept internal (≤300 chars) and is dropped unless
 * it appears verbatim in the abstract.
 *
 *   # dry run (default scope: human studies) → reports/research/evidence-fields-<date>.{json,csv}
 *   npx tsx scripts/research/extract-evidence-fields.ts [--scope human|all] [--limit N]
 *   # apply a reviewed dry-run JSON (re-validates; JSON backup of prior values first)
 *   npx tsx scripts/research/extract-evidence-fields.ts --apply --json <file>
 *   # rollback
 *   npx tsx scripts/research/extract-evidence-fields.ts --rollback --backup <file>
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { STUDY_REVIEWER } from "../../shared/reviewer";
import { ENUMS, FIELDS, type Extracted } from "../../shared/evidence-fields";
export { ENUMS, FIELDS };

const args = process.argv.slice(2);
const arg = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const today = new Date().toISOString().slice(0, 10);


const SYSTEM = `You extract structured facts from the abstract (and any stated metadata) of a published study on molecular hydrogen (H2). Use ONLY what the text says. Never guess; use null or "not_reported"/"not_stated" when the text does not say.

Return JSON with exactly these keys:
- h2_concentration_ppm: number in mg/L (= ppm) or null. Convert: mM × 2.016; ppb ÷ 1000; µg/L ÷ 1000. For a range use the upper value. Inhaled gas percentages are NOT ppm → null.
- h2_concentration_kind: "measured" (they measured it), "stated" (given without saying it was measured), "nominal" (product label / "saturated"), "not_reported".
- h2_concentration_raw: the concentration words as written (≤60 chars) or null.
- delivery_route: ${ENUMS.delivery_route.join(" | ")}. Tablets dissolved in water = drinking_water.
- h2_source: ${ENUMS.h2_source.join(" | ")}.
- dose_ml_per_day: number or null (volume of hydrogen water per day).
- doses_per_day: integer or null.
- duration_days: integer or null (convert weeks ×7, months ×30).
- population_kind: ${ENUMS.population_kind.join(" | ")} ("patients" = people with a diagnosed condition; animals/cells → not_applicable).
- population_condition: the condition when population_kind is "patients", else null.
- species: ${ENUMS.species.join(" | ")}.
- primary_outcome: the main outcome measured, ≤80 chars.
- effect_direction: for the PRIMARY outcome only: ${ENUMS.effect_direction.join(" | ")}. "improved" only if the abstract reports a statistically significant benefit on it; "no_clear_effect" if not significant or not different from control; "mixed" if some primary measures improved and others did not. Reviews and protocols → "not_reported".
- effect_direction_evidence: copy ONE sentence (or part of one, ≤250 chars) EXACTLY as it appears in the abstract that supports effect_direction, character for character, or null.
- funding_category: ${ENUMS.funding_category.join(" | ")}.
- funded_by_echo: true only if Echo Water / Echo Technologies is named as a funder; otherwise false.
- used_echo_device: true only if an Echo device is named as the intervention; otherwise false.
- device_maker: the named manufacturer of the hydrogen device/product used, or null.
- coi_declared: ${ENUMS.coi_declared.join(" | ")}.`;

/** Validate and normalise one model output against the abstract. */
export function validate(raw: any, abstract: string): Extracted {
  const out: Extracted = {};
  const num = (v: any, lo: number, hi: number) => (typeof v === "number" && isFinite(v) && v >= lo && v <= hi ? v : null);
  const en = (v: any, list: readonly string[]) => (typeof v === "string" && list.includes(v) ? v : null);
  const str = (v: any, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  // ≥ 0.005 mg/L (5 ppb): anything smaller is a misread dose (e.g. µg/day), not a concentration.
  // A per-day amount ("5.5 mmol of H2 per day") is a dose, never a concentration.
  const perDay = /per day|\/\s*day|daily|\/d\b/i.test(String(raw?.h2_concentration_raw ?? ""));
  out.h2_concentration_ppm = perDay ? null : num(raw?.h2_concentration_ppm, 0.005, 50);
  out.h2_concentration_kind = en(raw?.h2_concentration_kind, ENUMS.h2_concentration_kind) ?? "not_reported";
  out.h2_concentration_raw = str(raw?.h2_concentration_raw, 60);
  if (out.h2_concentration_ppm == null && out.h2_concentration_kind !== "not_reported" && !out.h2_concentration_raw) out.h2_concentration_kind = "not_reported";
  out.delivery_route = en(raw?.delivery_route, ENUMS.delivery_route);
  out.h2_source = en(raw?.h2_source, ENUMS.h2_source) ?? "not_reported";
  out.dose_ml_per_day = num(raw?.dose_ml_per_day, 1, 10000);
  out.doses_per_day = typeof raw?.doses_per_day === "number" ? Math.round(raw.doses_per_day) || null : null;
  out.duration_days = typeof raw?.duration_days === "number" && raw.duration_days > 0 && raw.duration_days < 5000 ? Math.round(raw.duration_days) : null;
  out.population_kind = en(raw?.population_kind, ENUMS.population_kind);
  out.population_condition = out.population_kind === "patients" ? str(raw?.population_condition, 120) : null;
  out.species = en(raw?.species, ENUMS.species);
  out.primary_outcome = str(raw?.primary_outcome, 120);
  out.effect_direction = en(raw?.effect_direction, ENUMS.effect_direction) ?? "not_reported";
  const quote = str(raw?.effect_direction_evidence, 300);
  // Compare letters/digits only, so curly quotes, dashes, spacing and unicode
  // variants don't reject a genuine verbatim quote.
  const norm = (s: string) => s.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "");
  out.effect_direction_evidence = quote && norm(abstract).includes(norm(quote)) ? quote : null;
  out.funding_category = en(raw?.funding_category, ENUMS.funding_category) ?? "not_stated";
  out.funded_by_echo = raw?.funded_by_echo === true && /\becho\b/i.test(abstract) ? true : false;
  out.used_echo_device = raw?.used_echo_device === true && /\bEcho (?:Water|Technologies|Flask|H2|Go|Ultimate|Refresh|Revive)\b/.test(abstract) ? true : false;
  out.device_maker = str(raw?.device_maker, 80);
  out.coi_declared = en(raw?.coi_declared, ENUMS.coi_declared) ?? "not_stated";
  return out;
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
  // A Railway proxy drops idle connections; never let that crash the run.
  client.on("error", (e) => console.error("pg client error (ignored):", e.message));
  await client.connect();
  try {
    if (args.includes("--rollback")) {
      const file = arg("--backup");
      if (!file) throw new Error("--backup <file> required");
      const rows: Record<string, any>[] = JSON.parse(fs.readFileSync(file, "utf8"));
      await client.query("BEGIN");
      for (const r of rows) {
        const cols = [...FIELDS, "evidence_fields_status", "evidence_fields_extracted_at", "evidence_fields_model", "evidence_fields_reviewed_by", "evidence_fields_reviewed_at"];
        await client.query(`UPDATE studies SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(", ")} WHERE id = $1`, [r.id, ...cols.map((c) => r[c] ?? null)]);
      }
      await client.query("COMMIT");
      console.log(`rolled back ${rows.length} studies`);
      return;
    }

    if (args.includes("--apply")) {
      const file = arg("--json");
      if (!file) throw new Error("--json <dry-run file> required");
      const plan: { id: number; model: string; fields: Extracted }[] = JSON.parse(fs.readFileSync(file, "utf8")).results;
      const ids = plan.map((p) => p.id);
      const cols = [...FIELDS, "evidence_fields_status", "evidence_fields_extracted_at", "evidence_fields_model", "evidence_fields_reviewed_by", "evidence_fields_reviewed_at"];
      const before = (await client.query(`SELECT id, ${cols.join(", ")} FROM studies WHERE id = ANY($1)`, [ids])).rows;
      const backup = path.join("reports/backups", `evidence-fields-${Date.now()}.json`);
      fs.writeFileSync(backup, JSON.stringify(before));
      // Never overwrite a value the reviewer has touched.
      const touched = new Set(before.filter((b) => b.evidence_fields_status === "approved" || b.evidence_fields_status === "unapproved").map((b) => b.id));
      await client.query("BEGIN");
      let n = 0;
      for (const p of plan) {
        if (touched.has(p.id)) continue;
        const vals = FIELDS.map((f) => p.fields[f] ?? null);
        await client.query(
          `UPDATE studies SET ${FIELDS.map((f, i) => `${f} = $${i + 2}`).join(", ")},
             evidence_fields_status = 'auto_approved', evidence_fields_extracted_at = now(), evidence_fields_model = $${FIELDS.length + 2},
             evidence_fields_reviewed_by = $${FIELDS.length + 3}, evidence_fields_reviewed_at = now()
           WHERE id = $1`,
          [p.id, ...vals, p.model, STUDY_REVIEWER.name],
        );
        await client.query(`INSERT INTO evidence_field_changes (study_id, action, actor, changes) VALUES ($1, 'extract', $2, $3)`, [p.id, `extraction:${p.model}`, JSON.stringify(p.fields)]);
        n++;
      }
      await client.query("COMMIT");
      console.log(`applied ${n} studies (skipped ${touched.size} reviewer-touched); backup ${backup}`);
      return;
    }

    const scope = arg("--scope") ?? "human";
    const limit = Number(arg("--limit") ?? 0);
    const where = scope === "all" ? "is_excluded = false" : "is_excluded = false AND is_human_trial = true";
    const studies = (
      await client.query<{ id: number; title: string; abstract: string | null; journal: string | null; publish_year: number | null; h2_delivery_method: string | null; funding_sources: string | null; conflict_of_interest: string | null }>(
        `SELECT id, title, abstract, journal, publish_year, h2_delivery_method, funding_sources::text AS funding_sources, conflict_of_interest FROM studies WHERE ${where} ORDER BY id ${limit ? `LIMIT ${limit}` : ""}`,
      )
    ).rows;
    // Release the DB before minutes of AI calls (the dry run never writes).
    await client.end().catch(() => {});
    const { ai, MODELS } = await import("../../server/services/ai-provider");
    const model = MODELS.SONNET;
    const partial = path.join("reports/research", `evidence-fields-${today}-${scope}.partial.jsonl`);
    fs.writeFileSync(partial, "");
    const results: { id: number; model: string; fields: Extracted }[] = [];
    const failures: { id: number; error: string }[] = [];
    let i = 0;
    const worker = async () => {
      while (i < studies.length) {
        const s = studies[i++];
        const abstract = s.abstract ?? "";
        if (abstract.trim().length < 80) {
          failures.push({ id: s.id, error: "no usable abstract" });
          continue;
        }
        const user = `Title: ${s.title}\nJournal: ${s.journal ?? ""} (${s.publish_year ?? ""})\nRecorded delivery method: ${s.h2_delivery_method ?? "unknown"}\nRecorded funding: ${s.funding_sources ?? "none recorded"}\nRecorded conflict of interest: ${s.conflict_of_interest ?? "none recorded"}\n\nAbstract:\n${abstract.slice(0, 6000)}`;
        try {
          const raw = await ai.generateJSON(SYSTEM, user, { model, maxTokens: 700, effort: "low" } as any);
          const rec = { id: s.id, model, fields: validate(raw, abstract) };
          results.push(rec);
          fs.appendFileSync(partial, JSON.stringify(rec) + "\n");
        } catch (e) {
          failures.push({ id: s.id, error: String((e as Error).message).slice(0, 120) });
        }
        if ((results.length + failures.length) % 25 === 0) console.log(`  ${results.length + failures.length}/${studies.length}`);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    results.sort((a, b) => a.id - b.id);
    const base = path.join("reports/research", `evidence-fields-${today}-${scope}`);
    fs.writeFileSync(`${base}.json`, JSON.stringify({ generatedAt: new Date().toISOString(), scope, model, results, failures }, null, 1));
    fs.writeFileSync(`${base}.csv`, ["id," + FIELDS.join(","), ...results.map((r) => [r.id, ...FIELDS.map((f) => r.fields[f])].map(csvCell).join(","))].join("\n") + "\n");
    const tally = (f: (typeof FIELDS)[number]) => results.reduce<Record<string, number>>((m, r) => ((m[String(r.fields[f])] = (m[String(r.fields[f])] ?? 0) + 1), m), {});
    console.log(`extracted ${results.length}/${studies.length} (failures ${failures.length}); files ${base}.{json,csv}`);
    console.log("effect_direction:", tally("effect_direction"));
    console.log("delivery_route:", tally("delivery_route"));
    console.log("concentration numeric:", results.filter((r) => r.fields.h2_concentration_ppm != null).length, "| quote kept:", results.filter((r) => r.fields.effect_direction_evidence).length);
    console.log("used_echo_device true:", results.filter((r) => r.fields.used_echo_device).length, "| funded_by_echo true:", results.filter((r) => r.fields.funded_by_echo).length);
  } finally {
    await client.end().catch(() => {});
  }
}

if (process.argv[1] && /extract-evidence-fields/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
