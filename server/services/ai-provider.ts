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

// --- Anthropic (Claude) for text generation ---

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic | null {
  if (anthropicClient) return anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ ANTHROPIC_API_KEY not configured — AI text generation will use OpenAI fallback");
    return null;
  }
  anthropicClient = new Anthropic({ apiKey });
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
  temperature?: number;
  model?: string; // override model — use MODELS.HAIKU for cheap tasks
  /**
   * Thinking depth / token-spend tradeoff (Sonnet 4.6 & Opus only; ignored on
   * Haiku 4.5, which has no effort param). Sonnet 4.6 defaults to "high" — set
   * "low" for short extraction/summary tasks to cut tokens + latency.
   */
  effort?: "low" | "medium" | "high";
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

/**
 * Generate a text response from AI.
 * Tries Anthropic first, falls back to OpenAI if not configured.
 */
async function generateText(
  systemPrompt: string,
  userPrompt: string,
  options: AIGenerateOptions = {},
): Promise<string> {
  const { maxTokens = 4096, temperature = 0.3, model, effort } = options;

  // Try Anthropic first
  const claude = getAnthropic();
  if (claude) {
    const resolvedModel = model || MODELS.SONNET;
    // Opus 4.7+ reject sampling params (temperature/top_p/top_k → 400).
    const acceptsTemperature = !/^claude-opus-4-(7|8)/.test(resolvedModel);
    // Haiku 4.5 has no effort param (would error); Sonnet 4.6 / Opus support it.
    const acceptsEffort = !/haiku/.test(resolvedModel);
    const response = await claude.messages.create({
      model: resolvedModel,
      max_tokens: maxTokens,
      ...(acceptsTemperature ? { temperature } : {}),
      ...(acceptsEffort && effort ? { output_config: { effort } } : {}),
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = response.content[0];
    return block.type === "text" ? block.text : "";
  }

  // Fallback to OpenAI
  const oai = getOpenAI();
  if (!oai) throw new Error("No AI provider configured (set ANTHROPIC_API_KEY or OPENAI_API_KEY)");

  const response = await oai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature,
  });
  return response.choices[0].message.content || "";
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
