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
import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../utils/logger";

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
 * Generate a random password for auto-created accounts
 * Users can reset via the password reset flow
 */
function generateRandomPassword(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/**
 * POST /api/webhooks/shopify/customer-created
 * Called by Shopify when a new customer registers on echowater.com
 *
 * Shopify sends:
 * {
 *   id: 12345,
 *   email: "customer@example.com",
 *   first_name: "Jane",
 *   last_name: "Doe",
 *   phone: "+1...",
 *   tags: "...",
 *   created_at: "2024-01-01T00:00:00Z"
 * }
 */
router.post("/customer-created", async (req: Request, res: Response) => {
  try {
    // Verify webhook signature
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
    if (!customer || !customer.email) {
      logger.warn("Invalid webhook payload — missing email", "Shopify");
      return res.status(400).json({ error: "Invalid payload" });
    }

    const email = customer.email.toLowerCase().trim();
    const firstName = customer.first_name || "";
    const lastName = customer.last_name || "";
    const shopifyCustomerId = String(customer.id);

    logger.info("Customer created webhook received", "Shopify", { email, shopifyCustomerId });

    // Check if user already exists
    const [existing] = await db.select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      logger.info("User already exists, skipping", "Shopify", { email, userId: existing.id });
      return res.status(200).json({ status: "exists", userId: existing.id });
    }

    // Generate username from email (before the @)
    let username = email.split("@")[0].replace(/[^a-z0-9]/gi, "").toLowerCase();

    // Check username uniqueness
    const [usernameExists] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (usernameExists) {
      username = `${username}${Date.now().toString().slice(-4)}`;
    }

    // Hash a random password — user will need to reset on first login
    const bcrypt = await import("bcrypt");
    const randomPassword = generateRandomPassword();
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    // Create the account
    const userId = uuidv4();
    const [newUser] = await db.insert(users).values({
      id: userId,
      username,
      email,
      passwordHash,
      role: "customer",
      isActive: true,
    }).returning({ id: users.id });

    logger.info("Created account", "Shopify", { email, userId: newUser.id, username });

    // Return success to Shopify (they expect 200)
    res.status(200).json({
      status: "created",
      userId: newUser.id,
      username,
    });
  } catch (error) {
    logger.error("Customer created webhook error", error, "Shopify");
    // Return 200 anyway to prevent Shopify from retrying
    // Log the error and handle it manually
    res.status(200).json({ status: "error", message: "Internal error, will retry" });
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

    const email = order.email.toLowerCase().trim();
    logger.info("Order created", "Shopify", { email, totalPrice: order.total_price });

    // Find or create user
    const [existingUser] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!existingUser) {
      // Customer placed an order but doesn't have an account yet — auto-create
      const username = email.split("@")[0].replace(/[^a-z0-9]/gi, "").toLowerCase() + Date.now().toString().slice(-4);
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(generateRandomPassword(), 10);

      const orderUserId = uuidv4();
      const [newUser] = await db.insert(users).values({
        id: orderUserId,
        username,
        email,
        passwordHash,
        role: "customer",
        isActive: true,
      }).returning({ id: users.id });

      logger.info("Auto-created account for order customer", "Shopify", { email, userId: newUser.id });
    }

    res.status(200).json({ status: "acknowledged" });
  } catch (error) {
    logger.error("Order webhook error", error, "Shopify");
    res.status(200).json({ status: "error" });
  }
});

export default router;
