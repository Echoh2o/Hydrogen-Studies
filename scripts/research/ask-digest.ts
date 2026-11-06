/**
 * Weekly "Ask the research" digest (TRUST-BADGE-PLAN 3.5). Aggregates only —
 * questions are already PII-scrubbed in ask_log. Writes
 * reports/ask/digest-<date>.md with three sections:
 *   marketing (objections, topic demand, refusal rate) · support (product
 *   questions) · reviewer (research questions with weak or no evidence).
 *   npx tsx scripts/research/ask-digest.ts [--days 7]
 */
import fs from "fs";
import path from "path";
import pg from "pg";

const days = Number(process.argv[process.argv.indexOf("--days") + 1]) || 7;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const c = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
  c.on("error", () => {});
  await c.connect();
  try {
    const since = `now() - interval '${days} days'`;
    const totals = (await c.query(`SELECT site, intent, status, count(*)::int AS n FROM ask_log WHERE created_at > ${since} GROUP BY 1,2,3 ORDER BY 4 DESC`)).rows;
    const top = (await c.query(`SELECT lower(question) AS q, count(*)::int AS n FROM ask_log WHERE created_at > ${since} AND intent = 'research' GROUP BY 1 ORDER BY 2 DESC LIMIT 20`)).rows;
    const support = (await c.query(`SELECT question AS q, count(*)::int AS n FROM ask_log WHERE created_at > ${since} AND intent = 'product_support' GROUP BY 1 ORDER BY 2 DESC LIMIT 20`)).rows;
    const gaps = (await c.query(`SELECT question AS q, status, count(*)::int AS n FROM ask_log WHERE created_at > ${since} AND status IN ('no_evidence','fallback') GROUP BY 1,2 ORDER BY 3 DESC LIMIT 20`)).rows;
    const all = totals.reduce((a, r) => a + r.n, 0);
    const refused = totals.filter((r) => r.status === "refused_medical" || r.status === "redirected_disease").reduce((a, r) => a + r.n, 0);
    const date = new Date().toISOString().slice(0, 10);
    const lines = [
      `# Ask the research — weekly digest (${days} days to ${date})`, "",
      `Questions: ${all}. Refused or redirected (medical / disease on the store): ${refused}${all ? ` (${Math.round((refused / all) * 100)}%)` : ""}.`, "",
      "| Site | Intent | Result | Questions |", "|---|---|---|---|",
      ...totals.map((r) => `| ${r.site} | ${r.intent} | ${r.status} | ${r.n} |`), "",
      "## For marketing: what people ask about the research", "", ...(top.length ? top.map((r) => `- ${r.q} (${r.n})`) : ["- none this week"]), "",
      "## For support: product questions asked in the widget", "", ...(support.length ? support.map((r) => `- ${r.q} (${r.n})`) : ["- none this week"]), "",
      "## For the reviewer: questions the database couldn't answer well", "", ...(gaps.length ? gaps.map((r) => `- ${r.q} — ${r.status} (${r.n})`) : ["- none this week"]), "",
    ];
    const out = path.join("reports/ask", `digest-${date}.md`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, lines.join("\n"));
    console.log(`wrote ${out} (${all} questions)`);
  } finally {
    await c.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
