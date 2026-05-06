/**
 * Shopify Admin API client.
 *
 * Thin wrapper around the few REST endpoints we actually need (currently
 * just listing customers for backfill + reconciliation). Not a generic
 * SDK — we add methods as we use them.
 *
 * Auth: a custom-app access token in SHOPIFY_ACCESS_TOKEN, sent as the
 * `X-Shopify-Access-Token` header.
 *
 * Rate limit: Shopify's REST API allows 2 req/sec sustained (40-bucket
 * leaky bucket). The simple sleep between pages keeps us under that
 * comfortably without needing to track the bucket header.
 */

import { logger } from "../utils/logger";

const TAG = "ShopifyClient";

const API_VERSION = "2024-10";

/** ms to sleep between paginated requests. 250ms = 4 req/sec ceiling, safely under the bucket. */
const PAGE_DELAY_MS = 250;

export interface ShopifyCustomer {
  id: number;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  state: string; // "enabled" | "disabled" | "invited" | "declined"
  tags: string;
  created_at: string;
  updated_at: string;
}

/**
 * Build the canonical store host. Accepts either:
 *   - "myshop.myshopify.com"  (full)
 *   - "myshop"                 (subdomain only — we add the suffix)
 *   - "https://myshop.myshopify.com" (full URL — we strip the scheme)
 */
function storeHost(): string {
  const raw = (process.env.SHOPIFY_STORE_URL || "").trim();
  if (!raw) throw new Error("SHOPIFY_STORE_URL not set");
  let host = raw.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  if (!host.includes(".")) host = `${host}.myshopify.com`;
  return host;
}

function adminBase(): string {
  return `https://${storeHost()}/admin/api/${API_VERSION}`;
}

function accessToken(): string {
  const t = (process.env.SHOPIFY_ACCESS_TOKEN || "").trim();
  if (!t) throw new Error("SHOPIFY_ACCESS_TOKEN not set");
  return t;
}

/** True iff the env vars needed for Admin API calls are present. */
export function shopifyApiConfigured(): boolean {
  return Boolean(process.env.SHOPIFY_ACCESS_TOKEN && process.env.SHOPIFY_STORE_URL);
}

/**
 * Parse the next-page cursor out of Shopify's Link header. Format:
 *   <https://store/admin/api/.../customers.json?page_info=abc&limit=250>; rel="next", <...>; rel="previous"
 * Returns the raw page_info value (NOT the URL — we'll rebuild it ourselves).
 */
function parseNextPageInfo(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const links = linkHeader.split(",");
  for (const link of links) {
    const m = link.match(/<([^>]+)>;\s*rel="next"/);
    if (m) {
      try {
        const url = new URL(m[1]);
        return url.searchParams.get("page_info");
      } catch {
        return null;
      }
    }
  }
  return null;
}

interface ListCustomersOptions {
  /** Hard cap on customers returned across all pages. Useful for cron (e.g. 48h reconciliation). */
  maxCustomers?: number;
  /** Filter to customers updated_at >= this date. ISO 8601. */
  updatedAtMin?: Date;
  /** Per-page size. Shopify max is 250. */
  pageSize?: number;
  /** Hook for progress reporting (called once per page). */
  onPage?: (count: number, totalSoFar: number) => void;
}

/**
 * Fetch all customers matching the filter, walking pagination.
 * Yields one customer at a time so callers can stream-process without
 * holding the entire result set in memory (echowater could have tens of
 * thousands of historical customers).
 */
export async function* listCustomers(opts: ListCustomersOptions = {}): AsyncGenerator<ShopifyCustomer, void, unknown> {
  const pageSize = Math.min(250, Math.max(1, opts.pageSize ?? 250));
  const maxCustomers = opts.maxCustomers ?? Infinity;
  let pageInfo: string | null = null;
  let totalYielded = 0;
  let pageNum = 0;

  while (true) {
    pageNum++;
    const params = new URLSearchParams({ limit: String(pageSize) });
    if (pageInfo) {
      params.set("page_info", pageInfo);
      // When using page_info, Shopify ignores other filters — they're
      // baked into the cursor. So updated_at_min only goes on page 1.
    } else if (opts.updatedAtMin) {
      params.set("updated_at_min", opts.updatedAtMin.toISOString());
    }

    const url = `${adminBase()}/customers.json?${params.toString()}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          "X-Shopify-Access-Token": accessToken(),
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      });
    } catch (err) {
      logger.error(`Network error fetching Shopify customers page ${pageNum}`, err, TAG);
      throw err;
    }

    if (res.status === 429) {
      // Bucket overflow — back off and retry once. Shopify recommends
      // honoring the Retry-After header.
      const retryAfter = Number(res.headers.get("retry-after")) || 2;
      logger.warn(`Shopify rate-limited, backing off ${retryAfter}s`, TAG);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      pageNum--; // re-attempt this page
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Shopify Admin API ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as { customers?: ShopifyCustomer[] };
    const batch = json.customers ?? [];

    for (const customer of batch) {
      if (totalYielded >= maxCustomers) return;
      yield customer;
      totalYielded++;
    }

    if (opts.onPage) opts.onPage(batch.length, totalYielded);

    pageInfo = parseNextPageInfo(res.headers.get("link"));
    if (!pageInfo) return; // no more pages
    if (totalYielded >= maxCustomers) return;

    // Polite delay between pages to stay under the 2 req/sec bucket.
    await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
  }
}
