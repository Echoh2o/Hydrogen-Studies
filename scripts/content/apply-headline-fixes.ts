/**
 * Apply approved study headline rewrites (Josh approved 2026-11-02:
 * reports/content/headline-accuracy-2026-11-02.csv, proposed_title column).
 *
 * Writes studies.plain_language_title only where the stored title still equals
 * the reviewed current_title (never clobbers a newer edit), bumps
 * last_modified (a real visible change → sitemap lastmod), JSON backup first.
 * Dry-run by default; --apply writes.
 *
 *   railway run --service Hydrogen-Studies -- env DATABASE_URL="$DBURL" \
 *     npx tsx scripts/content/apply-headline-fixes.ts [--apply]
 */
import fs from "fs";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const CSV = "reports/content/headline-accuracy-2026-11-02.csv";

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { cur.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; cur.push(f); f = ""; if (cur.some(Boolean)) rows.push(cur); cur = []; }
    else f += c;
  }
  if (f || cur.length) { cur.push(f); rows.push(cur); }
  const [h, ...b] = rows;
  return b.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""])));
}

async function main() {
  const rows = parseCsv(fs.readFileSync(CSV, "utf8")).filter((r) => r.proposed_title.trim());
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const ids = rows.map((r) => Number(r.study_id));
  const { rows: current } = await pool.query(
    `SELECT id, slug, plain_language_title FROM studies WHERE id = ANY($1)`,
    [ids],
  );
  const byId = new Map(current.map((c: any) => [String(c.id), c]));
  const todo = rows.filter((r) => byId.get(r.study_id)?.plain_language_title === r.current_title);
  console.log(`${rows.length} approved; ${todo.length} still match the reviewed title; ${rows.length - todo.length} skipped (changed since review or missing)`);
  if (!APPLY) { await pool.end(); return; }

  const backup = `reports/backups/headline-fixes-${Date.now()}.json`;
  fs.mkdirSync("reports/backups", { recursive: true });
  fs.writeFileSync(backup, JSON.stringify(todo.map((r) => byId.get(r.study_id)), null, 2));
  let n = 0;
  for (const r of todo) {
    const res = await pool.query(
      `UPDATE studies SET plain_language_title = $1, last_modified = now()
       WHERE id = $2 AND plain_language_title = $3`,
      [r.proposed_title.trim(), Number(r.study_id), r.current_title],
    );
    n += res.rowCount ?? 0;
  }
  console.log(`updated ${n} titles; backup ${backup}`);
  fs.writeFileSync("reports/content/headline-fixes-applied-slugs.txt", todo.map((r) => byId.get(r.study_id).slug).join("\n") + "\n");
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
