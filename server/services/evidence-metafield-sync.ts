/**
 * TRUST-BADGE-PLAN Phase 2.1 — write each enabled product's evidence badge
 * data into echowater.com product metafields so the theme renders the badge
 * server-side (no runtime fetch, no layout shift, nothing to break if
 * hydrogenstudies.com is down).
 *
 *   hydrogenstudies.evidence_profile (json)  — badge lines, links, version
 *   hydrogenstudies.evidence_topics  (json)  — claim-widget lines per Appendix E topic (≥3 studies)
 *
 * Products whose badge is OFF get their metafields removed, so the theme shows
 * nothing. Uses SHOPIFY_ACCESS_TOKEN / SHOPIFY_STORE_URL (ef6478-2 =
 * echowater.com); needs write_products.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import { getEvidenceProfile, getTopicEvidence } from "./evidence-profile";
import { CLAIM_TOPICS } from "../../shared/evidence-match";
import { BADGE, CLAIM_WIDGET, ppmLabel } from "../../shared/evidence-badge-copy";
import { logger } from "../utils/logger";

const API_VERSION = "2024-10";
const SITE_URL = process.env.SITE_URL || "https://hydrogenstudies.com";
const NS = "hydrogenstudies";
const MIN_TOPIC_STUDIES = 3;

function storeHost(): string {
  const raw = (process.env.SHOPIFY_STORE_URL || "").trim();
  if (!raw) throw new Error("SHOPIFY_STORE_URL not set");
  const host = raw.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return host.includes(".") ? host : `${host}.myshopify.com`;
}

async function gql<T = any>(query: string, variables: Record<string, unknown>): Promise<T> {
  const token = (process.env.SHOPIFY_ACCESS_TOKEN || "").trim();
  if (!token) throw new Error("SHOPIFY_ACCESS_TOKEN not set");
  const res = await fetch(`https://${storeHost()}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json.errors) throw new Error(`Shopify GraphQL ${res.status}: ${JSON.stringify(json.errors ?? json).slice(0, 300)}`);
  return json.data as T;
}

const utm = (url: string, slug: string) =>
  `${url}${url.includes("?") ? "&" : "?"}utm_source=echowater&utm_medium=badge&utm_campaign=evidence_profile&utm_content=${encodeURIComponent(slug)}`;

export interface SyncResult { slug: string; action: "set" | "removed" | "skipped"; detail?: string }

export async function syncEvidenceMetafields(opts: { dryRun?: boolean } = {}): Promise<SyncResult[]> {
  const rows = (await db.execute(sql`SELECT slug, shopify_handle, badge_enabled FROM products ORDER BY slug`)).rows as any[];
  const results: SyncResult[] = [];
  for (const r of rows) {
    const slug = String(r.slug);
    const handle = String(r.shopify_handle);
    try {
      const found = await gql<{ products: { nodes: { id: string; metafields: { nodes: { key: string }[] } }[] } }>(
        `query($q: String!) { products(first: 1, query: $q) { nodes { id metafields(first: 5, namespace: "${NS}") { nodes { key } } } } }`,
        { q: `handle:${handle}` },
      );
      const product = found.products.nodes[0];
      if (!product) { results.push({ slug, action: "skipped", detail: `no Shopify product with handle ${handle}` }); continue; }
      const existing = product.metafields.nodes.map((m) => m.key);
      const profile = r.badge_enabled ? await getEvidenceProfile(slug) : null;

      if (!profile) {
        if (existing.length && !opts.dryRun) {
          await gql(`mutation($m: [MetafieldIdentifierInput!]!) { metafieldsDelete(metafields: $m) { userErrors { field message } } }`, {
            m: existing.map((key) => ({ ownerId: product.id, namespace: NS, key })),
          });
        }
        results.push({ slug, action: existing.length ? "removed" : "skipped", detail: r.badge_enabled ? "no eligible profile" : "badge off" });
        continue;
      }

      const ppm = ppmLabel(profile.product.certifiedConcentrationPpm as number);
      const evidenceUrl = utm(`${SITE_URL}/evidence/${slug}`, slug);
      const profileValue = {
        slug,
        line1: BADGE.line1(profile.match),
        line2: BADGE.line2(profile.match, ppm),
        cta: BADGE.cta,
        source: BADGE.source,
        evidenceUrl,
        svgUrl: `${SITE_URL}/badge/${slug}.svg?v=${profile.version}`,
        version: profile.version,
        generatedAt: profile.generatedAt,
      };
      const topics: Record<string, { line: string; cta: string; url: string }> = {};
      for (const topic of Object.keys(CLAIM_TOPICS)) {
        const t = await getTopicEvidence(topic);
        if (t && t.count >= MIN_TOPIC_STUDIES) topics[topic] = { line: CLAIM_WIDGET.line(t.count, t.mix), cta: CLAIM_WIDGET.cta, url: evidenceUrl };
      }
      if (!opts.dryRun) {
        const out = await gql<{ metafieldsSet: { userErrors: { field: string; message: string }[] } }>(
          `mutation($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { userErrors { field message } } }`,
          {
            m: [
              { ownerId: product.id, namespace: NS, key: "evidence_profile", type: "json", value: JSON.stringify(profileValue) },
              { ownerId: product.id, namespace: NS, key: "evidence_topics", type: "json", value: JSON.stringify(topics) },
            ],
          },
        );
        if (out.metafieldsSet.userErrors.length) throw new Error(JSON.stringify(out.metafieldsSet.userErrors));
      }
      results.push({ slug, action: "set", detail: `${profileValue.line2}; topics ${Object.keys(topics).length}` });
    } catch (err) {
      logger.error(`evidence metafield sync failed for ${slug}`, err, "EvidenceSync");
      results.push({ slug, action: "skipped", detail: String((err as Error).message).slice(0, 160) });
    }
  }
  return results;
}
