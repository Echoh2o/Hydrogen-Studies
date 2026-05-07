import { Router, Request, Response } from "express";
import { db } from "../db";
import { contactMessages } from "@shared/schema";
import { generalApiRateLimiter } from "../utils/rate-limiting";
import { sanitizeUserText } from "../utils/sanitize";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { requireAdmin } from "../auth";

const router = Router();

// sanitizeUserText (utils/sanitize.ts) is the single tag-stripping
// implementation; importing here keeps contact-form behavior aligned
// with any future public-input endpoints that also need it.

const contactSchema = z.object({
  // After sanitization the message has to still satisfy length minimums,
  // so .transform() runs first and the .min() check applies to the
  // cleaned string. Same idea on the other text fields.
  name: z.string().max(200).transform(sanitizeUserText).pipe(z.string().min(2).max(200)),
  email: z
    .string()
    .max(200)
    .email()
    // Email addresses don't contain tags, but we still trim and lowercase
    // to keep the stored value consistent regardless of how the user typed it.
    .transform((s) => s.trim().toLowerCase()),
  subject: z
    .string()
    .max(200)
    .transform(sanitizeUserText)
    .pipe(z.string().max(200))
    .optional(),
  message: z
    .string()
    .max(5000)
    .transform(sanitizeUserText)
    .pipe(z.string().min(10).max(5000)),
  phone: z
    .string()
    .max(30)
    .transform((s) => s.replace(/[^\d+\-\s()]/g, "").trim())
    .optional(),
});

/**
 * POST /api/contact
 * Submit a contact form message — stores in database
 */
router.post("/", generalApiRateLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid form data",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, email, message } = parsed.data;

    await db.insert(contactMessages).values({
      name,
      email,
      message: `${parsed.data.subject ? `[${parsed.data.subject}] ` : ""}${message}${parsed.data.phone ? `\n\nPhone: ${parsed.data.phone}` : ""}`,
    });

    res.json({ success: true, message: "Message received. We'll respond within 24-48 hours." });
  } catch (error) {
    console.error("Contact form error:", error);
    res.status(500).json({ success: false, error: "Failed to send message. Please try again." });
  }
});

/**
 * GET /api/contact
 * Admin-only: list contact messages
 */
router.get("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const messages = await db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(100);
    res.json({ success: true, data: messages });
  } catch (error) {
    console.error("Error fetching contact messages:", error);
    res.status(500).json({ success: false, error: "Failed to fetch messages" });
  }
});

export default router;
