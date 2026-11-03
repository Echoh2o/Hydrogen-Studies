/**
 * isBot scopes the crawler rate limiter only (PLAN 3.4) — it never changes
 * what a visitor is served. AI assistants' fetchers must be recognised so
 * the limiter treats them like search crawlers.
 */
import { describe, it, expect } from "vitest";
import { isBot } from "../utils/user-agent";

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

describe("isBot — crawler detection", () => {
  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "GPTBot/1.2 (+https://openai.com/gptbot)",
    "OAI-SearchBot/1.0; +https://openai.com/searchbot",
    "ChatGPT-User/1.0; +https://openai.com/bot",
    "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    "Mozilla/5.0 (compatible; Claude-Web/1.0)",
    "anthropic-ai/1.0",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +Claude-SearchBot@anthropic.com)",
    "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
    "Perplexity-User/1.0",
    "CCBot/2.0 (https://commoncrawl.org/faq/)",
    "meta-externalagent/1.1",
    "Mozilla/5.0 (compatible; AhrefsSiteAudit/6.1; +http://ahrefs.com/robot/site-audit)",
    "Mozilla/5.0 (compatible; SiteAuditBot/0.97; +http://www.semrush.com/bot.html)",
  ])("treats %s as a bot", (ua) => {
    expect(isBot(ua)).toBe(true);
  });

  it("does not treat a normal browser as a bot", () => {
    expect(isBot(CHROME)).toBe(false);
    expect(isBot("")).toBe(false);
  });
});
