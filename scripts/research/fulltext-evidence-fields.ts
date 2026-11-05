/**
 * TRUST-BADGE-PLAN Phase 0.7, second pass: abstracts rarely state the hydrogen
 * concentration, dose or funding. For studies that still lack them, read the
 * open-access full text from Europe PMC (methods + funding sections only),
 * extract those fields, and fill ONLY empty values. Full text is used for
 * extraction only and is never stored or republished; we keep a ≤200-char
 * source snippet in the change log for the reviewer.
 *
 *   npx tsx scripts/research/fulltext-evidence-fields.ts [--route drinking_water]   # dry run → reports/research/evidence-fulltext-<date>.json
 *   npx tsx scripts/research/fulltext-evidence-fields.ts --apply --json <file>      # backup first
 *   npx tsx scripts/research/fulltext-evidence-fields.ts --rollback --backup <file>
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { ENUMS } from "../../shared/evidence-fields";

const args = process.argv.slice(2);
const arg = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const today = new Date().toISOString().slice(0, 10);
const FILL = ["h2_concentration_ppm", "h2_concentration_kind", "h2_concentration_raw", "dose_ml_per_day", "doses_per_day", "duration_days", "funding_category", "coi_declared", "device_maker"] as const;
type Fill = Partial<Record<(typeof FILL)[number], string | number | null>> & { source_snippet?: string | null };

const SYSTEM = `You read the METHODS and FUNDING text of a published study on molecular hydrogen and extract facts it states. Never guess; use null / "not_reported" / "not_stated" when it isn't stated.
Return JSON:
- h2_concentration_ppm: hydrogen concentration of the water/solution given, in mg/L (= ppm); convert mM × 2.016, ppb ÷ 1000, µg/L ÷ 1000; upper value of a range; null if not stated. Gas percentages are not ppm → null.
- h2_concentration_kind: "measured" | "stated" | "nominal" | "not_reported"
- h2_concentration_raw: the concentration words as written (≤60 chars) or null
- dose_ml_per_day: number or null
- doses_per_day: integer or null
- duration_days: integer or null (weeks ×7, months ×30)
- funding_category: ${ENUMS.funding_category.join(" | ")}
- coi_declared: ${ENUMS.coi_declared.join(" | ")}
- device_maker: manufacturer of the hydrogen device/product used, or null
- source_snippet: copy EXACTLY the sentence (≤200 chars) that states the concentration, or null`;

/** Pull methods/funding text out of Europe PMC JATS XML (no full article kept). */
export function methodsAndFunding(xml: string): string {
  const strip = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
  const parts: string[] = [];
  for (const m of xml.matchAll(/<sec[^>]*sec-type="(?:methods|materials\|methods|materials|subjects)"[^>]*>([\s\S]*?)<\/sec>/gi)) parts.push(strip(m[1]));
  if (!parts.length) {
    for (const m of xml.matchAll(/<sec[^>]*>\s*<title>([^<]*(?:method|material|participant|subject|protocol|intervention)[^<]*)<\/title>([\s\S]*?)<\/sec>/gi)) parts.push(strip(m[2]));
  }
  for (const m of xml.matchAll(/<(?:funding-group|ack|fn-group)[^>]*>([\s\S]*?)<\/(?:funding-group|ack|fn-group)>/gi)) parts.push("FUNDING/ACK: " + strip(m[1]));
  // Fall back to hydrogen-concentration sentences anywhere in the body.
  if (!parts.join(" ").match(/ppm|mg\/L|mmol|mM|ppb/i)) {
    const body = strip(xml);
    const sents = body.split(/(?<=[.;])\s+/).filter((s) => /hydrogen|H2|H\(2\)/i.test(s) && /ppm|mg\/L|mmol|\bmM\b|ppb|µg|μg/i.test(s));
    parts.push(sents.slice(0, 12).join(" "));
  }
  return parts.join("\n").slice(0, 12000);
}

async function fetchJson(url: string): Promise<any> {
  const r = await fetch(url, { headers: { "User-Agent": "hydrogenstudies.com research (josh@hydrogenstudies.com)" } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const route = arg("--route") ?? "drinking_water";

  if (args.includes("--apply") || args.includes("--rollback")) {
    const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
    client.on("error", (e) => console.error("pg error (ignored):", e.message));
    await client.connect();
    try {
      if (args.includes("--rollback")) {
        const rows: Record<string, any>[] = JSON.parse(fs.readFileSync(arg("--backup")!, "utf8"));
        await client.query("BEGIN");
        for (const r of rows) await client.query(`UPDATE studies SET ${FILL.map((f, i) => `${f} = $${i + 2}`).join(", ")} WHERE id = $1`, [r.id, ...FILL.map((f) => r[f] ?? null)]);
        await client.query("COMMIT");
        console.log(`rolled back ${rows.length}`);
        return;
      }
      const plan: { id: number; fill: Fill }[] = JSON.parse(fs.readFileSync(arg("--json")!, "utf8")).results;
      const before = (await client.query(`SELECT id, evidence_fields_status, ${FILL.join(", ")} FROM studies WHERE id = ANY($1)`, [plan.map((p) => p.id)])).rows;
      const backup = path.join("reports/backups", `evidence-fulltext-${Date.now()}.json`);
      fs.writeFileSync(backup, JSON.stringify(before));
      const byId = new Map(before.map((b) => [b.id, b]));
      await client.query("BEGIN");
      let changed = 0;
      for (const p of plan) {
        const cur = byId.get(p.id);
        if (!cur || cur.evidence_fields_status === "unapproved" || cur.evidence_fields_status === "approved") continue;
        // Fill only empty values (and upgrade 'not_reported'/'not_stated' placeholders).
        const set: Record<string, any> = {};
        for (const f of FILL) {
          const v = p.fill[f];
          if (v == null) continue;
          const c = cur[f];
          if (c == null || c === "not_reported" || c === "not_stated") set[f] = v;
        }
        if (!Object.keys(set).length) continue;
        const keys = Object.keys(set);
        await client.query(`UPDATE studies SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1`, [p.id, ...keys.map((k) => set[k])]);
        await client.query(`INSERT INTO evidence_field_changes (study_id, action, actor, changes) VALUES ($1, 'extract', 'extraction:pmc-fulltext', $2)`, [p.id, JSON.stringify({ ...set, source_snippet: p.fill.source_snippet ?? null })]);
        changed++;
      }
      await client.query("COMMIT");
      console.log(`filled fields on ${changed} studies; backup ${backup}`);
    } finally {
      await client.end().catch(() => {});
    }
    return;
  }

  // Dry run: read the candidate list, then release the DB before network/AI work.
  const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
  client.on("error", (e) => console.error("pg error (ignored):", e.message));
  await client.connect();
  const cands = (
    await client.query<{ id: number; pmid: string }>(
      `SELECT id, pmid FROM studies WHERE delivery_route = $1 AND evidence_fields_status IN ('auto_approved','approved')
         AND (h2_concentration_ppm IS NULL OR dose_ml_per_day IS NULL OR funding_category = 'not_stated')
         AND pmid ~ '^[0-9]{5,9}$' ORDER BY id`,
      [route],
    )
  ).rows;
  await client.end().catch(() => {});

  const pmcOf = new Map<string, string>();
  for (let i = 0; i < cands.length; i += 150) {
    const ids = cands.slice(i, i + 150).map((c) => c.pmid).join(",");
    const d = await fetchJson(`https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?tool=hydrogenstudies&email=josh@hydrogenstudies.com&format=json&ids=${ids}`);
    for (const r of d.records ?? []) if (r.pmcid) pmcOf.set(String(r.pmid), r.pmcid);
  }
  const { ai, MODELS } = await import("../../server/services/ai-provider");
  const results: { id: number; pmcid: string; fill: Fill }[] = [];
  const skipped: { id: number; why: string }[] = [];
  for (const c of cands) {
    const pmcid = pmcOf.get(c.pmid);
    if (!pmcid) { skipped.push({ id: c.id, why: "no PMC id" }); continue; }
    let xml = "";
    try {
      const r = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/${pmcid}/fullTextXML`);
      if (!r.ok) { skipped.push({ id: c.id, why: `no OA full text (${r.status})` }); continue; }
      xml = await r.text();
    } catch (e) { skipped.push({ id: c.id, why: "fetch error" }); continue; }
    const text = methodsAndFunding(xml);
    if (text.length < 200) { skipped.push({ id: c.id, why: "no methods text" }); continue; }
    try {
      const raw = await ai.generateJSON<any>(SYSTEM, text, { model: MODELS.SONNET, maxTokens: 400, effort: "low" } as any);
      const num = (v: any, lo: number, hi: number) => (typeof v === "number" && isFinite(v) && v >= lo && v <= hi ? v : null);
      const en = (v: any, l: readonly string[]) => (typeof v === "string" && l.includes(v) ? v : null);
      const norm = (s: string) => s.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "");
      const snippet = typeof raw?.source_snippet === "string" && norm(text).includes(norm(raw.source_snippet)) ? raw.source_snippet.slice(0, 200) : null;
      // A per-day amount ("5.5 mmol of H2 per day") is a dose, never a concentration.
      const perDay = /per day|\/\s*day|daily|\/d\b/i.test(String(raw?.h2_concentration_raw ?? ""));
      const ppm = perDay ? null : num(raw?.h2_concentration_ppm, 0.005, 50);
      results.push({
        id: c.id,
        pmcid,
        fill: {
          // A concentration is only kept when its source sentence is verified in the text.
          h2_concentration_ppm: snippet ? ppm : null,
          h2_concentration_kind: snippet && ppm != null ? en(raw?.h2_concentration_kind, ENUMS.h2_concentration_kind) ?? "stated" : null,
          h2_concentration_raw: snippet && typeof raw?.h2_concentration_raw === "string" ? raw.h2_concentration_raw.slice(0, 60) : null,
          dose_ml_per_day: num(raw?.dose_ml_per_day, 1, 10000),
          doses_per_day: typeof raw?.doses_per_day === "number" ? Math.round(raw.doses_per_day) || null : null,
          duration_days: typeof raw?.duration_days === "number" && raw.duration_days > 0 && raw.duration_days < 5000 ? Math.round(raw.duration_days) : null,
          funding_category: en(raw?.funding_category, ENUMS.funding_category),
          coi_declared: en(raw?.coi_declared, ENUMS.coi_declared),
          device_maker: typeof raw?.device_maker === "string" ? raw.device_maker.slice(0, 80) : null,
          source_snippet: snippet,
        },
      });
    } catch (e) {
      skipped.push({ id: c.id, why: `ai error ${String((e as Error).message).slice(0, 60)}` });
    }
  }
  const file = path.join("reports/research", `evidence-fulltext-${today}-${route}.json`);
  fs.writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), route, results, skipped }, null, 1));
  console.log(`candidates ${cands.length}; extracted ${results.length}; skipped ${skipped.length}`);
  console.log(`with concentration: ${results.filter((r) => r.fill.h2_concentration_ppm != null).length}; dose: ${results.filter((r) => r.fill.dose_ml_per_day != null).length}; funding stated: ${results.filter((r) => r.fill.funding_category && r.fill.funding_category !== "not_stated").length}`);
  console.log(`plan: ${file}`);
}

if (process.argv[1] && /fulltext-evidence-fields/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
