/**
 * Inhaled-gas dose for human inhalation studies (migration 034; Echo Refresh
 * evidence profile). Reads each abstract plus, when open access, the Europe
 * PMC methods section, asks Claude for the gas dose, and keeps a number only
 * if it appears in a sentence copied verbatim from the paper
 * (shared/gas-dose.ts). Fills empty fields only; never touches studies the
 * reviewer approved or unapproved; every write is logged.
 *
 *   npx tsx scripts/research/extract-gas-dose.ts                       # dry run → reports/research/gas-dose-<date>.json
 *   npx tsx scripts/research/extract-gas-dose.ts --apply --json <file> # backup + write
 *   npx tsx scripts/research/extract-gas-dose.ts --rollback --backup <file>
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { validateGasDose, type GasDose } from "../../shared/gas-dose";
import { methodsAndFunding } from "./fulltext-evidence-fields";

const args = process.argv.slice(2);
const arg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const COLS = ["h2_flow_ml_min", "h2_flow_kind", "h2_gas_percent", "gas_total_flow_l_min", "h2_gas_raw", "hyperbaric"] as const;

const SYSTEM = `You read a published human study in which people breathed hydrogen (H2) gas and report the gas dose. Use ONLY what the text says; never guess.

Return JSON with exactly these keys:
- h2_flow_ml_min: the flow of HYDROGEN itself in mL/min, only when the text states it directly (e.g. "H2 at 300 mL/min", or a flow of gas that is ≥99% hydrogen). Convert L/min × 1000. If the stated flow is of a MIXTURE (hydrogen-oxygen gas, H2 in air, H2 in nitrogen), this is null and the flow goes in gas_total_flow_l_min. Otherwise null.
- h2_gas_percent: the percentage of hydrogen in the gas delivered or breathed (e.g. 66.7 for "66.7% H2 / 33.3% O2", 2 for "2% H2"), or null.
- gas_total_flow_l_min: the total flow of the delivered gas mixture in L/min (convert mL/min ÷ 1000), or null.
- hyperbaric: true if the gas was breathed above normal atmospheric pressure (diving, hyperbaric chamber, saturation dive); else false.
- h2_gas_raw: copy EXACTLY, character for character, the ONE sentence (or part of one, ≤250 chars) from the text that contains the numbers you used; null if none.

If several arms used different doses, report the highest-dose hydrogen arm.`;

const today = new Date().toISOString().slice(0, 10);
const connect = async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const c = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
  c.on("error", (e) => console.error("pg error (ignored):", e.message));
  await c.connect();
  return c;
};

async function main() {
  if (args.includes("--rollback")) {
    const c = await connect();
    const rows: Record<string, any>[] = JSON.parse(fs.readFileSync(arg("--backup")!, "utf8"));
    await c.query("BEGIN");
    for (const r of rows) await c.query(`UPDATE studies SET ${COLS.map((k, i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1`, [r.id, ...COLS.map((k) => r[k] ?? null)]);
    await c.query("COMMIT");
    await c.end();
    console.log(`rolled back ${rows.length}`);
    return;
  }
  if (args.includes("--apply")) {
    const plan: { id: number; source: string; dose: GasDose }[] = JSON.parse(fs.readFileSync(arg("--json")!, "utf8")).results;
    const c = await connect();
    const before = (await c.query(`SELECT id, evidence_fields_status, ${COLS.join(", ")} FROM studies WHERE id = ANY($1)`, [plan.map((p) => p.id)])).rows;
    const backup = path.join("reports/backups", `gas-dose-${Date.now()}.json`);
    fs.writeFileSync(backup, JSON.stringify(before));
    const byId = new Map(before.map((b) => [b.id, b]));
    await c.query("BEGIN");
    let n = 0;
    for (const p of plan) {
      const cur = byId.get(p.id);
      if (!cur || cur.evidence_fields_status === "approved" || cur.evidence_fields_status === "unapproved") continue;
      if (cur.h2_flow_ml_min != null || cur.h2_gas_raw != null) continue; // fill empty only
      const set = { ...p.dose };
      await c.query(`UPDATE studies SET ${COLS.map((k, i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1`, [p.id, ...COLS.map((k) => (set as any)[k] ?? null)]);
      await c.query(`INSERT INTO evidence_field_changes (study_id, action, actor, changes) VALUES ($1, 'extract', $2, $3)`, [p.id, `extraction:gas-dose:${p.source}`, JSON.stringify(set)]);
      n++;
    }
    await c.query("COMMIT");
    await c.end();
    console.log(`applied ${n}; backup ${backup}`);
    return;
  }

  const c = await connect();
  const studies = (await c.query<{ id: number; title: string; abstract: string | null; pmid: string | null }>(
    `SELECT id, title, abstract, pmid FROM studies
      WHERE is_excluded = false AND is_human_trial = true AND delivery_route = 'inhaled_gas'
        AND evidence_fields_status IN ('auto_approved','approved') ORDER BY id`)).rows;
  await c.end().catch(() => {});

  const pmcOf = new Map<string, string>();
  const pmids = studies.map((s) => String(s.pmid ?? "")).filter((p) => /^\d{5,9}$/.test(p));
  for (let i = 0; i < pmids.length; i += 150) {
    const r = await fetch(`https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?tool=hydrogenstudies&email=josh@hydrogenstudies.com&format=json&ids=${pmids.slice(i, i + 150).join(",")}`);
    if (r.ok) for (const x of (await r.json()).records ?? []) if (x.pmcid) pmcOf.set(String(x.pmid), x.pmcid);
  }
  const { ai, MODELS } = await import("../../server/services/ai-provider");
  const results: { id: number; source: string; dose: GasDose }[] = [];
  const failures: { id: number; error: string }[] = [];
  let i = 0;
  const worker = async () => {
    while (i < studies.length) {
      const s = studies[i++];
      let text = `Title: ${s.title}\n\nAbstract:\n${(s.abstract ?? "").slice(0, 5000)}`;
      let source = "abstract";
      const pmcid = pmcOf.get(String(s.pmid ?? ""));
      if (pmcid) {
        try {
          const r = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/${pmcid}/fullTextXML`);
          if (r.ok) {
            const m = methodsAndFunding(await r.text());
            if (m.length > 200) { text += `\n\nMethods:\n${m.slice(0, 9000)}`; source = "pmc-fulltext"; }
          }
        } catch { /* abstract only */ }
      }
      try {
        const raw = await ai.generateJSON<any>(SYSTEM, text, { model: MODELS.SONNET, maxTokens: 400, effort: "low" } as any);
        results.push({ id: s.id, source, dose: validateGasDose(raw, text) });
      } catch (e) {
        failures.push({ id: s.id, error: String((e as Error).message).slice(0, 120) });
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  results.sort((a, b) => a.id - b.id);
  const file = path.join("reports/research", `gas-dose-${today}.json`);
  fs.writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), results, failures }, null, 1));
  const flows = results.filter((r) => r.dose.h2_flow_ml_min != null);
  console.log(`studies ${studies.length}; extracted ${results.length} (failures ${failures.length}); full text ${results.filter((r) => r.source === "pmc-fulltext").length}`);
  console.log(`with H2 flow ${flows.length} (stated ${flows.filter((r) => r.dose.h2_flow_kind === "stated").length}, computed ${flows.filter((r) => r.dose.h2_flow_kind === "computed").length}); % only ${results.filter((r) => r.dose.h2_flow_ml_min == null && r.dose.h2_gas_percent != null).length}; hyperbaric ${results.filter((r) => r.dose.hyperbaric).length}`);
  console.log(`≤1280 mL/min: ${flows.filter((r) => (r.dose.h2_flow_ml_min as number) <= 1280).length}`);
  console.log(`file ${file}`);
}

if (process.argv[1] && /extract-gas-dose/.test(process.argv[1])) main().catch((e) => { console.error(e); process.exit(1); });
