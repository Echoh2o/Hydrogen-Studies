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

export interface EchoUrlOptions {
  /** utm_campaign; defaults to "research". */
  campaign?: string;
  /** utm_content — use to identify the CTA placement (e.g. "study-sidebar"). */
  content?: string;
}

/**
 * Build an echowater.com URL with consistent UTM attribution.
 * Every link this codebase emits to the store must go through this helper so
 * echowater's GA4/Shopify analytics can attribute the traffic (previously all
 * links were untagged and rel="noreferrer" — recorded as Direct).
 */
export function buildEchoUrl(path: string, opts: EchoUrlOptions = {}): string {
  const url = new URL(path.startsWith("http") ? path : `${ECHOWATER_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`);
  url.searchParams.set("utm_source", "hydrogenstudies");
  url.searchParams.set("utm_medium", "referral");
  url.searchParams.set("utm_campaign", opts.campaign || "research");
  if (opts.content) url.searchParams.set("utm_content", opts.content);
  return url.toString();
}

/** Convenience: tagged product URL. */
export function echoProductUrl(product: EchoProduct, opts: EchoUrlOptions = {}): string {
  return buildEchoUrl(`/products/${product.handle}`, opts);
}
