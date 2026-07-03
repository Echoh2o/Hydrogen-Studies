/**
 * Shared study-TLDR generation.
 *
 * Deduplicates the TL;DR prompt + Anthropic call that was copy-pasted across
 * job-scheduler, content-generation-worker, study-lifecycle, and the studies
 * controller's batch endpoint. All sites shared the same prompt body; some
 * prefixed it with a "science communicator" persona sentence and some used a
 * different model tier — both are preserved via options so each call site keeps
 * its exact previous prompt bytes and model choice.
 *
 * Depends only on ai-provider (no service imports), so job-scheduler and
 * content-generation-worker can both import it without an import cycle.
 */

import { ai, MODELS, type AIGenerateOptions } from "./ai-provider";

export interface TldrStudyInput {
  title: string | null;
  abstract: string | null;
  conclusion?: string | null;
}

export interface TldrOptions {
  /** Model to use — defaults to Haiku (batch/background tier). */
  model?: string;
  /** Effort setting (Sonnet/Opus only) — pass "low" where the site used it. */
  effort?: AIGenerateOptions["effort"];
  /**
   * Whether to prepend "You are a science communicator. " to the prompt.
   * job-scheduler / study-lifecycle / batch controller used it; the
   * content-generation-worker copy did not. Defaults to true.
   */
  includePersona?: boolean;
  /** Call-site tag for usage logging. */
  caller?: string;
}

/**
 * Generate a 1-2 sentence plain-language TL;DR for a study.
 * Returns null when the model produced an empty/whitespace-only text block.
 * Throws on API errors or malformed (no-text-block) responses.
 */
export async function generateStudyTldr(
  study: TldrStudyInput,
  options: TldrOptions = {},
): Promise<string | null> {
  const { model = MODELS.HAIKU, effort, includePersona = true, caller } = options;

  const persona = includePersona ? "You are a science communicator. " : "";
  const prompt = `${persona}Write a TL;DR summary of this study in 1-2 simple sentences. Use plain language a 6th grader could understand. Focus on the key finding and why it matters. No jargon. Be conversational.\n\nStudy title: ${study.title}\nAbstract: ${study.abstract}\n${study.conclusion ? `Conclusion: ${study.conclusion}` : ""}\n\nWrite ONLY the TL;DR text, nothing else.`;

  const text = await ai.generateText("", prompt, {
    model,
    maxTokens: 200,
    // Direct SDK call sites never sent a temperature — keep provider default.
    temperature: null,
    ...(effort ? { effort } : {}),
    ...(caller ? { caller } : {}),
  });

  const tldr = text.trim();
  return tldr || null;
}
