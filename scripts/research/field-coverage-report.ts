/**
 * MCP plan Phase 0 — structured-field coverage report for live studies.
 *
 * For every live study (is_excluded = false): % non-empty per structured
 * field the MCP compare/aggregate tools depend on, plus the raw value
 * vocabularies of the categorical fields (to size the normalization work).
 *
 * READ-ONLY. Writes reports/research/field-coverage-<date>.md and prints it.
 *   railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/research/field-coverage-report.ts'
 *
 * --projected <field-extraction-dryrun CSV>: adds "human projected" columns —
 * current human coverage plus the dry run's (fill-empty-only) proposals.
 */
import fs from "fs";
import path from "path";
import pg from "pg";

/** [label, SQL predicate meaning "this field has a usable value"] */
const FIELDS: Array<[string, string]> = [
  ["study_type", "NULLIF(TRIM(study_type), '') IS NOT NULL"],
  ["outcome", "NULLIF(TRIM(outcome), '') IS NOT NULL"],
  ["sample_size", "sample_size IS NOT NULL AND sample_size > 0"],
  ["duration (days)", "duration IS NOT NULL AND duration > 0"],
  ["is_human_trial (set)", "is_human_trial IS NOT NULL"],
  ["h2_delivery_method", "NULLIF(TRIM(h2_delivery_method), '') IS NOT NULL"],
  ["h2_concentration", "NULLIF(TRIM(h2_concentration), '') IS NOT NULL"],
  ["dosage_protocol", "NULLIF(TRIM(dosage_protocol), '') IS NOT NULL"],
  ["funding_sources", "NULLIF(TRIM(funding_sources), '') IS NOT NULL"],
  ["conflict_of_interest", "NULLIF(TRIM(conflict_of_interest), '') IS NOT NULL"],
  ["limitations","NULLIF(TRIM(limitations), '') IS NOT NULL"],
  ["health_conditions[]", "COALESCE(array_length(health_conditions, 1), 0) > 0"],
  ["body_systems[]", "COALESCE(array_length(body_systems, 1), 0) > 0"],
  ["mechanisms[]", "COALESCE(array_length(mechanisms, 1), 0) > 0"],
  ["abstract", "NULLIF(TRIM(abstract), '') IS NOT NULL"],
  ["conclusion", "NULLIF(TRIM(conclusion), '') IS NOT NULL"],
  ["methods", "NULLIF(TRIM(methods), '') IS NOT NULL"],
  ["plain_summary", "NULLIF(TRIM(plain_summary), '') IS NOT NULL"],
  ["key_finding", "NULLIF(TRIM(key_finding), '') IS NOT NULL"],
  ["tldr", "NULLIF(TRIM(tldr), '') IS NOT NULL"],
  ["publish_year", "publish_year IS NOT NULL"],
  ["pmid", "NULLIF(TRIM(pmid), '') IS NOT NULL"],
  ["doi", "NULLIF(TRIM(doi), '') IS NOT NULL"],
  ["slug", "NULLIF(TRIM(slug), '') IS NOT NULL"],
];

const VOCAB_FIELDS = ["study_type", "outcome", "h2_delivery_method"];

/** Coverage-report label → field name used by extract-human-trial-fields.ts. */
const PROJECTED_KEY: Record<string, string> = {
  sample_size: "sample_size",
  "duration (days)": "duration",
  h2_concentration: "h2_concentration",
  dosage_protocol: "dosage_protocol",
  funding_sources: "funding_sources",
  conflict_of_interest: "conflict_of_interest",
};

/** field → number of distinct studies with a proposal in a dry-run CSV. */
function projectedCounts(file: string): Record<string, number> {
  const seen: Record<string, Set<string>> = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/).slice(1)) {
    const m = line.match(/^(\d+),([a-z0-9_]+),/);
    if (m) (seen[m[2]] ??= new Set()).add(m[1]);
  }
  return Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.size]));
}

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const selects = FIELDS.map(([, pred], i) =>
      `COUNT(*) FILTER (WHERE ${pred}) AS f${i}, COUNT(*) FILTER (WHERE is_human_trial AND ${pred}) AS h${i}`).join(",\n  ");
    const { rows: [counts] } = await client.query(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_human_trial) AS human_total, ${selects}
         FROM studies WHERE is_excluded = false`,
    );
    const total = Number(counts.total);
    const humanTotal = Number(counts.human_total);
    const argv = process.argv;
    const projectedArg = argv.includes("--projected") ? argv[argv.indexOf("--projected") + 1] : undefined;
    const projected = projectedArg ? projectedCounts(projectedArg) : null;
    const pct = (n: number, d: number) => `${d ? ((n / d) * 100).toFixed(1) : "0"}%`;
    const { rows: [quality] } = await client.query(
      `SELECT COUNT(DISTINCT q.study_id) AS n FROM study_quality_scores q
         JOIN studies s ON s.id = q.study_id WHERE s.is_excluded = false`,
    ).catch(() => ({ rows: [{ n: "n/a" }] }));

    const lines: string[] = [];
    const today = new Date().toISOString().slice(0, 10);
    lines.push(`# Study field coverage — ${today}`, "", `Live studies (is_excluded = false): **${total}** (human trials: **${humanTotal}**)`, "");
    if (projected) lines.push(`Human projected = current + proposals in \`${path.basename(projectedArg!)}\` (NOT applied).`, "");
    lines.push(
      `| Field | Filled | % | Human filled | Human % |${projected ? " Human projected | Projected % |" : ""}`,
      `| --- | ---: | ---: | ---: | ---: |${projected ? " ---: | ---: |" : ""}`,
    );
    FIELDS.forEach(([label], i) => {
      const n = Number(counts[`f${i}`]);
      const h = Number(counts[`h${i}`]);
      let row = `| ${label} | ${n} | ${pct(n, total)} | ${h} | ${pct(h, humanTotal)} |`;
      if (projected) {
        const key = PROJECTED_KEY[label];
        const p = h + (key ? projected[key] ?? 0 : 0);
        row += key ? ` ${p} | ${pct(p, humanTotal)} |` : " — | — |";
      }
      lines.push(row);
    });
    lines.push(`| study_quality_scores (any) | ${quality.n} | ${typeof quality.n === "string" && quality.n !== "n/a" ? ((Number(quality.n) / total) * 100).toFixed(1) + "%" : "—"} | | |${projected ? " | |" : ""}`);

    for (const field of VOCAB_FIELDS) {
      const { rows } = await client.query(
        `SELECT COALESCE(NULLIF(TRIM(${field}), ''), '(empty)') AS value, COUNT(*) AS n
           FROM studies WHERE is_excluded = false GROUP BY 1 ORDER BY 2 DESC LIMIT 40`,
      );
      lines.push("", `## ${field} values`, "", "| Value | Count |", "| --- | ---: |");
      for (const r of rows) lines.push(`| ${String(r.value).replace(/\|/g, "\\|").slice(0, 80)} | ${r.n} |`);
    }

    const { rows: human } = await client.query(
      `SELECT is_human_trial, COUNT(*) AS n FROM studies WHERE is_excluded = false GROUP BY 1 ORDER BY 1`,
    );
    lines.push("", "## is_human_trial", "", "| Value | Count |", "| --- | ---: |");
    for (const r of human) lines.push(`| ${r.is_human_trial ?? "(null)"} | ${r.n} |`);

    const out = lines.join("\n") + "\n";
    const dir = path.join(process.cwd(), "reports", "research");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `field-coverage-${today}${process.argv.includes("--after") ? "-after" : ""}${projected ? "-projected" : ""}.md`);
    fs.writeFileSync(file, out);
    console.log(out);
    console.log(`Wrote ${path.relative(process.cwd(), file)}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
