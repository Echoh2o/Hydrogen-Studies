// Publish reviewed articles to blog_articles (insert new or rewrite in place; backs up
// rewritten rows; lifts a 410 on a restored URL). Dry-run by default; --apply writes.
// Generation stays off (CLAUDE.md): this publishes human-reviewed drafts only, ≤5/week.
// Run from the repo dir:
//   railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" NODE_PATH=$PWD/node_modules node <this> [--apply] slug1 slug2 ...'
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

// Article sources: <slug>.md (body, no H1) + <slug>.json (title/meta/FAQ) in CONTENT_DIR.
const DIR = process.env.CONTENT_DIR || __dirname;
const APPLY = process.argv.includes("--apply");
const slugs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const STAMP = new Date().toISOString().slice(0, 10);

async function main() {
  if (!slugs.length) throw new Error("no slugs given");
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const cols = new Set(
    (await db.query(`select column_name from information_schema.columns where table_name = 'blog_articles'`)).rows.map((r) => r.column_name),
  );
  const hasAuthor = cols.has("author_name");

  for (const slug of slugs) {
    const meta = JSON.parse(fs.readFileSync(path.join(DIR, `${slug}.json`), "utf8"));
    const body = fs.readFileSync(path.join(DIR, `${slug}.md`), "utf8").trim() + "\n";
    if (meta.slug !== slug) throw new Error(`${slug}: json slug mismatch (${meta.slug})`);
    if (/^#\s/m.test(body)) throw new Error(`${slug}: body contains an H1`);
    if (/echowater\.com/i.test(body)) throw new Error(`${slug}: body links echowater.com`);
    if (meta.metaTitle.length > 45) throw new Error(`${slug}: metaTitle too long (${meta.metaTitle.length})`);
    const qa = JSON.stringify((meta.questionAnswerPairs || []).map((p) => ({ question: p.question, answer: p.answer })));
    for (const p of meta.questionAnswerPairs || []) {
      if (!body.includes(p.question)) throw new Error(`${slug}: FAQ question not visible in body: ${p.question}`);
    }

    const existing = (await db.query(`select * from blog_articles where slug = $1`, [slug])).rows[0];
    const redirect = (await db.query(`select * from redirects where from_path = $1 and is_active`, [`/blog/${slug}`])).rows[0];
    console.log(`\n== ${slug}: ${existing ? `UPDATE id ${existing.id} (published=${existing.is_published})` : "INSERT new"}; words≈${body.split(/\s+/).length}; FAQ=${meta.questionAnswerPairs.length}; active redirect=${redirect ? redirect.status_code : "none"}`);
    console.log(`   title: ${meta.title}\n   metaTitle: ${meta.metaTitle}\n   metaDescription (${meta.metaDescription.length}): ${meta.metaDescription}`);
    if (!APPLY) continue;

    if (existing) {
      fs.writeFileSync(path.join(DIR, `backup-${slug}-${Date.now()}.json`), JSON.stringify(existing, null, 2));
    }
    const fields = {
      title: meta.title,
      summary: meta.summary,
      content: body,
      meta_title: meta.metaTitle,
      meta_description: meta.metaDescription,
      og_title: meta.title,
      og_description: meta.metaDescription,
      twitter_title: meta.title,
      twitter_description: meta.metaDescription,
      question_answer_pairs: qa,
      semantic_keywords: meta.targetKeywords,
      // Stale AI-era fields that could contradict the rewrite.
      quick_insights: null,
      faq_schema: null,
      schema_org: null,
      hierarchical_structure: null,
      entity_recognition: null,
      article_type: "guide",
      reading_level: "general",
      is_published: true,
      is_archived: false,
    };
    if (hasAuthor) fields.author_name = "Hydrogen Studies Editorial Team";

    await db.query("begin");
    try {
      if (existing) {
        const keys = Object.keys(fields);
        const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
        const note = `${existing.editor_notes ? existing.editor_notes + "\n" : ""}[${STAMP}] Rewritten for keyword plan (sources verified in PubMed); previous version backed up by publish script.`;
        await db.query(
          `update blog_articles set ${sets}, last_reviewed = now(), updated_at = now(), published_at = coalesce(published_at, now()), editor_notes = $${keys.length + 1} where id = $${keys.length + 2}`,
          [...keys.map((k) => fields[k]), note, existing.id],
        );
      } else {
        const keys = ["slug", ...Object.keys(fields), "editor_notes"];
        const vals = [slug, ...Object.values(fields), `[${STAMP}] Published for keyword plan (sources verified in PubMed).`];
        await db.query(
          `insert into blog_articles (${keys.join(", ")}, last_reviewed, published_at, created_at, updated_at) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}, now(), now(), now(), now())`,
          vals,
        );
      }
      if (redirect && redirect.status_code === 410) {
        await db.query(`update redirects set is_active = false, note = coalesce(note,'') || $1 where id = $2`, [
          ` | deactivated ${STAMP}: URL restored with rewritten article (Josh directive: draft + publish content)`,
          redirect.id,
        ]);
        await db.query(
          `insert into redirect_actions_log (action, from_path, to_path, status_code, actor, note) values ('deactivate', $1, null, 410, $2, $3)`,
          [`/blog/${slug}`, "claude-code (approved: josh 2026-09-23)", "410 lifted: URL restored with new article"],
        );
      }
      await db.query("commit");
      console.log("   ✓ applied");
    } catch (e) {
      await db.query("rollback");
      throw e;
    }
  }
  await db.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
