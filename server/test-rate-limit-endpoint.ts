/**
 * Test endpoint for rate limiting verification
 */

import { Router } from "express";

const router = Router();

// Test endpoint for verifying rate limiting
router.get("/rate-limit", (req, res) => {
  console.log("[TEST ENDPOINT] Request received");
  res.json({
    success: true,
    message: "Test endpoint for rate limiting",
    timestamp: new Date().toISOString(),
    headers: {
      "x-ratelimit-limit": res.get("X-RateLimit-Limit"),
      "x-ratelimit-remaining": res.get("X-RateLimit-Remaining"),
      "x-ratelimit-reset": res.get("X-RateLimit-Reset"),
    },
  });
});

// Test endpoint for POST requests
router.post("/rate-limit", (req, res) => {
  console.log("[TEST ENDPOINT] POST request received");
  res.json({
    success: true,
    message: "POST test endpoint for rate limiting",
    timestamp: new Date().toISOString(),
    csrfToken: res.locals.csrfToken,
  });
});

export default router;
