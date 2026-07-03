/**
 * Consensus API Integration Service
 * Handles searching, summarizing, and synthesizing hydrogen research via Consensus AI
 *
 * API Docs: https://docs.consensus.app/reference/v1_quick_search
 * Auth: Bearer token via CONSENSUS_API_KEY env var
 */

import axios, { AxiosError } from "axios";
import { ai, MODELS } from "./ai-provider";

// --- Types ---

export interface ConsensusPaper {
  abstract: string;
  consensus_paper_details_url: string;
  doi: string;
  pages: string;
  paper_authors: string[];
  paper_publish_year: number;
  paper_title: string;
  publication_journal_name: string;
  search_result_number: number;
  volume: string;
}

export interface ConsensusSearchResponse {
  items: ConsensusPaper[];
}

export interface StudySummary {
  who_was_studied: string;
  what_was_done: string;
  what_was_measured: string;
  what_was_found: string;
  study_type: string;
  study_limitations: string;
  plain_language_summary: string;
  citations: { doi: string; title: string }[];
}

export interface TopicSynthesis {
  topic_scope: string;
  number_of_human_studies: number;
  number_of_animal_studies: number;
  evidence_strength_rating: number;
  evidence_strength_justification: string;
  key_benefits: string[];
  null_findings: string[];
  safety_profile: string;
  research_gaps: string[];
  key_papers: { title: string; doi: string; year: number; summary: string }[];
}

export interface BlogOutline {
  background: string;
  mechanisms: string;
  human_evidence: { outcome: string; findings: string }[];
  animal_cell_evidence: string;
  limitations_and_gaps: string;
  cited_papers: { title: string; doi: string; snippet: string }[];
  draft_content: string;
}

// --- In-memory cache ---

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  queryHash: string;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(prefix: string, params: Record<string, any>): string {
  return `${prefix}:${JSON.stringify(params)}`;
}

function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, queryHash: string): void {
  cache.set(key, { data, timestamp: Date.now(), queryHash });
}

// --- API Client ---

const CONSENSUS_BASE_URL = "https://api.consensus.app/v1";

function getApiKey(): string | null {
  return process.env.CONSENSUS_API_KEY || null;
}

/** Whether an AI text provider (Anthropic, or the OpenAI fallback) is configured. */
function hasAiProvider(): boolean {
  return ai.getProviderStatus().primary !== "none";
}

/**
 * Search Consensus for papers matching a query
 */
export async function searchConsensus(
  query: string,
): Promise<{ papers: ConsensusPaper[]; fromCache: boolean }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("CONSENSUS_API_KEY not set - returning empty results");
    return { papers: [], fromCache: false };
  }

  const cacheKey = getCacheKey("search", { query });
  const cached = getFromCache<ConsensusPaper[]>(cacheKey);
  if (cached) {
    return { papers: cached, fromCache: true };
  }

  try {
    const response = await axios.get<ConsensusSearchResponse>(
      `${CONSENSUS_BASE_URL}/quick_search`,
      {
        params: { query },
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 15000,
      },
    );

    const papers = response.data.items || [];
    setCache(cacheKey, papers, query);
    console.log(`Consensus search returned ${papers.length} papers for: "${query}"`);
    return { papers, fromCache: false };
  } catch (error) {
    const axiosErr = error as AxiosError;
    if (axiosErr.response?.status === 429) {
      console.warn("Consensus API rate limit hit");
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    console.error("Consensus API error:", axiosErr.message);
    throw new Error(`Consensus API search failed: ${axiosErr.message}`);
  }
}

/**
 * Search Consensus with hydrogen-specific query enhancement
 */
export async function searchHydrogenPapers(
  query: string,
  filters?: { yearFrom?: number; yearTo?: number },
): Promise<{ papers: ConsensusPaper[]; total: number; fromCache: boolean }> {
  // Enhance the query for hydrogen context if not already present
  const enhancedQuery = query.toLowerCase().includes("hydrogen")
    ? query
    : `molecular hydrogen ${query}`;

  const result = await searchConsensus(enhancedQuery);
  let papers = result.papers;

  // Apply client-side filters
  if (filters?.yearFrom) {
    papers = papers.filter((p) => p.paper_publish_year >= filters.yearFrom!);
  }
  if (filters?.yearTo) {
    papers = papers.filter((p) => p.paper_publish_year <= filters.yearTo!);
  }

  return { papers, total: papers.length, fromCache: result.fromCache };
}

/**
 * Generate a structured, lay-friendly summary of a single study
 */
export async function summarizeSingleStudy(
  paper: ConsensusPaper,
): Promise<StudySummary> {
  const cacheKey = getCacheKey("summary", { doi: paper.doi, title: paper.paper_title });
  const cached = getFromCache<StudySummary>(cacheKey);
  if (cached) return cached;

  if (!hasAiProvider()) {
    // Return a basic summary without AI
    return {
      who_was_studied: "See abstract for details",
      what_was_done: "See abstract for details",
      what_was_measured: "See abstract for details",
      what_was_found: paper.abstract.substring(0, 300),
      study_type: "Research study",
      study_limitations: "Not available without AI analysis",
      plain_language_summary: paper.abstract.substring(0, 500),
      citations: [{ doi: paper.doi, title: paper.paper_title }],
    };
  }

  const prompt = `You are a science communicator specializing in molecular hydrogen research.
Analyze this study and provide a structured summary in JSON format.

Study Title: ${paper.paper_title}
Authors: ${paper.paper_authors.join(", ")}
Journal: ${paper.publication_journal_name} (${paper.paper_publish_year})
Abstract: ${paper.abstract}

Return ONLY valid JSON with these fields:
{
  "who_was_studied": "population, sample size, key inclusion criteria (1-2 sentences)",
  "what_was_done": "dose, delivery method (water/inhalation/bath), duration (1-2 sentences)",
  "what_was_measured": "primary outcomes measured (1-2 sentences)",
  "what_was_found": "direction and magnitude of findings (2-3 sentences)",
  "study_type": "RCT | crossover | pilot | observational | animal | in_vitro | review",
  "study_limitations": "key limitations (1-2 sentences)",
  "plain_language_summary": "150-250 word summary at 10th-grade reading level"
}`;

  try {
    const text = await ai.generateText("", prompt, {
      model: MODELS.OPUS,
      maxTokens: 1000,
      temperature: null,
      caller: "ConsensusApi.summarizeSingleStudy",
    });
    // Extract JSON from potential markdown code blocks
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in AI response");

    const summary: StudySummary = {
      ...JSON.parse(jsonMatch[0]),
      citations: [{ doi: paper.doi, title: paper.paper_title }],
    };

    setCache(cacheKey, summary, paper.doi);
    return summary;
  } catch (error) {
    console.error("AI summarization error:", error);
    return {
      who_was_studied: "AI analysis unavailable",
      what_was_done: "AI analysis unavailable",
      what_was_measured: "AI analysis unavailable",
      what_was_found: paper.abstract.substring(0, 300),
      study_type: "Research study",
      study_limitations: "AI analysis unavailable",
      plain_language_summary: paper.abstract.substring(0, 500),
      citations: [{ doi: paper.doi, title: paper.paper_title }],
    };
  }
}

/**
 * Synthesize evidence across multiple papers for a topic
 */
export async function synthesizeTopicEvidence(
  topicSlug: string,
  searchQuery: string,
  topicTitle: string,
): Promise<TopicSynthesis> {
  const cacheKey = getCacheKey("synthesis", { topicSlug });
  const cached = getFromCache<TopicSynthesis>(cacheKey);
  if (cached) return cached;

  // Search for papers on this topic
  const { papers } = await searchConsensus(searchQuery);

  if (papers.length === 0) {
    return {
      topic_scope: topicTitle,
      number_of_human_studies: 0,
      number_of_animal_studies: 0,
      evidence_strength_rating: 0,
      evidence_strength_justification: "No papers found for this topic.",
      key_benefits: [],
      null_findings: [],
      safety_profile: "Insufficient data",
      research_gaps: ["More research needed"],
      key_papers: [],
    };
  }

  if (!hasAiProvider()) {
    // Return basic synthesis without AI
    return {
      topic_scope: topicTitle,
      number_of_human_studies: papers.length,
      number_of_animal_studies: 0,
      evidence_strength_rating: Math.min(papers.length, 10),
      evidence_strength_justification: `Based on ${papers.length} papers found.`,
      key_benefits: ["See individual papers for details"],
      null_findings: [],
      safety_profile: "See individual papers for safety data",
      research_gaps: ["AI analysis required for detailed synthesis"],
      key_papers: papers.slice(0, 5).map((p) => ({
        title: p.paper_title,
        doi: p.doi,
        year: p.paper_publish_year,
        summary: p.abstract.substring(0, 150) + "...",
      })),
    };
  }

  // Build paper summaries for the prompt
  const paperSummaries = papers
    .slice(0, 15) // Limit to prevent token overflow
    .map(
      (p, i) =>
        `[${i + 1}] "${p.paper_title}" (${p.publication_journal_name}, ${p.paper_publish_year})
DOI: ${p.doi}
Abstract: ${p.abstract.substring(0, 400)}`,
    )
    .join("\n\n");

  const prompt = `You are an expert reviewer of molecular hydrogen research.
Synthesize the following ${papers.length} papers about "${topicTitle}" into a structured evidence summary.

Papers:
${paperSummaries}

Return ONLY valid JSON:
{
  "topic_scope": "Brief description of what this topic covers",
  "number_of_human_studies": <integer>,
  "number_of_animal_studies": <integer>,
  "evidence_strength_rating": <1-10 integer>,
  "evidence_strength_justification": "1-2 sentence justification",
  "key_benefits": ["benefit 1", "benefit 2", ...],
  "null_findings": ["any null or negative findings"],
  "safety_profile": "Summary of reported adverse events or safety data",
  "research_gaps": ["gap 1", "gap 2", ...],
  "key_papers": [
    {"title": "...", "doi": "...", "year": <int>, "summary": "1-2 sentence summary"},
    ...
  ]
}

Important:
- Distinguish between human trials and animal/in-vitro studies
- Be honest about evidence strength - don't overclaim
- Note any null or negative findings
- Flag if sample sizes are small`;

  try {
    const text = await ai.generateText("", prompt, {
      model: MODELS.OPUS,
      maxTokens: 2000,
      temperature: null,
      caller: "ConsensusApi.synthesizeTopicEvidence",
    });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");

    const synthesis: TopicSynthesis = JSON.parse(jsonMatch[0]);
    setCache(cacheKey, synthesis, topicSlug);
    return synthesis;
  } catch (error) {
    console.error("Topic synthesis error:", error);
    // Fallback
    return {
      topic_scope: topicTitle,
      number_of_human_studies: papers.length,
      number_of_animal_studies: 0,
      evidence_strength_rating: Math.min(papers.length, 10),
      evidence_strength_justification: `Analysis based on ${papers.length} papers. AI synthesis unavailable.`,
      key_benefits: ["See individual papers"],
      null_findings: [],
      safety_profile: "See individual papers",
      research_gaps: ["Detailed AI synthesis unavailable"],
      key_papers: papers.slice(0, 5).map((p) => ({
        title: p.paper_title,
        doi: p.doi,
        year: p.paper_publish_year,
        summary: p.abstract.substring(0, 150) + "...",
      })),
    };
  }
}

/**
 * Generate a blog outline from Consensus papers on a topic
 */
export async function generateBlogOutline(
  topic: string,
  searchQuery: string,
): Promise<BlogOutline> {
  const cacheKey = getCacheKey("blog-outline", { topic, searchQuery });
  const cached = getFromCache<BlogOutline>(cacheKey);
  if (cached) return cached;

  const { papers } = await searchConsensus(searchQuery);

  if (papers.length === 0) {
    return {
      background: "No research papers found for this topic.",
      mechanisms: "",
      human_evidence: [],
      animal_cell_evidence: "",
      limitations_and_gaps: "Insufficient research data available.",
      cited_papers: [],
      draft_content: "",
    };
  }

  if (!hasAiProvider()) {
    return {
      background: `This article reviews ${papers.length} studies on ${topic}.`,
      mechanisms: "AI analysis required for mechanism details.",
      human_evidence: papers.slice(0, 5).map((p) => ({
        outcome: p.paper_title,
        findings: p.abstract.substring(0, 200),
      })),
      animal_cell_evidence: "See individual studies.",
      limitations_and_gaps: "Detailed analysis requires AI.",
      cited_papers: papers.slice(0, 10).map((p) => ({
        title: p.paper_title,
        doi: p.doi,
        snippet: p.abstract.substring(0, 100),
      })),
      draft_content: "",
    };
  }

  const paperSummaries = papers
    .slice(0, 12)
    .map(
      (p, i) =>
        `[${i + 1}] "${p.paper_title}" (${p.publication_journal_name}, ${p.paper_publish_year})
DOI: ${p.doi}
Abstract: ${p.abstract.substring(0, 500)}`,
    )
    .join("\n\n");

  const prompt = `You are a science writer for hydrogenstudies.com, targeting educated laypeople and health practitioners.

Topic: "${topic}"

Research papers:
${paperSummaries}

Generate a blog-ready outline and draft. Return ONLY valid JSON:
{
  "background": "2-3 paragraph background on why this topic matters",
  "mechanisms": "Explain the molecular mechanisms in plain language (1-2 paragraphs)",
  "human_evidence": [
    {"outcome": "outcome category", "findings": "what the studies found (2-3 sentences)"},
    ...
  ],
  "animal_cell_evidence": "Brief summary of pre-clinical evidence (1 paragraph)",
  "limitations_and_gaps": "Honest assessment of limitations and research gaps",
  "cited_papers": [
    {"title": "...", "doi": "...", "snippet": "1-sentence key finding"},
    ...
  ],
  "draft_content": "A 600-1000 word draft blog post in plain English at 8th-grade reading level. Use headers, cite studies by author name and year, and include a 'Bottom Line' section."
}

Important:
- Write for an intelligent non-scientist audience
- Never make unsupported clinical claims
- Always distinguish between human trials and animal studies
- Include a disclaimer that this is educational, not medical advice`;

  try {
    const text = await ai.generateText("", prompt, {
      model: MODELS.OPUS,
      maxTokens: 3000,
      temperature: null,
      caller: "ConsensusApi.generateBlogOutline",
    });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");

    const outline: BlogOutline = JSON.parse(jsonMatch[0]);
    setCache(cacheKey, outline, topic);
    return outline;
  } catch (error) {
    console.error("Blog outline generation error:", error);
    return {
      background: `Research overview on ${topic} based on ${papers.length} studies.`,
      mechanisms: "AI generation failed. See individual papers.",
      human_evidence: papers.slice(0, 5).map((p) => ({
        outcome: p.paper_title,
        findings: p.abstract.substring(0, 200),
      })),
      animal_cell_evidence: "See individual studies.",
      limitations_and_gaps: "AI analysis unavailable.",
      cited_papers: papers.slice(0, 10).map((p) => ({
        title: p.paper_title,
        doi: p.doi,
        snippet: p.abstract.substring(0, 100),
      })),
      draft_content: "",
    };
  }
}

/**
 * Clear the cache for a specific key or all entries
 */
export function clearConsensusCache(prefix?: string): number {
  if (!prefix) {
    const size = cache.size;
    cache.clear();
    return size;
  }
  let cleared = 0;
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      cleared++;
    }
  }
  return cleared;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { entries: number; oldestMs: number } {
  let oldest = Date.now();
  for (const entry of Array.from(cache.values())) {
    if (entry.timestamp < oldest) oldest = entry.timestamp;
  }
  return {
    entries: cache.size,
    oldestMs: cache.size > 0 ? Date.now() - oldest : 0,
  };
}
