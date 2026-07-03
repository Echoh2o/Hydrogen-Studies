/**
 * AI Provider Abstraction Layer
 *
 * Central service for all AI text generation.
 * Uses Anthropic (Claude) by default, with xAI (Grok) for image generation
 * and OpenAI as fallback.
 *
 * Usage:
 *   import { ai } from "../services/ai-provider";
 *   const result = await ai.generateJSON(systemPrompt, userPrompt);
 *   const text = await ai.generateText(systemPrompt, userPrompt);
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { logger } from "../utils/logger";

// --- Anthropic (Claude) for text generation ---

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic | null {
  if (anthropicClient) return anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ ANTHROPIC_API_KEY not configured — AI text generation will use OpenAI fallback");
    return null;
  }
  // 60s default timeout (SDK default is 10 min — far too long for our short
  // generation calls); per-request timeout is raised for large max_tokens below.
  // maxRetries: 2 = SDK retries 408/429/5xx + connection errors with backoff.
  anthropicClient = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 2 });
  return anthropicClient;
}

// --- xAI (Grok) for image generation ---

let xaiClient: OpenAI | null = null;

function getXAI(): OpenAI | null {
  if (xaiClient) return xaiClient;
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  xaiClient = new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1", timeout: 60000, maxRetries: 2 });
  return xaiClient;
}

// --- OpenAI fallback for text and images ---

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ OPENAI_API_KEY not configured — OpenAI fallback unavailable");
    return null;
  }
  openaiClient = new OpenAI({ apiKey, timeout: 30000, maxRetries: 2 });
  return openaiClient;
}

// --- Public API ---

export interface AIGenerateOptions {
  maxTokens?: number;
  /**
   * Sampling temperature. Defaults to 0.3. Pass `null` to omit the parameter
   * entirely (provider default sampling). Automatically stripped on Opus 4.7/4.8,
   * which reject sampling params.
   */
  temperature?: number | null;
  model?: string; // override model — use MODELS.HAIKU for cheap tasks
  /**
   * Thinking depth / token-spend tradeoff (Sonnet 4.6 & Opus only; ignored on
   * Haiku 4.5, which has no effort param). Sonnet 4.6 defaults to "high" — set
   * "low" for short extraction/summary tasks to cut tokens + latency.
   */
  effort?: "low" | "medium" | "high";
  /** Call-site tag included in usage logs (e.g. "JobScheduler.tldr"). */
  caller?: string;
  /** Optional AbortSignal passed through to the underlying HTTP request. */
  signal?: AbortSignal;
}

// Model constants for cost optimization
export const MODELS = {
  /** Balanced model for general generation (blog content, analysis, TLDRs) */
  SONNET: "claude-sonnet-4-6",
  /** Most capable model — research synthesis / long-horizon quality work */
  OPUS: "claude-opus-4-8",
  /** Fast, cheap model (~90% cheaper) for extraction, parsing, short summaries */
  HAIKU: "claude-haiku-4-5",
  /** xAI image model — configurable via XAI_IMAGE_MODEL env var */
  XAI_IMAGE: process.env.XAI_IMAGE_MODEL || "grok-imagine-image",
  /** OpenAI image model */
  OPENAI_IMAGE: "dall-e-3",
} as const;

/** Get the correct image model name for the given provider */
export function getImageModel(provider: "xai" | "openai"): string {
  return provider === "xai" ? MODELS.XAI_IMAGE : MODELS.OPENAI_IMAGE;
}

/** Get the preferred image client + provider. Prefers OpenAI (more reliable). */
export function getPreferredImageClient(): { client: OpenAI; provider: "xai" | "openai" } | null {
  const openai = getOpenAI();
  if (openai) return { client: openai, provider: "openai" };
  const xai = getXAI();
  if (xai) return { client: xai, provider: "xai" };
  return null;
}

/** Anthropic statuses worth failing over on (after the SDK's own retries). */
const RETRYABLE_ANTHROPIC_STATUSES = new Set([429, 500, 502, 503, 529]);

function isRetryableAnthropicError(err: unknown): boolean {
  // Connection errors (no HTTP response at all) are always retryable.
  if (err instanceof Anthropic.APIConnectionError) return true;
  if (err instanceof Anthropic.APIError) {
    return typeof err.status === "number" && RETRYABLE_ANTHROPIC_STATUSES.has(err.status);
  }
  return false;
}

async function generateTextWithAnthropic(
  claude: Anthropic,
  systemPrompt: string,
  userPrompt: string,
  options: AIGenerateOptions,
): Promise<string> {
  const { maxTokens = 4096, temperature = 0.3, model, effort, caller, signal } = options;
  const resolvedModel = model || MODELS.SONNET;
  // Opus 4.7+ reject sampling params (temperature/top_p/top_k → 400).
  const acceptsTemperature = !/^claude-opus-4-(7|8)/.test(resolvedModel);
  // Haiku 4.5 has no effort param (would error); Sonnet 4.6 / Opus support it.
  const acceptsEffort = !/haiku/.test(resolvedModel);
  // Long-form outputs (blog drafts, Opus synthesis) legitimately run past 60s;
  // give those requests 120s while keeping the tight 60s default for short calls.
  const timeout = maxTokens > 2048 ? 120_000 : 60_000;

  const response = await claude.messages.create(
    {
      model: resolvedModel,
      max_tokens: maxTokens,
      ...(acceptsTemperature && temperature !== null ? { temperature } : {}),
      ...(acceptsEffort && effort ? { output_config: { effort } } : {}),
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: "user", content: userPrompt }],
    },
    { timeout, ...(signal ? { signal } : {}) },
  );

  logger.info("Anthropic usage", "AIProvider", {
    model: resolvedModel,
    ...(caller ? { caller } : {}),
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  // With output_config.effort enabled, responses can lead with non-text blocks —
  // find the text block instead of assuming content[0], and THROW (never return
  // "") so pipeline callers can't store empty content and mark steps completed.
  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  if (!textBlock) {
    const blockTypes = response.content.map((b) => b.type).join(", ") || "none";
    throw new Error(
      `Anthropic response from ${resolvedModel} contained no text block ` +
        `(blocks: [${blockTypes}], stop_reason: ${response.stop_reason})`,
    );
  }
  return textBlock.text;
}

async function generateTextWithOpenAI(
  systemPrompt: string,
  userPrompt: string,
  options: AIGenerateOptions,
): Promise<string> {
  const { maxTokens = 4096, temperature = 0.3, signal } = options;
  const oai = getOpenAI();
  if (!oai) throw new Error("No AI provider configured (set ANTHROPIC_API_KEY or OPENAI_API_KEY)");

  const response = await oai.chat.completions.create(
    {
      model: "gpt-4o",
      messages: [
        ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
        { role: "user" as const, content: userPrompt },
      ],
      max_tokens: maxTokens,
      ...(temperature !== null ? { temperature } : {}),
    },
    signal ? { signal } : undefined,
  );
  return response.choices[0].message.content || "";
}

/**
 * Generate a text response from AI.
 * Tries Anthropic first; falls back to OpenAI when Anthropic is not configured
 * OR when Anthropic fails with a retryable error (429/5xx/529 or connection
 * failure) after the SDK's own retries. Non-retryable errors (400/401/403 —
 * caller bugs / config errors) are always rethrown.
 */
async function generateText(
  systemPrompt: string,
  userPrompt: string,
  options: AIGenerateOptions = {},
): Promise<string> {
  const claude = getAnthropic();
  if (claude) {
    try {
      return await generateTextWithAnthropic(claude, systemPrompt, userPrompt, options);
    } catch (err) {
      if (isRetryableAnthropicError(err) && getOpenAI()) {
        logger.warn(
          "Anthropic request failed after retries — falling back to OpenAI",
          "AIProvider",
          {
            model: options.model || MODELS.SONNET,
            ...(options.caller ? { caller: options.caller } : {}),
            status: err instanceof Anthropic.APIError ? err.status : undefined,
            error: err instanceof Error ? err.message : String(err),
          },
        );
        // fall through to OpenAI below
      } else {
        throw err;
      }
    }
  }

  return generateTextWithOpenAI(systemPrompt, userPrompt, options);
}

/**
 * Generate a JSON response from AI.
 * Automatically instructs the model to return valid JSON and parses the result.
 */
async function generateJSON<T = any>(
  systemPrompt: string,
  userPrompt: string,
  options: AIGenerateOptions = {},
): Promise<T> {
  const jsonSystemPrompt = `${systemPrompt}\n\nIMPORTANT: You must respond with ONLY valid JSON. No markdown, no code fences, no explanation outside the JSON.`;

  const raw = await generateText(jsonSystemPrompt, userPrompt, options);

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (parseError) {
    console.error("[AI] JSON parse failed. Raw response (first 500 chars):", cleaned.substring(0, 500));
    // Try to extract JSON from the response (AI sometimes wraps it in text)
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as T;
      } catch {
        // fall through
      }
    }
    throw new Error(`AI returned invalid JSON: ${(parseError as Error).message}`);
  }
}

/**
 * Get the OpenAI client directly (for fallback image generation with DALL-E).
 * Returns null if not configured.
 */
function getOpenAIClient(): OpenAI | null {
  return getOpenAI();
}

/**
 * Get the xAI client directly (for image generation with Grok).
 * Returns null if XAI_API_KEY is not configured.
 */
function getXAIClient(): OpenAI | null {
  return getXAI();
}

/**
 * Check which AI providers are available
 */
function getProviderStatus() {
  return {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    xai: !!process.env.XAI_API_KEY,
    primary: process.env.ANTHROPIC_API_KEY ? "anthropic" : process.env.OPENAI_API_KEY ? "openai" : "none",
    imageProvider: process.env.XAI_API_KEY ? "xai" : process.env.OPENAI_API_KEY ? "openai" : "none",
  };
}

export const ai = {
  generateText,
  generateJSON,
  getOpenAIClient,
  getXAIClient,
  getProviderStatus,
};
