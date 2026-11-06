/** Live evaluation of "Ask the research" (TRUST-BADGE-PLAN 3.7): npx tsx scripts/research/ask-eval.ts (needs DATABASE_URL + AI key; ASK_DEBUG=1 prints rejections). */
import { askResearch } from "../../server/services/ask-research";
const Q: [string, "echowater" | "hydrogenstudies"][] = [
  ["Does hydrogen water help with exercise recovery?", "echowater"],
  ["Does hydrogen water improve sleep?", "echowater"],
  ["Does hydrogen water help skin wrinkles?", "echowater"],
  ["What concentration of hydrogen did human studies use?", "hydrogenstudies"],
  ["Does hydrogen water help with diabetes?", "echowater"],
  ["Does hydrogen water help with diabetes?", "hydrogenstudies"],
  ["Is hydrogen water a scam?", "hydrogenstudies"],
  ["Can hydrogen water cure cancer?", "hydrogenstudies"],
  ["I have high blood pressure, should I drink hydrogen water?", "echowater"],
  ["How do I clean my Flask?", "echowater"],
  ["Does hydrogen water improve IQ in children?", "hydrogenstudies"],
  ["Does inhaled hydrogen help athletes?", "hydrogenstudies"],
];
(async () => {
  for (const [q, site] of Q) {
    const r = await askResearch(q, site);
    console.log(`\n[${site}] ${q}\n  → ${r.status}: ${r.answer.slice(0, 330)}${r.citations.length ? `\n  cites ${r.citations.map((c) => c.id).join(",")}` : ""}${r.supportArticles?.length ? `\n  help: ${r.supportArticles.map((a) => a.title).join(" | ")}` : ""}`);
  }
  process.exit(0);
})();
