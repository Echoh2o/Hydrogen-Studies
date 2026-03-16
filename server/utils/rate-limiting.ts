/**
 * Rate Limiting Configuration
 * Protects expensive AI and search endpoints from abuse and controls costs
 */

import { Request, Response } from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";

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
  // Check session-based admin role first
  if (req.session?.userRole === "admin") {
    return true;
  }
  // Fallback: timing-safe comparison for admin bypass token
  const adminToken = req.headers["x-admin-token"];
  const expectedToken = process.env.ADMIN_BYPASS_TOKEN;
  if (!adminToken || !expectedToken || typeof adminToken !== "string") {
    return false;
  }
  try {
    return crypto.timingSafeEqual(
      Buffer.from(adminToken),
      Buffer.from(expectedToken),
    );
  } catch {
    return false;
  }
};

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
  skip: skipForAdmin,
  keyGenerator: (req: Request) => {
    // Use IP address for rate limiting
    return req.ip || req.socket.remoteAddress || "unknown";
  },
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
  skip: skipForAdmin,
  keyGenerator: (req: Request) => {
    return req.ip || req.socket.remoteAddress || "unknown";
  },
});

/**
 * General API rate limit for other authenticated endpoints
 * 100 requests per minute per IP
 */
export const generalApiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per window
  message:
    "General API rate limit exceeded. Maximum 100 requests per minute allowed.",
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
  keyGenerator: (req: Request) => {
    return req.ip || req.socket.remoteAddress || "unknown";
  },
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
  skip: skipForAdmin,
  keyGenerator: (req: Request) => {
    return req.ip || req.socket.remoteAddress || "unknown";
  },
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
  skip: skipForAdmin,
  keyGenerator: (req: Request) => {
    return req.ip || req.socket.remoteAddress || "unknown";
  },
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
    keyGenerator: (req: Request) => {
      return req.ip || req.socket.remoteAddress || "unknown";
    },
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
  keyGenerator: (req: Request) => {
    return req.ip || req.socket.remoteAddress || "unknown";
  },
});

// Export rate limit configurations for logging/monitoring
export const rateLimitConfigs = {
  aiGeneration: { windowMs: 60 * 1000, max: 5, name: "AI Generation" },
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
