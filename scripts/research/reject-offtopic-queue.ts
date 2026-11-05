/**
 * Auto-reject off-topic papers in the discovery queue (Josh, 2026-11-05:
 * "auto reject anything off topic — hydrogen energy, etc.").
 *
 * Rule first (shared/molecular-hydrogen-relevance.ts), then a short Claude
 * Haiku yes/no check for the ambiguous rows only. On-topic and AI-"yes" rows
 * stay awaiting_approval for Sarah. Nothing is deleted: rejected rows keep
 * their data with status='rejected' and an error_message giving the reason.
 *
 *   # plan: writes reports/research/offtopic-queue-<date>.csv (runs the AI check)
 *   npx tsx scripts/research/reject-offtopic-queue.ts
 *   # apply the plan (rows with action=reject); JSON backup first
 *   npx tsx scripts/research/reject-offtopic-queue.ts --apply --csv <plan.csv>
 *   # rollback
 *   npx tsx scripts/research/reject-offtopic-queue.ts --rollback --backup <file>
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { molecularHydrogenRelevance } from "../../shared/molecular-hydrogen-relevance";

const args = process.argv.slice(2);
const arg = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const today = new Date().toISOString().slice(0, 10);

const SYSTEM = `You screen papers for a database of research on MOLECULAR HYDROGEN (H2 gas) and its effects on living things: hydrogen-rich water, hydrogen gas inhalation, hydrogen-rich saline, hydrogen baths, hydrogen-generating materials or bacteria in the body, and electrolyzed/reduced/alkaline-ionized water. Animal, cell, plant-physiology and human studies all count, as do reviews of hydrogen medicine.
NOT in scope: hydrogen energy or fuel, hydrogen peroxide, hydrogen sulfide, hydrogen bonds, hydrogen ions/pH, deuterium/heavy water, H2-receptor drugs, physics/chemistry/materials science of hydrogen, and anything where hydrogen is only incidental.
Answer with JSON: {"in_scope": true|false, "reason": "<10 words>"}`;

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Minimal RFC-4180 CSV parser (quoted fields, doubled quotes, commas/newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function aiCheck(title: string, abstract: string): Promise<{ in_scope: boolean | null; reason: string }> {
  const { ai, MODELS } = await import("../../server/services/ai-provider");
  try {
    const r = await ai.generateJSON<{ in_scope: boolean; reason: string }>(
      SYSTEM,
      `Title: ${title}\n\nAbstract: ${abstract.slice(0, 1500) || "(none)"}`,
      { model: MODELS.HAIKU, maxTokens: 100 } as any,
    );
    return { in_scope: typeof r?.in_scope === "boolean" ? r.in_scope : null, reason: String(r?.reason ?? "").slice(0, 120) };
  } catch (e) {
    return { in_scope: null, reason: `ai error: ${String((e as Error).message).slice(0, 80)}` };
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
  await client.connect();
  try {
    if (args.includes("--rollback")) {
      const file = arg("--backup");
      if (!file) throw new Error("--backup <file> required");
      const rows: { id: number; status: string; error_message: string | null }[] = JSON.parse(fs.readFileSync(file, "utf8"));
      await client.query("BEGIN");
      for (const r of rows) await client.query("UPDATE pipeline_queue SET status = $2, error_message = $3, updated_at = now() WHERE id = $1", [r.id, r.status, r.error_message]);
      await client.query("COMMIT");
      console.log(`rolled back ${rows.length} queue rows`);
      return;
    }

    if (args.includes("--apply")) {
      const csv = arg("--csv");
      if (!csv) throw new Error("--csv <plan> required with --apply");
      const records = parseCsv(fs.readFileSync(csv, "utf8")).slice(1);
      const toReject = new Map<number, string>();
      for (const [queueId, action, , reason] of records) {
        if (action !== "reject") continue;
        toReject.set(Number(queueId), `Off-topic (${reason || "no molecular hydrogen"}; auto-reject ${today})`);
      }
      const ids = [...toReject.keys()];
      const before = (await client.query("SELECT id, status, error_message FROM pipeline_queue WHERE id = ANY($1)", [ids])).rows;
      const backup = path.join("reports/backups", `offtopic-queue-${Date.now()}.json`);
      fs.writeFileSync(backup, JSON.stringify(before));
      await client.query("BEGIN");
      let n = 0;
      for (const [id, msg] of toReject) {
        const r = await client.query("UPDATE pipeline_queue SET status = 'rejected', error_message = $2, updated_at = now() WHERE id = $1 AND status IN ('awaiting_approval','failed','pending')", [id, msg]);
        n += r.rowCount ?? 0;
      }
      await client.query("COMMIT");
      console.log(`rejected ${n} off-topic queue rows; backup ${backup}`);
      return;
    }

    const rows = (
      await client.query<{ id: number; title: string | null; abstract: string | null; journal: string | null; status: string }>(
        "SELECT id, title, abstract, journal, status FROM pipeline_queue WHERE status IN ('awaiting_approval','failed','pending') ORDER BY id",
      )
    ).rows;
    const out: string[] = ["queue_id,action,verdict,reason,ai,title"];
    const tally: Record<string, number> = {};
    for (const r of rows) {
      const v = molecularHydrogenRelevance({ title: r.title, abstract: r.abstract, journal: r.journal });
      let action: "reject" | "keep" = v.verdict === "off_topic" ? "reject" : "keep";
      let reason = v.reason;
      let aiNote = "";
      if (v.verdict === "ambiguous") {
        const a = await aiCheck(r.title ?? "", r.abstract ?? "");
        aiNote = a.in_scope === null ? `unsure: ${a.reason}` : `${a.in_scope ? "in scope" : "out of scope"}: ${a.reason}`;
        if (a.in_scope === false) {
          action = "reject";
          reason = `AI check: ${a.reason}`;
        }
      }
      const key = `${v.verdict}->${action}`;
      tally[key] = (tally[key] ?? 0) + 1;
      out.push([r.id, action, v.verdict, reason, aiNote, (r.title ?? "").slice(0, 200)].map(csvCell).join(","));
    }
    const file = path.join("reports/research", `offtopic-queue-${today}.csv`);
    fs.writeFileSync(file, out.join("\n") + "\n");
    console.log(`queue rows: ${rows.length}`, tally);
    console.log(`plan: ${file}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
