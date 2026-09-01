/**
 * PLAN.md 1.4 — Locate + report the echowater Shopify App Proxy status.
 * Report only; Phase 8 replaces the runtime proxy with a nightly sync.
 *
 * Run: npx tsx scripts/reports/proxy-status.ts   (no DB needed)
 */
import fs from "fs";

const CHECKS = [
  // The Shopify App Proxy prefix per proxy-routes.ts PROXY_BASE_URL:
  "https://echowater.com/tools/hydrogen-research",
  "https://echowater.com/tools/hydrogen-research/studies",
  // Direct origin route (bypasses Shopify; HMAC-gated → expect 401/503, NOT 200):
  "https://hydrogenstudies.com/proxy/studies",
  // Legacy page PLAN.md 8.2 wants rebuilt:
  "https://echowater.com/pages/hydrogen-studies",
];

async function main() {
  const lines: string[] = [
    "# Echowater proxy status (PLAN.md 1.4) — report only",
    "",
    "Config located:",
    "- Serving route: `server/routes/proxy-routes.ts`, mounted at `/proxy` in `server/app.ts`",
    "  behind `shopifyProxyAuth` (HMAC via SHOPIFY_APP_SECRET; fail-closed 503 in prod when unset)",
    "  + 60/min rate limit. Base URL constant: `PROXY_BASE_URL` =",
    "  `https://echowater.com/tools/hydrogen-research` (Shopify App Proxy subpath `tools/hydrogen-research`).",
    "- Cross-domain canonicals are env-gated OFF (`ECHOWATER_CANONICAL`, seo-bot-middleware.ts).",
    "",
    "Live checks:",
  ];
  for (const url of CHECKS) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh) Chrome/128 Safari/537.36" },
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });
      const body = res.status === 200 ? await res.text() : "";
      const note =
        url.includes("/pages/hydrogen-studies") && res.status === 200
          ? body.includes("hydrogenstudies")
            ? " (links to hydrogenstudies.com)"
            : " (NO link to hydrogenstudies.com — legacy copy, PLAN.md 8.2)"
          : "";
      lines.push(`- ${url} → HTTP ${res.status}${res.headers.get("location") ? " → " + res.headers.get("location") : ""}${note}`);
      console.log(lines[lines.length - 1]);
    } catch (e) {
      lines.push(`- ${url} → ERROR ${(e as Error).message}`);
      console.log(lines[lines.length - 1]);
    }
  }
  lines.push("", "Disposition: do not fix — Phase 8.1 replaces the runtime proxy with a nightly metaobject sync.");
  fs.mkdirSync("reports", { recursive: true });
  fs.writeFileSync("reports/proxy-status.md", lines.join("\n") + "\n");
  console.log("\nWrote reports/proxy-status.md");
}

main();
