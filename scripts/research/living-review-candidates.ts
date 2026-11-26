/**
 * PLAN 6.1: candidate trials for the exercise living review
 * (docs/living-reviews/exercise-performance/PROTOCOL.md §2.1). Read-only.
 *
 *   railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/research/living-review-candidates.ts'
 *
 * Writes data/living-reviews/exercise-performance/candidates.json
 * (id, slug, pmid, doi, design, n, year, title, journal), sorted by id.
 * Each update compares this with screening.json: new ids need screening.
 */
import fs from "fs";
import path from "path";
import pg from "pg";

export const EXERCISE_TERMS =
  "exercis|athlet|sport|fatigue|muscle|lactate|endurance|cycling|runn|sprint|training|physical performance";

const OUT = "data/living-reviews/exercise-performance/candidates.json";

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query(
    `SELECT id, slug, pmid, doi, study_design AS design, sample_size AS n,
            publish_year AS year, title, journal
       FROM studies
      WHERE is_excluded = false AND is_human_trial
        AND study_design IN ('rct', 'controlled_trial')
        AND (title ~* $1 OR array_to_string(health_conditions, ' ') ~* $1
             OR coalesce(keywords::text, '') ~* $1)
      ORDER BY id`,
    [EXERCISE_TERMS],
  );
  await client.end();
  const clean = rows.map((r) => ({ ...r, title: String(r.title).replace(/\s+/g, " ").trim() }));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(clean, null, 1) + "\n");

  const screenPath = path.join(path.dirname(OUT), "screening.json");
  if (fs.existsSync(screenPath)) {
    const screened = new Set(JSON.parse(fs.readFileSync(screenPath, "utf8")).map((s: { id: number }) => s.id));
    const fresh = clean.filter((r) => !screened.has(r.id));
    console.log(`${clean.length} candidates; ${fresh.length} not yet screened${fresh.length ? ": " + fresh.map((r) => r.id).join(", ") : ""}`);
  } else {
    console.log(`${clean.length} candidates written to ${OUT}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
