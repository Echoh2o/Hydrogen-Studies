/**
 * Draft corrected plain-language study titles for the headline-accuracy report
 * (reports/content/headline-accuracy-2026-11-02.csv). DRAFTS ONLY — fills the
 * proposed_title column; nothing is written to the database. Applying them
 * needs Josh's approval (PLAN: "approve headline rewrites").
 *
 *   railway run --service Hydrogen-Studies -- npx tsx scripts/content/draft-headline-fixes.ts [csv]
 */
import fs from "fs";
import { ai, MODELS } from "../../server/services/ai-provider";

const CSV = process.argv[2] ?? "reports/content/headline-accuracy-2026-11-02.csv";
const BATCH = 25;

const SYSTEM = `You rewrite plain-language titles for scientific study pages on a health research site.
Rules — accuracy beats appeal:
- Say what was studied: for animal studies name the animal ("in rats", "in mice", "in piglets"); for in_vitro say "in lab cell studies" or "in lab tests".
- Never imply a result in people unless the study was in people.
- No cure/treat/prevent/destroy/kill/eliminate/reverse/proven/miracle language. Prefer "reduced", "lowered", "was linked to", "may", "in a small trial".
- Keep it plain English, Title Case, under 90 characters, faithful to the original paper title.
- If the flagged title is already accurate apart from a minor word, change only that word.`;

type Row = Record<string, string>;

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let cur: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { cur.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      cur.push(field); field = "";
      if (cur.some((f) => f)) rows.push(cur);
      cur = [];
    } else field += c;
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function toCsv(rows: Row[], header: string[]): string {
  const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [header.join(","), ...rows.map((r) => header.map((h) => q(r[h] ?? "")).join(","))].join("\n") + "\n";
}

async function main() {
  const text = fs.readFileSync(CSV, "utf8");
  const header = text.split(/\r?\n/)[0].split(",");
  const rows = parseCsv(text);
  const todo = rows.filter((r) => !r.proposed_title);
  console.log(`${todo.length} titles to draft`);
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const input = batch.map((r) => ({
      id: r.study_id,
      design: r.study_design,
      species: r.species,
      flagged_title: r.current_title,
      original_paper_title: r.original_title,
      problem: r.flags,
    }));
    try {
      const out = await ai.generateJSON<{ id: string; title: string }[]>(
        SYSTEM,
        `Rewrite each flagged_title. Return a JSON array of {"id","title"} in the same order.\n\n${JSON.stringify(input)}`,
        { model: MODELS.HAIKU, maxTokens: 4000, temperature: 0, caller: "HeadlineAccuracy.draft" },
      );
      const byId = new Map(out.map((o) => [String(o.id), o.title]));
      for (const r of batch) r.proposed_title = (byId.get(r.study_id) ?? "").trim();
    } catch (err) {
      console.error(`batch ${i / BATCH + 1} failed: ${(err as Error).message}`);
    }
    fs.writeFileSync(CSV, toCsv(rows, header)); // resumable
    console.log(`${Math.min(i + BATCH, todo.length)}/${todo.length}`);
  }
  const done = rows.filter((r) => r.proposed_title).length;
  console.log(`done: ${done}/${rows.length} drafted`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
