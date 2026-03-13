/**
 * Newsletter Routes — Public API for newsletter signup
 *
 * Connects the frontend newsletter form to Klaviyo.
 * No authentication required — this is a public endpoint.
 */

import { Router, Request, Response } from "express";
import { subscribeToNewsletter, isKlaviyoConfigured } from "../services/klaviyo-api";

const router = Router();

/**
 * POST /api/newsletter/subscribe
 * Subscribe an email to the newsletter
 * Body: { email: string, firstName?: string, lastName?: string }
 */
router.post("/subscribe", async (req: Request, res: Response) => {
  try {
    const { email, firstName, lastName, source } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    if (!isKlaviyoConfigured()) {
      // If Klaviyo isn't configured, still acknowledge (don't break the UX)
      console.log(`[Newsletter] Signup received but Klaviyo not configured: ${email}`);
      return res.json({
        success: true,
        message: "Thank you for subscribing! You'll receive our latest hydrogen research updates.",
      });
    }

    const result = await subscribeToNewsletter(email.trim(), {
      firstName,
      lastName,
      source: source || "website_footer_newsletter",
    });

    if (result.success) {
      res.json({
        success: true,
        message: "Thank you for subscribing! You'll receive our latest hydrogen research updates.",
      });
    } else {
      // Don't expose internal errors to user
      console.error("[Newsletter] Subscribe failed:", result.error);
      res.json({
        success: true,
        message: "Thank you for subscribing! You'll receive our latest hydrogen research updates.",
      });
    }
  } catch (error) {
    console.error("[Newsletter] Subscribe error:", error);
    // Always show success to user (don't break UX for backend issues)
    res.json({
      success: true,
      message: "Thank you for subscribing!",
    });
  }
});

/**
 * GET /api/newsletter/status
 * Check if newsletter integration is configured (admin use)
 */
router.get("/status", (req: Request, res: Response) => {
  res.json({
    configured: isKlaviyoConfigured(),
    provider: "klaviyo",
  });
});

export default router;
