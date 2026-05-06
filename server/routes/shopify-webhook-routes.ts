/**
 * Shopify Integration — Auto-create user accounts when customers register on echowater.com
 *
 * Listens for Shopify customer/create webhooks and automatically creates
 * a Hydrogen Studies account with the "customer" role.
 *
 * Setup:
 * 1. Set SHOPIFY_WEBHOOK_SECRET in environment (from Shopify webhook settings)
 * 2. In Shopify admin → Settings → Notifications → Webhooks:
 *    - Add webhook for "Customer creation"
 *    - URL: https://hydrogenstudies.com/api/webhooks/shopify/customer-created
 *    - Format: JSON
 * 3. Copy the webhook signing secret to SHOPIFY_WEBHOOK_SECRET
 *
 * Also provides:
 * - POST /api/webhooks/shopify/customer-updated — sync profile changes
 */

import { Router, Request, Response } from "express";
import crypto from "crypto";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../utils/logger";
import { syncShopifyCustomerPayload, backfillShopifyCustomers } from "../services/shopify-customer-sync";
import { shopifyApiConfigured } from "../services/shopify-client";
import { requireAdmin } from "../auth";
import { count, sql } from "drizzle-orm";

const router = Router();

/**
 * Verify Shopify webhook HMAC signature
 */
function verifyShopifyWebhook(rawBody: Buffer, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      logger.error("SHOPIFY_WEBHOOK_SECRET not configured in production — rejecting webhook", undefined, "Shopify");
      return false;
    }
    logger.warn("SHOPIFY_WEBHOOK_SECRET not configured, skipping verification in development", "Shopify");
    return true;
  }

  const computed = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");

  return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(hmacHeader),
  );
}

/**
 * POST /api/webhooks/shopify/customer-created
 * Called by Shopify when a new customer registers on echowater.com.
 *
 * The actual account creation lives in syncShopifyCustomerPayload —
 * this handler just verifies the signature and translates the result
 * into a 200 response. Same upsert function is reused by backfill +
 * the reconciliation cron so behavior stays consistent.
 */
router.post("/customer-created", async (req: Request, res: Response) => {
  try {
    const hmacHeader = req.headers["x-shopify-hmac-sha256"] as string;
    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (process.env.SHOPIFY_WEBHOOK_SECRET) {
      if (!hmacHeader) {
        logger.warn("Missing HMAC header", "Shopify");
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (!rawBody) {
        logger.error("Raw body not available for HMAC verification", undefined, "Shopify");
        return res.status(500).json({ error: "Webhook verification failed" });
      }
      if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
        logger.warn("Invalid HMAC signature on customer-created webhook", "Shopify");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const customer = req.body;
    logger.info("Customer created webhook received", "Shopify", {
      email: customer?.email,
      shopifyCustomerId: customer?.id,
    });

    const result = await syncShopifyCustomerPayload(customer);
    if (result.status === "error") {
      // Return 200 anyway so Shopify doesn't retry — we've already
      // logged the error and a future cron run will pick it up.
      return res.status(200).json({ status: "error", message: result.error });
    }
    res.status(200).json(result);
  } catch (error) {
    logger.error("Customer created webhook error", error, "Shopify");
    res.status(200).json({ status: "error", message: "Internal error" });
  }
});

/**
 * POST /api/webhooks/shopify/customer-updated
 * Called by Shopify when a customer updates their profile
 */
router.post("/customer-updated", async (req: Request, res: Response) => {
  try {
    // Verify webhook signature
    const hmacHeader = req.headers["x-shopify-hmac-sha256"] as string;
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (process.env.SHOPIFY_WEBHOOK_SECRET) {
      if (!hmacHeader) {
        logger.warn("Missing HMAC header on customer-updated", "Shopify");
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (!rawBody || !verifyShopifyWebhook(rawBody, hmacHeader)) {
        logger.warn("Invalid HMAC signature on customer-updated webhook", "Shopify");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const customer = req.body;
    if (!customer || !customer.email) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const email = customer.email.toLowerCase().trim();

    // Find matching user
    const [existingUser] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!existingUser) {
      // Customer doesn't have an account here — nothing to update
      return res.status(200).json({ status: "no_match" });
    }

    logger.info("Customer updated", "Shopify", { email });

    // We could update profile fields here if needed
    // For now, just acknowledge
    res.status(200).json({ status: "acknowledged" });
  } catch (error) {
    logger.error("Customer updated webhook error", error, "Shopify");
    res.status(200).json({ status: "error" });
  }
});

/**
 * POST /api/webhooks/shopify/order-created
 * Optional: track when a customer makes a purchase (could upgrade access level)
 */
router.post("/order-created", async (req: Request, res: Response) => {
  try {
    // Verify webhook signature
    const hmacHeader = req.headers["x-shopify-hmac-sha256"] as string;
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (process.env.SHOPIFY_WEBHOOK_SECRET) {
      if (!hmacHeader) {
        logger.warn("Missing HMAC header on order-created", "Shopify");
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (!rawBody || !verifyShopifyWebhook(rawBody, hmacHeader)) {
        logger.warn("Invalid HMAC signature on order-created webhook", "Shopify");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const order = req.body;
    if (!order || !order.email) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    logger.info("Order created", "Shopify", {
      email: order.email,
      totalPrice: order.total_price,
    });

    // Reuse the shared sync. Pass minimal fields — order webhooks don't
    // include a `customer.id`, just an email + customer object embedded
    // in the order payload. The sync function handles missing fields.
    const customerLike = {
      id: order.customer?.id ?? null,
      email: order.email,
      first_name: order.customer?.first_name ?? null,
      last_name: order.customer?.last_name ?? null,
    };
    const result = await syncShopifyCustomerPayload(customerLike);
    res.status(200).json({ status: "acknowledged", sync: result });
  } catch (error) {
    logger.error("Order webhook error", error, "Shopify");
    res.status(200).json({ status: "error" });
  }
});

// ── Admin-facing endpoints (NOT webhook callbacks) ─────────────
//
// Mounted on the same /api/webhooks/shopify prefix for grouping. They
// require requireAdmin so they're not callable from Shopify or the
// public.

/**
 * GET /api/webhooks/shopify/sync-status
 * Returns Shopify-customer-account stats so the admin can see at a
 * glance whether the sync is actually working.
 */
router.get("/sync-status", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [counts]: any = await db
      .select({
        total: count(users.id),
      })
      .from(users)
      .where(sql`${users.role} = 'customer'`);

    const recent = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(sql`${users.role} = 'customer'`)
      .orderBy(sql`${users.createdAt} DESC`)
      .limit(10);

    res.json({
      apiConfigured: shopifyApiConfigured(),
      webhookSecretConfigured: Boolean(process.env.SHOPIFY_WEBHOOK_SECRET),
      totalCustomerAccounts: Number(counts?.total ?? 0),
      mostRecent: recent,
    });
  } catch (err) {
    console.error("Shopify sync-status error:", err);
    res.status(500).json({ error: "Failed to fetch sync status" });
  }
});

/**
 * POST /api/webhooks/shopify/backfill
 * Body: { since?: string (ISO date), max?: number }
 *
 * Triggers the historical-customer backfill. Fire-and-forget — long
 * operations would trip the client's 30s fetch timeout (a 30k-customer
 * backfill takes ~3 minutes against Shopify's 2 req/sec budget). The
 * client gets 202 immediately; results show up in /sync-status as the
 * customer count climbs.
 *
 * Concurrent invocations are gated by an in-process flag so a click
 * spam doesn't kick off 5 parallel backfills against the same Shopify
 * data.
 */
let backfillInProgress = false;

router.post("/backfill", requireAdmin, async (req: Request, res: Response) => {
  if (backfillInProgress) {
    return res.status(409).json({ error: "Backfill already running, please wait" });
  }
  if (!shopifyApiConfigured()) {
    return res.status(400).json({
      error: "SHOPIFY_ACCESS_TOKEN and SHOPIFY_STORE_URL must be set in env",
    });
  }

  const since = typeof req.body?.since === "string" ? new Date(req.body.since) : undefined;
  const max = typeof req.body?.max === "number" ? req.body.max : undefined;
  if (since && isNaN(since.getTime())) {
    return res.status(400).json({ error: "Invalid `since` date" });
  }

  backfillInProgress = true;
  // Fire and forget. The .then/.catch are defensive — backfill itself
  // catches per-customer errors, but this guards against a top-level
  // crash leaving backfillInProgress stuck.
  backfillShopifyCustomers({
    updatedAtMin: since,
    maxCustomers: max,
    progressEvery: 100,
    onProgress: (s) => {
      console.log(
        `[Shopify backfill] processed=${s.processed} created=${s.created} ` +
          `existed=${s.existed} errors=${s.errors}`,
      );
    },
  })
    .then((summary) => {
      console.log(
        `[Shopify backfill] DONE: ${summary.processed} processed, ` +
          `${summary.created} created, ${summary.existed} existed, ${summary.errors} errors`,
      );
    })
    .catch((err) => {
      console.error("[Shopify backfill] background failure:", err);
    })
    .finally(() => {
      backfillInProgress = false;
    });

  res.status(202).json({
    started: true,
    message: "Backfill running in background. Check /sync-status for progress.",
  });
});

export default router;
