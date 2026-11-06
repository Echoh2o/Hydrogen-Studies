/**
 * TRUST-BADGE-PLAN Phase 3 — "Ask the research": answers ONLY from the
 * database, every factual sentence cites a retrieved [study:ID], refuses
 * medical advice, never recommends products, and says plainly when evidence
 * is weak or missing. On echowater.com, disease-topic questions are redirected
 * to hydrogenstudies.com (no disease research next to products — Appendix E).
 */
import { findStudies, studyCard } from "./research-query";
import { ASK, FORBIDDEN_COPY } from "../../shared/evidence-badge-copy";
import { BRIDGE_PROHIBITED_TERMS } from "../../shared/bridge-policy";

export type AskIntent = "research" | "product_support" | "medical";
export type AskSite = "hydrogenstudies" | "echowater";

const MEDICAL = /\b(?:diagnos\w*|should i (?:take|drink|use|stop)|can (?:it|hydrogen|this) (?:cure|treat|fix|heal)|cure (?:my|for)|treat (?:my|a)|my (?:doctor|medication|meds|prescription|condition|disease|symptoms)|i (?:have|was diagnosed with|suffer from)|dose for (?:my|a|an)|instead of (?:my )?(?:medication|meds|treatment)|pregnan\w*|breastfeed\w*|my (?:child|baby|son|daughter))\b/i;
const SUPPORT = /\b(?:order|shipping|ship|deliver(?:y|ed)|refund|return|warranty|replace(?:ment)?|broken|not working|won'?t (?:turn on|charge)|charg(?:e|ing)|app|bluetooth|clean(?:ing)?|descal\w*|filter (?:change|life)|discount|coupon|price|subscription|track(?:ing)?|serial|registration|manual|instructions|how do i (?:use|clean|charge|set up|reset))\b/i;

export function classifyIntent(q: string): AskIntent {
  if (MEDICAL.test(q)) return "medical";
  if (SUPPORT.test(q)) return "product_support";
  return "research";
}

export function mentionsProhibitedTopic(q: string): boolean {
  const norm = q.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return BRIDGE_PROHIBITED_TERMS.some((t) => norm.includes(t));
}

export interface AskStudy { id: number; title: string; url: string; year: number | null; design: string | null; subject: string | null; outcome: string | null; key_finding: string | null; sample_size: number | null }
export interface AskAnswer {
  intent: AskIntent;
  answer: string;
  status: "answered" | "no_evidence" | "fallback" | "refused_medical" | "redirected_disease" | "support";
  citations: { id: number; title: string; url: string }[];
  studies: AskStudy[];
  supportArticles?: { title: string; url: string }[];
}

/**
 * Claim words an answer may never use. Unlike the badge copy, research answers
 * on hydrogenstudies.com may name conditions studies looked at; on the store,
 * disease topics are blocked separately (mentionsProhibitedTopic).
 */
const ANSWER_FORBIDDEN = FORBIDDEN_COPY.filter((re) => !/diabet|cancer|alzheimer|parkinson/i.test(re.source));

/** Hedge/summary sentences may stand without a citation if they carry no numbers. */
const HEDGE = /\b(?:however|overall|limited|small|preliminary|uncertain|unclear|more (?:research|studies|trials)|larger|not (?:enough|clear|directly)|doesn'?t|don'?t|cannot|can'?t|no studies|few studies|several|some studies|these (?:studies|trials|results)|the evidence|(?:the )?studies in (?:the|our) database|\bmay\b|\bmight\b|suggests?)\b/i;

/** Every finding must cite a retrieved study; uncited sentences only as number-free hedges; no forbidden wording. */
export function validateAnswer(answer: string, retrievedIds: Set<number>, site: AskSite = "hydrogenstudies"): { ok: boolean; cited: number[]; reason?: string } {
  const cited = [...answer.matchAll(/\[([^\]]*study:[^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/study:\s*(\d+)/g)].map((x) => Number(x[1])));
  if (!cited.length) return { ok: false, cited, reason: "no citations" };
  if (cited.some((id) => !retrievedIds.has(id))) return { ok: false, cited, reason: "cites a study that was not retrieved" };
  const sentences = answer.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  for (const sentence of sentences) {
    if (/\[[^\]]*study:/.test(sentence)) continue;
    if (/\d/.test(sentence) || !HEDGE.test(sentence)) return { ok: false, cited, reason: `uncited claim: ${sentence.slice(0, 80)}` };
  }
  const plain = answer.replace(/\[[^\]]*study:[^\]]*\]/g, "");
  for (const re of ANSWER_FORBIDDEN) if (re.test(plain)) return { ok: false, cited, reason: `forbidden wording ${re}` };
  if (/\byou should\b|\brecommend\b|\bbuy\b|\bEcho (?:Flask|Water|H2|machine)\b/i.test(plain)) return { ok: false, cited, reason: "advice or product mention" };
  // On the store, no disease research next to products (Appendix E).
  if (site === "echowater" && mentionsProhibitedTopic(plain)) return { ok: false, cited, reason: "disease topic on the store" };
  return { ok: true, cited };
}

const SYSTEM = `You answer questions about published research on molecular hydrogen, using ONLY the studies provided. Rules:
- Every sentence that states a finding or a number must end with the citation of the study it comes from, like [study:123] (several: [study:1][study:2]). Use only the IDs provided. Caveat or summary sentences without numbers need no citation.
- Refer to \"studies in our database\", never \"the provided studies\".
- Never use the words cure, cures, treat, treats, proven or \"shows that\", not even to deny them. To answer \"can it cure X\", describe what studies measured and say there is no evidence it changes the condition.
- If the studies don't address the question, set evidence_strength to \"none\".
- Describe what studies measured and found, with their design (e.g. "a small trial in 20 athletes"). Say when studies were in animals or cells.
- If the provided studies don't answer the question, or are only animal/cell studies, say so plainly.
- Never give medical advice, never tell the reader what to do, never mention products or brands, never say "proven", "cures", "treats" or "shows that".${""}
- At most 120 words. Plain English.
Return JSON: {"answer": "...", "evidence_strength": "none" | "weak" | "moderate"}`;

async function supportArticles(q: string): Promise<{ title: string; url: string }[]> {
  try {
    const r = await fetch(`https://support.echowater.com/api/v2/help_center/articles/search.json?per_page=3&query=${encodeURIComponent(q.slice(0, 120))}`);
    if (!r.ok) return [];
    const d: any = await r.json();
    return (d.results ?? []).slice(0, 3).map((a: any) => ({ title: String(a.title), url: String(a.html_url) }));
  } catch {
    return [];
  }
}

export async function askResearch(question: string, site: AskSite, deps: { generate?: (sys: string, user: string) => Promise<any> } = {}): Promise<AskAnswer> {
  const q = question.trim().slice(0, 500);
  const intent = classifyIntent(q);
  if (intent === "medical") return { intent, answer: ASK.medical, status: "refused_medical", citations: [], studies: [] };
  if (intent === "product_support") {
    return { intent, answer: ASK.support, status: "support", citations: [], studies: [], supportArticles: await supportArticles(q) };
  }
  if (site === "echowater" && mentionsProhibitedTopic(q)) {
    return { intent, answer: ASK.diseaseOnStore, status: "redirected_disease", citations: [], studies: [] };
  }

  const { studies } = await findStudies({ query: q } as any, "relevance");
  const top: AskStudy[] = studies.slice(0, 8).map((s: any) => {
    const c: any = studyCard(s);
    return { id: c.id, title: c.title, url: c.url, year: c.year, design: c.design, subject: c.subject, outcome: c.outcome ?? null, key_finding: c.key_finding ?? null, sample_size: c.sample_size ?? null };
  });
  if (!top.length) return { intent, answer: ASK.none, status: "no_evidence", citations: [], studies: [] };

  const generate = deps.generate ?? (async (sys: string, user: string) => {
    const { ai, MODELS } = await import("./ai-provider");
    return ai.generateJSON(sys, user, { model: MODELS.HAIKU, maxTokens: 400 } as any);
  });
  const ids = new Set(top.map((s) => s.id));
  const user = `Question: ${q}\n\nStudies:\n${top.map((s) => `[study:${s.id}] ${s.title} (${s.year ?? "n.d."}; ${s.design ?? "design unknown"}; ${s.subject ?? ""}${s.sample_size ? `; n=${s.sample_size}` : ""}). Outcome: ${s.outcome ?? "not recorded"}. Key finding: ${s.key_finding ?? "—"}`).join("\n")}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await generate(SYSTEM, attempt ? `${user}\n\nYour previous answer broke a rule. Cite every finding sentence and follow every rule.` : user);
      const raw = String(out?.answer ?? "").trim();
      if (out?.evidence_strength === "none") return { intent, answer: ASK.none, status: "no_evidence", citations: [], studies: top.slice(0, 5) };
      if (!raw) continue;
      const answer = out?.evidence_strength === "weak" && !raw.startsWith(ASK.weakPrefix) ? `${ASK.weakPrefix} ${raw}` : raw;
      const v = validateAnswer(answer, ids, site);
      if (!v.ok) {
        if (process.env.ASK_DEBUG) console.log(`[ask] rejected (${v.reason}): ${answer.slice(0, 160)}`);
        continue;
      }
      const citations = [...new Set(v.cited)].map((id) => top.find((s) => s.id === id)!).map((s) => ({ id: s.id, title: s.title, url: s.url }));
      return { intent, answer, status: out?.evidence_strength === "none" ? "no_evidence" : "answered", citations, studies: top };
    } catch {
      /* fall through to the fallback */
    }
  }
  return { intent, answer: ASK.fallback, status: "fallback", citations: [], studies: top.slice(0, 5) };
}
