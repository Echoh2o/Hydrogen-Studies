/**
 * Server-side answers over the local study corpus — admin MCP tier only
 * (/mcp/admin). Retrieval goes through research-query (same filters and
 * normalization as the public tools); Claude writes the answer from the
 * retrieved studies with numbered [n] citations that map to `citations`.
 *
 * Internal use: no rate limit or budget cap (Josh, 2026-10-20); every call is
 * attributed in ai-provider usage logs via `caller`.
 */
import { ai, MODELS } from "./ai-provider";
import {
  evidenceProfile,
  findStudies,
  getStudyDetail,
  sortStudies,
  studyCard,
  type CorpusStudy,
  type ResearchFilters,
} from "./research-query";

export type Depth = "standard" | "deep";

const modelFor = (depth: Depth) => (depth === "deep" ? MODELS.OPUS : MODELS.SONNET);

/**
 * Pick the studies an answer is written from: the most relevant matches,
 * then strongest-evidence first so human RCTs aren't crowded out by many
 * animal papers with similar wording.
 */
export function selectEvidence(matches: CorpusStudy[], max: number): CorpusStudy[] {
  return sortStudies(matches.slice(0, max * 3), "evidence").slice(0, max);
}

async function evidenceBlock(selected: CorpusStudy[]) {
  const details = await Promise.all(selected.map((s) => getStudyDetail(String(s.id), { full: true })));
  return details
    .map((d, i) => {
      if (!d) return null;
      const abstract = "abstract" in d && d.abstract ? String(d.abstract).slice(0, 1800) : "";
      return [
        `[${i + 1}] ${d.title} (${d.year ?? "n.d."}, ${d.journal ?? "journal unknown"})`,
        `design: ${d.design ?? "unknown"} · subject: ${d.subject} · species: ${d.species ?? "?"} · n=${d.sample_size ?? "?"} · duration_days=${d.duration_days ?? "?"}`,
        `H2: ${d.delivery_method ?? "?"} · concentration: ${d.h2_concentration ?? "?"} · protocol: ${d.dosage_protocol ?? "?"} · outcome: ${d.outcome ?? "?"}`,
        d.key_finding ? `key finding: ${d.key_finding}` : "",
        d.limitations ? `limitations: ${d.limitations}` : "",
        abstract ? `abstract: ${abstract}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

const ANSWER_SYSTEM = `You answer questions about molecular hydrogen (H2) research for the Hydrogen Studies team, using ONLY the numbered studies provided.

Rules:
- Cite every factual claim with its study number(s) in square brackets, e.g. [2][5]. Never cite a number that is not in the list.
- Lead with a 1–2 sentence bottom line, then the human evidence, then animal/in-vitro evidence, then limitations and gaps.
- Weigh evidence by design: meta-analyses and RCTs > other human studies > animal > in vitro > reviews. Say how many human trials and participants the conclusion rests on.
- If the provided studies don't answer the question, say so plainly. Never invent studies, numbers or doses.
- Never describe hydrogen as a treatment or cure for a disease; describe what studies measured and found.
- Markdown, concise: aim for 250–450 words.`;

export async function answerQuestion(input: {
  question: string;
  filters?: ResearchFilters;
  depth?: Depth;
  maxStudies?: number;
}) {
  const depth = input.depth ?? "standard";
  const max = Math.min(Math.max(input.maxStudies ?? 12, 3), 25);
  const { studies: matches, condition, notes } = await findStudies({ ...input.filters, query: input.question });
  const selected = selectEvidence(matches, max);
  if (!selected.length) {
    return {
      answer: "No studies in the Hydrogen Studies database match this question. Try different wording or fewer filters.",
      citations: [],
      retrieval: { matched: 0, used: 0, condition_hub: condition, notes },
      model: null,
    };
  }
  const answer = await ai.generateText(
    ANSWER_SYSTEM,
    `Question: ${input.question}\n\nStudies:\n\n${await evidenceBlock(selected)}`,
    { model: modelFor(depth), maxTokens: depth === "deep" ? 4000 : 2500, caller: "mcp-answer-question" },
  );
  return {
    answer,
    citations: selected.map((s, i) => ({ n: i + 1, ...studyCard(s) })),
    retrieval: { matched: matches.length, used: selected.length, condition_hub: condition, notes, evidence: evidenceProfile(matches, 0) },
    model: modelFor(depth),
  };
}

export interface LocalTopicSynthesis {
  topic_scope: string;
  evidence_strength_rating: number; // 1-10
  evidence_strength_justification: string;
  bottom_line: string;
  supported_benefits: Array<{ claim: string; studies: number[] }>;
  null_or_negative_findings: Array<{ finding: string; studies: number[] }>;
  safety_profile: string;
  delivery_and_dosing: string;
  research_gaps: string[];
}

const SYNTHESIS_SYSTEM = `You synthesize the molecular hydrogen (H2) evidence on one topic for the Hydrogen Studies research team, using ONLY the numbered studies and the evidence profile provided. Weigh human RCTs and meta-analyses far above animal and in-vitro work. Never call hydrogen a treatment or cure. Reference studies by number.

Return JSON:
{
  "topic_scope": string,
  "evidence_strength_rating": integer 1-10 (10 = multiple large consistent human RCTs; 1 = only preclinical or anecdotal),
  "evidence_strength_justification": string,
  "bottom_line": string (2-3 sentences),
  "supported_benefits": [{ "claim": string, "studies": [study numbers] }],
  "null_or_negative_findings": [{ "finding": string, "studies": [study numbers] }],
  "safety_profile": string,
  "delivery_and_dosing": string (what routes/doses were studied and what worked),
  "research_gaps": [string]
}`;

const synthesisCache = new Map<string, { at: number; value: unknown }>();
const SYNTHESIS_TTL_MS = 24 * 60 * 60 * 1000;

export async function synthesizeTopic(input: { topic: string; depth?: Depth; refresh?: boolean }) {
  const depth = input.depth ?? "deep";
  const key = `${depth}:${input.topic.trim().toLowerCase()}`;
  const hit = synthesisCache.get(key);
  if (hit && !input.refresh && Date.now() - hit.at < SYNTHESIS_TTL_MS) return { ...(hit.value as object), cached: true };

  // A condition hub if the topic names one, otherwise full-text retrieval.
  let found = await findStudies({ condition: input.topic });
  if (!found.condition) found = await findStudies({ query: input.topic });
  const selected = sortStudies(found.studies, "evidence").slice(0, 20);
  if (!selected.length) return { error: `No studies found for "${input.topic}".` };

  const profile = evidenceProfile(found.studies, 0);
  const synthesis = await ai.generateJSON<LocalTopicSynthesis>(
    SYNTHESIS_SYSTEM,
    `Topic: ${input.topic}\n\nEvidence profile (all ${found.studies.length} matching studies):\n${JSON.stringify(profile)}\n\nStrongest studies:\n\n${await evidenceBlock(selected)}`,
    { model: modelFor(depth), maxTokens: 4000, caller: "mcp-synthesize-topic" },
  );
  const value = {
    topic: input.topic,
    condition_hub: found.condition,
    synthesis,
    studies: selected.map((s, i) => ({ n: i + 1, ...studyCard(s) })),
    evidence_profile: profile,
    model: modelFor(depth),
    generated_at: new Date().toISOString(),
  };
  synthesisCache.set(key, { at: Date.now(), value });
  return { ...value, cached: false };
}
