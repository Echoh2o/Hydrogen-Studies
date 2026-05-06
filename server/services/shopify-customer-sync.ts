/**
 * Single source of truth for "create a hydrogenstudies.com account from
 * a Shopify customer." Used by:
 *   - The customer-created webhook (real-time, one customer at a time)
 *   - The order-created webhook (auto-account for guest checkouts)
 *   - The backfill script (one-time historical import)
 *   - The reconciliation cron (catches missed webhooks)
 *
 * Previously the create logic was duplicated across the three webhook
 * handlers. Centralizing it means username generation, password hashing,
 * dedup behavior, and the role assignment all stay consistent across
 * call sites.
 *
 * Returns a discriminated union so callers know whether they created,
 * skipped, or hit an error — useful for the backfill summary.
 */

import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../utils/logger";
import type { ShopifyCustomer } from "./shopify-client";

const TAG = "ShopifyCustomerSync";

export type SyncResult =
  | { status: "created"; userId: string; email: string; username: string }
  | { status: "exists"; userId: string; email: string }
  | { status: "skipped"; email: string | null; reason: string }
  | { status: "error"; email: string | null; error: string };

interface SyncInput {
  email: string | null | undefined;
  shopifyCustomerId?: string | number | null;
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Generate a random password — Shopify never tells us the customer's
 * actual password, so accounts are created with a random one. Customers
 * can reset via the standard password-reset flow on first login.
 */
function generateRandomPassword(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/**
 * Idempotent: if a user already exists for the email, returns
 * `{status: "exists"}` without modifying anything. Safe to call
 * repeatedly from cron + webhooks against the same Shopify customer.
 */
export async function syncShopifyCustomerToUser(input: SyncInput): Promise<SyncResult> {
  const rawEmail = input.email?.trim();
  if (!rawEmail) {
    return { status: "skipped", email: null, reason: "missing email" };
  }

  const email = rawEmail.toLowerCase();

  try {
    // Dedup by email — same check the webhook handler used to do inline
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return { status: "exists", userId: existing.id, email };
    }

    // Username from email local-part, sanitized. Append a 4-digit
    // disambiguator if the obvious choice is already taken.
    let username = email.split("@")[0].replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (!username) username = "customer";
    const [usernameExists] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (usernameExists) {
      username = `${username}${Date.now().toString().slice(-4)}`;
    }

    const bcrypt = await import("bcrypt");
    const passwordHash = await bcrypt.hash(generateRandomPassword(), 10);

    const userId = uuidv4();
    const [newUser] = await db
      .insert(users)
      .values({
        id: userId,
        username,
        email,
        passwordHash,
        role: "customer",
        isActive: true,
      })
      .returning({ id: users.id });

    logger.info("Created customer account", TAG, {
      email,
      userId: newUser.id,
      shopifyCustomerId: input.shopifyCustomerId ?? null,
    });

    return { status: "created", userId: newUser.id, email, username };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Most likely cause of an error here: a unique-constraint race when
    // two concurrent webhooks (or webhook + cron) hit the same email at
    // once. Log + return error so the caller can keep iterating.
    logger.warn("Failed to sync Shopify customer", TAG, {
      email,
      error: msg.slice(0, 300),
    });
    return { status: "error", email, error: msg };
  }
}

/** Convenience wrapper: same shape as a webhook payload. */
export async function syncShopifyCustomerPayload(customer: ShopifyCustomer | any): Promise<SyncResult> {
  return syncShopifyCustomerToUser({
    email: customer?.email ?? null,
    shopifyCustomerId: customer?.id ?? null,
    firstName: customer?.first_name ?? null,
    lastName: customer?.last_name ?? null,
  });
}

export interface SyncSummary {
  processed: number;
  created: number;
  existed: number;
  skipped: number;
  errors: number;
  /** First few error messages, truncated. Useful for an admin toast. */
  firstErrors: string[];
}

export interface BackfillOptions {
  /** Cap to N customers (useful for dry runs / small reconciliations). */
  maxCustomers?: number;
  /** Filter to customers updated_at >= this date. */
  updatedAtMin?: Date;
  /** Called every N customers with running totals — for progress logs. */
  onProgress?: (summary: SyncSummary) => void;
  /** Progress event interval (default 100). */
  progressEvery?: number;
}

/**
 * Walk every Shopify customer (or every customer matching the filter)
 * and upsert each one. Used by:
 *   - The one-shot CLI script (full historical backfill)
 *   - The admin "Backfill" button
 *   - The reconciliation cron (recent customers only, via updatedAtMin)
 *
 * Streams customers one page at a time so the entire result set never
 * sits in memory. A 30k-customer backfill takes ~3-4 minutes against
 * Shopify's 2 req/sec REST budget.
 */
export async function backfillShopifyCustomers(opts: BackfillOptions = {}): Promise<SyncSummary> {
  // Local import to avoid circular module issues + so a missing env
  // var doesn't crash the file's import chain.
  const { listCustomers, shopifyApiConfigured } = await import("./shopify-client");

  const summary: SyncSummary = {
    processed: 0,
    created: 0,
    existed: 0,
    skipped: 0,
    errors: 0,
    firstErrors: [],
  };

  if (!shopifyApiConfigured()) {
    summary.errors = 1;
    summary.firstErrors.push("SHOPIFY_ACCESS_TOKEN or SHOPIFY_STORE_URL not set");
    return summary;
  }

  const progressEvery = opts.progressEvery ?? 100;

  for await (const customer of listCustomers({
    maxCustomers: opts.maxCustomers,
    updatedAtMin: opts.updatedAtMin,
  })) {
    summary.processed++;
    const result = await syncShopifyCustomerPayload(customer);
    switch (result.status) {
      case "created":
        summary.created++;
        break;
      case "exists":
        summary.existed++;
        break;
      case "skipped":
        summary.skipped++;
        break;
      case "error":
        summary.errors++;
        if (summary.firstErrors.length < 5) {
          summary.firstErrors.push(`${result.email ?? "unknown"}: ${result.error.slice(0, 120)}`);
        }
        break;
    }
    if (opts.onProgress && summary.processed % progressEvery === 0) {
      opts.onProgress({ ...summary });
    }
  }

  return summary;
}
