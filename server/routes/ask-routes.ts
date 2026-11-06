/**
 * POST /api/ask — "Ask the research" (TRUST-BADGE-PLAN Phase 3). Off unless
 * ASK_ENABLED=true (copy approval first). Mounted before the CORS allowlist so
 * the echowater.com widget can call it; CORS is limited to the two sites.
 */
import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { askResearch, type AskSite } from "../services/ask-research";
import { ASK } from "../../shared/evidence-badge-copy";
import { logger } from "../utils/logger";
import rateLimit from "express-rate-limit";
import { clientIpKey } from "../utils/rate-limiting";

/** Same budget as /api/chat: 20 questions per hour per real client IP. */
export const askRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKey,
  message: { error: "Too many questions. Please try again later." },
});

const router = Router();
const ORIGINS = new Set(["https://echowater.com", "https://www.echowater.com", "https://business.echowater.com", "https://hydrogenstudies.com", "https://www.hydrogenstudies.com"]);
const DAILY_LIMIT = Number(process.env.ASK_DAILY_LIMIT || 2000);
const SALT = process.env.ASK_HASH_SALT || "hs-ask";

export function scrubPII(q: string): string {
  return q
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[number]")
    .slice(0, 500);
}

function cors(req: Request, res: Response): void {
  const origin = String(req.headers.origin ?? "");
  if (ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
}

router.options("/api/ask", (req, res) => {
  cors(req, res);
  res.status(204).end();
});

router.post("/api/ask", async (req: Request, res: Response) => {
  cors(req, res);
  if (process.env.ASK_ENABLED !== "true") return res.status(503).json({ error: ASK.disabled });
  const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
  if (question.length < 3 || question.length > 500) return res.status(400).json({ error: "Ask a question of 3–500 characters." });
  const site: AskSite = req.body?.site === "echowater" ? "echowater" : "hydrogenstudies";
  const product = typeof req.body?.product === "string" ? req.body.product.slice(0, 60) : null;
  const page = typeof req.body?.page === "string" ? req.body.page.slice(0, 200) : null;
  try {
    const today = await db.execute(sql`SELECT count(*)::int AS n FROM ask_log WHERE created_at > now() - interval '1 day'`);
    if (Number((today.rows?.[0] as any)?.n ?? 0) >= DAILY_LIMIT) return res.status(429).json({ error: ASK.limit });
    const result = await askResearch(question, site);
    const ipHash = crypto.createHash("sha256").update(`${SALT}:${new Date().toISOString().slice(0, 10)}:${req.ip}`).digest("hex").slice(0, 16);
    await db.execute(sql`
      INSERT INTO ask_log (site, product, page, question, intent, status, cited_ids, retrieved_ids, ip_day_hash)
      VALUES (${site}, ${product}, ${page}, ${scrubPII(question)}, ${result.intent}, ${result.status},
              ${`{${result.citations.map((c) => c.id).join(",")}}`}::int[], ${`{${result.studies.map((s) => s.id).join(",")}}`}::int[], ${ipHash})`);
    if (Math.random() < 0.01) void db.execute(sql`DELETE FROM ask_log WHERE created_at < now() - interval '180 days'`).catch(() => {});
    res.json(result);
  } catch (err) {
    logger.error("ask failed", err, "Ask");
    res.status(503).json({ error: "Temporarily unavailable" });
  }
});

export default router;
