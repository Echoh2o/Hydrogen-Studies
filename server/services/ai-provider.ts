/**
 * AI Provider Abstraction Layer
 *
 * Central service for all AI text generation.
 * Uses Anthropic (Claude) by default, with OpenAI available for image generation.
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

// --- OpenAI fallback for text, primary for images ---

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ OPENAI_API_KEY not configured — image generation unavailable");
    return null;
  }
  openaiClient = new OpenAI({ apiKey, timeout: 30000, maxRetries: 2 });
  return openaiClient;
}

// --- Public API ---

export interface AIGenerateOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string; // override model (e.g. "claude-sonnet-4-20250514" for cheaper tasks)
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
  const { maxTokens = 4096, temperature = 0.3, model } = options;

  // Try Anthropic first
  const claude = getAnthropic();
  if (claude) {
    const response = await claude.messages.create({
      model: model || "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      temperature,
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
 * Get the OpenAI client directly (for image generation with DALL-E).
 * Returns null if not configured.
 */
function getOpenAIClient(): OpenAI | null {
  return getOpenAI();
}

/**
 * Check which AI providers are available
 */
function getProviderStatus() {
  return {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    primary: process.env.ANTHROPIC_API_KEY ? "anthropic" : process.env.OPENAI_API_KEY ? "openai" : "none",
  };
}

export const ai = {
  generateText,
  generateJSON,
  getOpenAIClient,
  getProviderStatus,
};
