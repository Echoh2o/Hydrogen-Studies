/**
 * Rate Limiting Configuration
 * Protects expensive AI and search endpoints from abuse and controls costs
 */

import { Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// Custom error message handler
const rateLimitHandler = (req: Request, res: Response) => {
  res.status(429).json({
    success: false,
    error: "Too many requests",
    message:
      "You have exceeded the rate limit for this endpoint. Please wait and try again.",
    retryAfter: res.getHeader("Retry-After"),
  });
};

/** @internal Exported for testing. Skip rate limiting for admin users. */
export const skipForAdmin = (req: Request): boolean => {
  return req.session?.userRole === "admin";
};

/**
 * Shared skip predicate for all limiters: bypass entirely when E2E_DISABLE_RATE_LIMIT
 * is set (Playwright drives hundreds of same-IP requests and its HeadlessChrome UA
 * trips isBot(), so the page-GET limiter would 429 the SPA shell mid-run). This env
 * var is set ONLY in CI (.github/workflows/ci.yml), never in a deployed environment.
 * Otherwise defer to the admin skip.
 */
const skipRateLimit = (req: Request): boolean =>
  process.env.E2E_DISABLE_RATE_LIMIT === "1" || skipForAdmin(req);

/**
 * Rate-limit key: the REAL client IP (PLAN.md 0.2a).
 *
 * The site sits behind Cloudflare → Railway edge → app, and Express has
 * `trust proxy = 1` (one hop). That makes `req.ip` the right-most
 * X-Forwarded-For entry — a CLOUDFLARE COLO IP, not the visitor. Every
 * visitor routed through the same colo shared one bucket, which is how
 * Googlebot burned a "per-IP" budget it barely used (5×429 in a 40-request
 * burst — PLAN.md Appendix D).
 *
 * CF-Connecting-IP is set by Cloudflare and cannot be forged THROUGH
 * Cloudflare; on direct-to-Railway requests it's absent and we fall back to
 * req.ip (the socket-adjacent address Railway saw — also unforgeable). We
 * deliberately do NOT raise trust proxy to 2: on the direct path that would
 * let clients spoof X-Forwarded-For and dodge limits entirely.
 */
export const clientIpKey = (req: Request): string => {
  const ip = (req.headers["cf-connecting-ip"] as string) || req.ip || "";
  // ipKeyGenerator normalizes IPv6 to its /64 so one visitor can't rotate
  // through a subnet, and satisfies express-rate-limit v8's validation.
  return ip ? ipKeyGenerator(ip) : "unknown";
};

/**
 * General limiter ceiling — env-tunable (PLAN.md 0.2b), default 300/min.
 * The old hardcoded 100/min combined with the shared-bucket bug above meant
 * legitimate crawl bursts exhausted it.
 */
export const GENERAL_RATE_LIMIT_MAX = Math.max(
  1,
  parseInt(process.env.RATE_LIMIT_MAX || "300", 10) || 300,
);

/**
 * Strictest rate limit for AI/Generation endpoints
 * 5 requests per minute per IP
 */
export const aiGenerationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per window
  message:
    "AI generation rate limit exceeded. Maximum 5 requests per minute allowed.",
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: rateLimitHandler,
  keyGenerator: clientIpKey,
  skip: skipRateLimit,
});

/**
 * Rate limit for public AI-backed search endpoints
 * (natural-language search, parse/correct/intent, batch).
 * These invoke Claude per request but back a public search UI,
 * so allow more than aiGeneration while still bounding cost.
 * 10 requests per minute per IP
 */
export const aiSearchRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per window
  message:
    "AI search rate limit exceeded. Maximum 10 requests per minute allowed.",
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: clientIpKey,
  skip: skipRateLimit,
});

/**
 * Rate limit for the NL search typeahead (GET /api/search/nl-suggestions).
 * Same budget as search, but a DEDICATED instance so per-keystroke suggestion
 * traffic drains its own per-IP counter bucket instead of sharing (and
 * exhausting) the searchRateLimiter bucket used by core search reads.
 * 30 requests per minute per IP
 */
export const nlSuggestionsRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per window
  message:
    "Suggestions rate limit exceeded. Maximum 30 requests per minute allowed.",
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: clientIpKey,
  skip: skipRateLimit,
});

/**
 * Moderate rate limit for search endpoints
 * 30 requests per minute per IP
 */
export const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per window
  message:
    "Search rate limit exceeded. Maximum 30 requests per minute allowed.",
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: clientIpKey,
  skip: skipRateLimit,
});

/**
 * General API rate limit for other authenticated endpoints
 * 100 requests per minute per IP
 */
export const generalApiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: GENERAL_RATE_LIMIT_MAX, // env-tunable via RATE_LIMIT_MAX, default 300 (PLAN.md 0.2b)
  message:
    "General API rate limit exceeded. Please wait before trying again.",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: "Rate limit exceeded",
      message:
        "You have made too many requests. Please wait before trying again.",
      retryAfter: res.getHeader("Retry-After"),
    });
  },
  keyGenerator: clientIpKey,
  skip: skipRateLimit,
});

/**
 * Very strict rate limit for image generation endpoints
 * 3 requests per minute per IP (images are especially expensive)
 */
export const imageGenerationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 requests per window
  message:
    "Image generation rate limit exceeded. Maximum 3 requests per minute allowed.",
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: clientIpKey,
  skip: skipRateLimit,
});

/**
 * Rate limit for blog generation endpoints
 * 10 requests per hour per IP (blog generation is expensive and time-consuming)
 */
export const blogGenerationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per window
  message:
    "Blog generation rate limit exceeded. Maximum 10 blog generation requests per hour allowed.",
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: clientIpKey,
  skip: skipRateLimit,
});

/**
 * Create a custom rate limiter with specific configuration
 */
export function createCustomRateLimiter(
  windowMs: number,
  maxRequests: number,
  message: string,
) {
  return rateLimit({
    windowMs,
    max: maxRequests,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    keyGenerator: clientIpKey,
    skip: skipRateLimit,
  });
}

/**
 * Authentication rate limiter for login/register
 * 10 attempts per 15 minutes per IP (prevents brute force)
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message:
    "Too many authentication attempts. Please try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: clientIpKey,
  skip: skipRateLimit,
});

// Export rate limit configurations for logging/monitoring
export const rateLimitConfigs = {
  aiGeneration: { windowMs: 60 * 1000, max: 5, name: "AI Generation" },
  aiSearch: { windowMs: 60 * 1000, max: 10, name: "AI Search" },
  nlSuggestions: {
    windowMs: 60 * 1000,
    max: 30,
    name: "NL Search Suggestions",
  },
  search: { windowMs: 60 * 1000, max: 30, name: "Search" },
  generalApi: { windowMs: 60 * 1000, max: 100, name: "General API" },
  imageGeneration: { windowMs: 60 * 1000, max: 3, name: "Image Generation" },
  blogGeneration: {
    windowMs: 60 * 60 * 1000,
    max: 10,
    name: "Blog Generation",
  },
  auth: { windowMs: 15 * 60 * 1000, max: 10, name: "Authentication" },
};
