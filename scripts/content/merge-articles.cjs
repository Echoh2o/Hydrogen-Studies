// Merge duplicate posts into a survivor: unpublish loser + 301 loser → survivor.
// Dry-run by default; --apply writes. Merges are content-destructive (CLAUDE.md):
// run --apply only after Josh approves the exact survivor/loser list.
//   railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" NODE_PATH=$PWD/node_modules \
//     node scripts/content/merge-articles.cjs --survivor <slug> <loser-slug>... [--apply] [--approval "<quote>"]
// Or fold posts into a non-blog owner page (hub, /hydrogen-for/*):
//     ... --target /explore-by-condition/<slug> <loser-slug>... [--apply]'
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const APPLY = process.argv.includes("--apply");
const argv = process.argv.slice(2);
const flagValue = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const SURVIVOR = flagValue("--survivor");
const TARGET = flagValue("--target");
const APPROVAL = flagValue("--approval") || "unspecified";
const LOSERS = argv.filter(
  (a, i) => !a.startsWith("--") && !["--survivor", "--target", "--approval"].includes(argv[i - 1]),
);
const STAMP = new Date().toISOString().slice(0, 10);
const ACTOR = `claude-code (approved: josh ${STAMP} '${APPROVAL}')`;
if ((!SURVIVOR === !TARGET) || !LOSERS.length) {
  console.error("usage: (--survivor <slug> | --target </path>) <loser>... [--apply]");
  process.exit(1);
}
if (TARGET && !/^\/[a-z0-9/-]+$/.test(TARGET)) { console.error("--target must be a site path like /explore-by-condition/x"); process.exit(1); }
const TO = TARGET || `/blog/${SURVIVOR}`;

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  if (SURVIVOR) {
    const survivor = (await db.query(`select id, is_published from blog_articles where slug = $1`, [SURVIVOR])).rows[0];
    if (!survivor || !survivor.is_published) throw new Error("survivor missing or unpublished");
  } else {
    const res = await fetch(`https://hydrogenstudies.com${TARGET}`, { redirect: "manual" });
    if (res.status !== 200) throw new Error(`target ${TARGET} returned ${res.status}`);
  }

  for (const slug of LOSERS) {
    const row = (await db.query(`select * from blog_articles where slug = $1`, [slug])).rows[0];
    const from = `/blog/${slug}`;
    const existing = (await db.query(`select * from redirects where from_path = $1`, [from])).rows[0];
    console.log(`${slug}: id=${row?.id} published=${row?.is_published} existing redirect=${existing ? existing.status_code + "→" + existing.to_path : "none"}`);
    if (!APPLY || !row) continue;
    fs.writeFileSync(path.join(process.env.BACKUP_DIR || __dirname, `backup-${slug}-${Date.now()}.json`), JSON.stringify(row, null, 2));
    await db.query("begin");
    try {
      await db.query(
        `update blog_articles set is_published = false, updated_at = now(), editor_notes = coalesce(editor_notes || E'\n', '') || $1 where id = $2`,
        [`[${STAMP}] Merged into ${TO} (301). Approved: ${APPROVAL}`, row.id],
      );
      if (existing) {
        await db.query(`update redirects set to_path = $1, status_code = 301, is_active = true, note = coalesce(note,'') || $3 where id = $2`, [TO, existing.id, ` | merge ${STAMP}`]);
      } else {
        await db.query(
          `insert into redirects (from_path, to_path, status_code, is_active, note) values ($1, $2, 301, true, $3)`,
          [from, TO, `merge ${STAMP}: folded into ${TO}`],
        );
      }
      await db.query(
        `insert into redirect_actions_log (action, from_path, to_path, status_code, actor, note) values ('merge', $1, $2, 301, $3, $4)`,
        [from, TO, ACTOR, "unpublished duplicate (fold any unique, verified substance into the survivor before merging)"],
      );
      await db.query("commit");
      console.log("  ✓ merged");
    } catch (e) {
      await db.query("rollback");
      throw e;
    }
  }
  await db.end();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
