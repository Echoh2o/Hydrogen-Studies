/**
 * Compare the discovery queue (pipeline_queue, status awaiting_approval/failed)
 * with the studies already in the database, and with itself, so nothing is
 * imported twice (Josh, 2026-11-05).
 *
 * Match rules, strongest first:
 *   1. DOI: same DOI after normalising (lowercase, no https://doi.org/ or doi: prefix)
 *   2. Title: same title after normalising (lowercase, letters/digits only)
 *   3. Near-title: token Jaccard ≥ 0.9 on titles of ≥ 6 tokens (catches
 *      punctuation/word-order/subtitle variants); reported separately so a
 *      person can eyeball them before they are marked.
 * Matches against excluded studies (retracted/off-topic) count too: those
 * papers must not come back through the queue.
 *
 *   # plan (read-only): writes reports/research/discovery-dedupe-<date>.csv
 *   npx tsx scripts/research/dedupe-discovery-queue.ts
 *   # apply: marks rule-1/2 duplicates (and rule-3 rows with keep=yes in the CSV)
 *   #        status='rejected', error_message='Duplicate of …'; JSON backup first
 *   npx tsx scripts/research/dedupe-discovery-queue.ts --apply --csv <plan.csv>
 *   # rollback
 *   npx tsx scripts/research/dedupe-discovery-queue.ts --rollback --backup <file>
 */
import fs from "fs";
import path from "path";
import pg from "pg";

const args = process.argv.slice(2);
const arg = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const APPLY = args.includes("--apply");
const ROLLBACK = args.includes("--rollback");
const today = new Date().toISOString().slice(0, 10);

export function normDoi(d: string | null | undefined): string {
  return String(d ?? "")
    .trim()
    .toLowerCase()
    .replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/, "")
    .replace(/[.\s]+$/, "");
}
export function normTitle(t: string | null | undefined): string {
  return String(t ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
export function tokenJaccard(a: string, b: string): number {
  const A = new Set(a.split(" ").filter(Boolean));
  const B = new Set(b.split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

interface Row { id: number; doi: string | null; title: string | null; status?: string; is_excluded?: boolean }
interface Match { queueId: number; queueTitle: string; rule: "doi" | "title" | "near_title" | "queue_doi" | "queue_title"; matchKind: "study" | "excluded_study" | "queue"; matchId: number; matchTitle: string; score: number }

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
  await client.connect();
  try {
    if (ROLLBACK) {
      const file = arg("--backup");
      if (!file) throw new Error("--backup <file> required");
      const rows: { id: number; status: string; error_message: string | null }[] = JSON.parse(fs.readFileSync(file, "utf8"));
      await client.query("BEGIN");
      for (const r of rows) await client.query("UPDATE pipeline_queue SET status = $2, error_message = $3, updated_at = now() WHERE id = $1", [r.id, r.status, r.error_message]);
      await client.query("COMMIT");
      console.log(`rolled back ${rows.length} queue rows`);
      return;
    }

    const studies = (await client.query<Row>("SELECT id, doi, title, is_excluded FROM studies")).rows;
    const queue = (await client.query<Row>("SELECT id, doi, title, status FROM pipeline_queue WHERE status IN ('awaiting_approval','failed','pending','processing') ORDER BY id")).rows;

    const byDoi = new Map<string, Row>();
    const byTitle = new Map<string, Row>();
    const byFirst = new Map<string, Row[]>();
    for (const s of studies) {
      const d = normDoi(s.doi);
      if (d && !byDoi.has(d)) byDoi.set(d, s);
      const t = normTitle(s.title);
      if (t && !byTitle.has(t)) byTitle.set(t, s);
      const k = t.split(" ").slice(0, 3).join(" ");
      if (k) (byFirst.get(k) ?? byFirst.set(k, []).get(k)!).push(s);
    }

    const matches: Match[] = [];
    const seenQueueDoi = new Map<string, Row>();
    const seenQueueTitle = new Map<string, Row>();
    for (const q of queue) {
      const d = normDoi(q.doi);
      const t = normTitle(q.title);
      const kind = (s: Row): Match["matchKind"] => (s.is_excluded ? "excluded_study" : "study");
      let m: Match | null = null;
      const sd = d ? byDoi.get(d) : undefined;
      if (sd) m = { queueId: q.id, queueTitle: q.title ?? "", rule: "doi", matchKind: kind(sd), matchId: sd.id, matchTitle: sd.title ?? "", score: 1 };
      if (!m && t) {
        const st = byTitle.get(t);
        if (st) m = { queueId: q.id, queueTitle: q.title ?? "", rule: "title", matchKind: kind(st), matchId: st.id, matchTitle: st.title ?? "", score: 1 };
      }
      if (!m && t && t.split(" ").length >= 6) {
        const cands = byFirst.get(t.split(" ").slice(0, 3).join(" ")) ?? [];
        let best: { s: Row; j: number } | null = null;
        for (const s of cands) {
          const j = tokenJaccard(t, normTitle(s.title));
          if (j >= 0.9 && (!best || j > best.j)) best = { s, j };
        }
        if (best) m = { queueId: q.id, queueTitle: q.title ?? "", rule: "near_title", matchKind: kind(best.s), matchId: best.s.id, matchTitle: best.s.title ?? "", score: Math.round(best.j * 1000) / 1000 };
      }
      // Within-queue duplicates: keep the oldest queue row, mark later ones.
      if (!m && d && seenQueueDoi.has(d)) {
        const o = seenQueueDoi.get(d)!;
        m = { queueId: q.id, queueTitle: q.title ?? "", rule: "queue_doi", matchKind: "queue", matchId: o.id, matchTitle: o.title ?? "", score: 1 };
      }
      if (!m && t && seenQueueTitle.has(t)) {
        const o = seenQueueTitle.get(t)!;
        m = { queueId: q.id, queueTitle: q.title ?? "", rule: "queue_title", matchKind: "queue", matchId: o.id, matchTitle: o.title ?? "", score: 1 };
      }
      if (m) matches.push(m);
      else {
        if (d && !seenQueueDoi.has(d)) seenQueueDoi.set(d, q);
        if (t && !seenQueueTitle.has(t)) seenQueueTitle.set(t, q);
      }
    }

    if (!APPLY) {
      const out = path.join("reports/research", `discovery-dedupe-${today}.csv`);
      const header = "queue_id,rule,match_kind,match_id,score,keep,queue_title,match_title";
      const lines = matches.map((m) =>
        [m.queueId, m.rule, m.matchKind, m.matchId, m.score, m.rule === "near_title" ? "review" : "yes", m.queueTitle, m.matchTitle].map(csvCell).join(","),
      );
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, [header, ...lines].join("\n") + "\n");
      const count = (f: (m: Match) => boolean) => matches.filter(f).length;
      console.log(`queue rows checked: ${queue.length} (studies: ${studies.length})`);
      console.log(`duplicates of a live study: ${count((m) => m.matchKind === "study")}  (doi ${count((m) => m.matchKind === "study" && m.rule === "doi")}, title ${count((m) => m.matchKind === "study" && m.rule === "title")}, near-title ${count((m) => m.matchKind === "study" && m.rule === "near_title")})`);
      console.log(`duplicates of an excluded study (retracted/off-topic): ${count((m) => m.matchKind === "excluded_study")}`);
      console.log(`duplicates within the queue: ${count((m) => m.matchKind === "queue")}`);
      console.log(`unique (not yet in the database): ${queue.length - matches.length}`);
      console.log(`plan written: ${out}  (near-title rows have keep=review; set to yes to include)`);
      return;
    }

    const csv = arg("--csv");
    if (!csv) throw new Error("--csv <plan> required with --apply");
    const lines = fs.readFileSync(csv, "utf8").trim().split("\n").slice(1);
    const toMark = new Map<number, string>();
    for (const line of lines) {
      const [queueId, rule, matchKind, matchId, , keep] = line.split(",");
      if (keep !== "yes") continue;
      const what = matchKind === "queue" ? `queue item ${matchId}` : `${matchKind === "excluded_study" ? "excluded " : ""}study ${matchId}`;
      toMark.set(Number(queueId), `Duplicate of ${what} (${rule}; dedupe ${today})`);
    }
    const ids = [...toMark.keys()];
    const before = (await client.query("SELECT id, status, error_message FROM pipeline_queue WHERE id = ANY($1)", [ids])).rows;
    const backup = path.join("reports/backups", `discovery-dedupe-${Date.now()}.json`);
    fs.writeFileSync(backup, JSON.stringify(before, null, 0));
    await client.query("BEGIN");
    let n = 0;
    for (const [id, msg] of toMark) {
      const r = await client.query("UPDATE pipeline_queue SET status = 'rejected', error_message = $2, updated_at = now() WHERE id = $1 AND status IN ('awaiting_approval','failed','pending')", [id, msg]);
      n += r.rowCount ?? 0;
    }
    await client.query("COMMIT");
    console.log(`marked ${n} queue rows as duplicates; backup ${backup}`);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && /dedupe-discovery-queue/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
