/**
 * Echo Water (echowater.com) product catalog — the single source of truth for
 * every store link this codebase emits.
 *
 * Handles were verified against the live Shopify store (Echo Water, Shopify
 * Plus) via the Admin API on 2026-08-07. Do NOT hand-edit slugs without
 * re-verifying: three previous hardcoded link sets (ChatWidget, Footer,
 * ProductsPage) had drifted to nonexistent handles (e.g. "echo-h2-machine",
 * "echo-h2-tablets-1") that 404'd on the storefront.
 *
 * Shared between server (proxy pages, generated content) and client (CTAs),
 * so keep it dependency-free.
 */

export interface EchoProduct {
  /** Shopify product handle — storefront path is /products/<handle> */
  handle: string;
  title: string;
  /** Rounded display price in USD at verification time (informational only). */
  priceUsd: number;
  /** Matches studies.h2DeliveryMethod values where applicable. */
  deliveryMethods: Array<"drinking" | "inhalation" | "bathing">;
  /** Short human blurb safe to show next to research content. */
  blurb: string;
}

export const ECHO_PRODUCTS: Record<string, EchoProduct> = {
  flask: {
    handle: "echo-flask",
    title: "ECHO Flask Hydrogen Water Bottle",
    priceUsd: 300,
    deliveryMethods: ["drinking"],
    blurb: "Portable hydrogen water bottle (up to 8 ppm molecular hydrogen).",
  },
  forty: {
    handle: "echo-forty-hydrogen-tumbler",
    title: "ECHO Forty Hydrogen Tumbler",
    priceUsd: 400,
    deliveryMethods: ["drinking"],
    blurb: "40 oz portable tumbler that generates molecular hydrogen on demand.",
  },
  h2Machine: {
    handle: "echo-h2-hydrogen-water-machine",
    title: "ECHO H2 Hydrogen Water Machine",
    priceUsd: 3000,
    deliveryMethods: ["drinking"],
    blurb: "Countertop hydrogen water machine for the home.",
  },
  ultimate: {
    handle: "echo-ultimate-hydrogen-water",
    title: "ECHO Ultimate Hydrogen Water Machine",
    priceUsd: 5000,
    deliveryMethods: ["drinking"],
    blurb: "Flagship multi-water hydrogen machine.",
  },
  flow: {
    handle: "echo-h2-server-hydrogen-water",
    title: "ECHO Flow",
    priceUsd: 2500,
    deliveryMethods: ["drinking"],
    blurb: "Filter-less hydrogen generator that pairs with RO/home water systems.",
  },
  one: {
    handle: "echo-one-machine",
    title: "ECHO One",
    priceUsd: 3500,
    deliveryMethods: ["drinking"],
    blurb: "Under-counter reverse osmosis + hydrogen water system.",
  },
  refresh: {
    handle: "echo-refresh-hydrogen-inhalation-machine",
    title: "ECHO Refresh Hydrogen Inhalation Machine",
    priceUsd: 7500,
    deliveryMethods: ["inhalation"],
    blurb: "Hydrogen gas inhalation machine.",
  },
  revive: {
    handle: "echo-revive",
    title: "ECHO Revive Hydrogen Bath Machine",
    priceUsd: 7500,
    deliveryMethods: ["bathing"],
    blurb: "Infuses bath water with hydrogen gas.",
  },
  prebiotic: {
    handle: "hydrogen-prebiotic-stick-pack-30-pack",
    title: "Hydrogen Prebiotic Drink Mix",
    priceUsd: 48,
    deliveryMethods: ["drinking"],
    blurb: "Stick packs that turn any water into hydrogen prebiotic water.",
  },
};

/** Products to surface for a study/topic's delivery method, most-relevant first. */
export function productsForDeliveryMethod(method: string | null | undefined): EchoProduct[] {
  const m = (method || "").toLowerCase();
  if (m.includes("inhal")) return [ECHO_PRODUCTS.refresh, ECHO_PRODUCTS.flask];
  if (m.includes("bath")) return [ECHO_PRODUCTS.revive, ECHO_PRODUCTS.flask];
  // drinking (default): lead with the accessible bottle, then a home machine.
  return [ECHO_PRODUCTS.flask, ECHO_PRODUCTS.h2Machine];
}

export const ECHOWATER_ORIGIN = "https://echowater.com";

/**
 * UTM attribution context — CLAUDE.md: every link to echowater.com carries
 * utm_source=hydrogenstudies&utm_medium=referral&utm_campaign=<page_type>&utm_content=<slug>.
 * `pageType`/`slug` describe the PAGE the link sits on, not the CTA placement
 * (placement is tracked separately in GA4 by trackOutboundClick).
 */
export interface EchoUtmContext {
  /** e.g. "home", "study", "blog", "hub", "hydrogen-for", "about". */
  pageType: string;
  /** The page's own slug ("home" for the homepage). */
  slug: string;
}

/** Normalize a UTM value: lowercase, url-safe, bounded. */
export function normalizeUtmValue(value: string | null | undefined, fallback = "unknown"): string {
  const v = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return v || fallback;
}

const ECHO_HOST_RE = /^(?:www\.)?echowater\.com$/i;
const ABSOLUTE_URL_RE = /^(?:https?:)?\/\//i;

/** Is `href` an absolute (or protocol-relative) link to echowater.com? */
export function isEchoUrl(href: string | null | undefined): boolean {
  if (!href) return false;
  const h = href.trim();
  if (!ABSOLUTE_URL_RE.test(h)) return false;
  try {
    const url = new URL(h.startsWith("//") ? `https:${h}` : h);
    return ECHO_HOST_RE.test(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Build an echowater.com URL with the canonical UTM set. Accepts a store path
 * ("/products/echo-flask") or an absolute echowater.com URL. Any existing
 * utm_* params are replaced, so a link can never carry stale placement tags.
 * Every link this codebase emits to the store must go through this helper
 * (or, for rendered content, through rewriteEchoLinks* in content-links.ts).
 */
export function buildEchoUrl(href: string, ctx: EchoUtmContext): string {
  const raw = (href || "/").trim();
  const absolute = ABSOLUTE_URL_RE.test(raw)
    ? (raw.startsWith("//") ? `https:${raw}` : raw)
    : `${ECHOWATER_ORIGIN}${raw.startsWith("/") ? "" : "/"}${raw}`;
  const url = new URL(absolute);
  for (const key of Array.from(url.searchParams.keys())) {
    if (key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
  }
  url.searchParams.set("utm_source", "hydrogenstudies");
  url.searchParams.set("utm_medium", "referral");
  url.searchParams.set("utm_campaign", normalizeUtmValue(ctx.pageType, "page"));
  url.searchParams.set("utm_content", normalizeUtmValue(ctx.slug, "home"));
  return url.toString();
}

/** Convenience: tagged product URL. */
export function echoProductUrl(product: EchoProduct, ctx: EchoUtmContext): string {
  return buildEchoUrl(`/products/${product.handle}`, ctx);
}

/**
 * Derive the UTM page context from a site pathname so the bot renderer
 * (server) and the SPA (client) tag links identically:
 *   /                          → home / home
 *   /study/<slug>              → study / <slug>
 *   /blog/<slug>               → blog / <slug>
 *   /hub/<topic>               → hub / <topic>
 *   /hydrogen-for/<slug>       → hydrogen-for / <slug>
 *   /explore-by-condition/<x>  → condition / <x>
 *   /about                     → about / about
 */
export function pageContextFromPath(pathname: string | null | undefined): EchoUtmContext {
  const clean = String(pathname ?? "/").split(/[?#]/)[0];
  const segs = clean.split("/").filter(Boolean);
  if (segs.length === 0) return { pageType: "home", slug: "home" };
  const first = segs[0].toLowerCase();
  const TYPE_MAP: Record<string, string> = {
    study: "study",
    studies: "study",
    blog: "blog",
    hub: "hub",
    "hydrogen-for": "hydrogen-for",
    "explore-by-condition": "condition",
    "explore-by-body-system": "body-system",
    learn: "learn",
  };
  const pageType =
    TYPE_MAP[first] ?? (first.startsWith("explore-by-") ? first.replace(/^explore-by-/, "explore-") : first);
  const slug = segs.length > 1 ? segs[segs.length - 1] : first;
  return { pageType: normalizeUtmValue(pageType, "page"), slug: normalizeUtmValue(slug, "home") };
}
