import { Router, Request, Response } from "express";
import { db } from "../db";
import { contactMessages } from "@shared/schema";
import { generalApiRateLimiter } from "../utils/rate-limiting";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { requireAdmin } from "../auth";

const router = Router();

const contactSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email().max(200),
  subject: z.string().min(1).max(200).optional(),
  message: z.string().min(10).max(5000),
  phone: z.string().max(30).optional(),
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
