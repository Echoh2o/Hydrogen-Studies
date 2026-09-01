# Echowater proxy status (PLAN.md 1.4) — report only

Config located:
- Serving route: `server/routes/proxy-routes.ts`, mounted at `/proxy` in `server/app.ts`
  behind `shopifyProxyAuth` (HMAC via SHOPIFY_APP_SECRET; fail-closed 503 in prod when unset)
  + 60/min rate limit. Base URL constant: `PROXY_BASE_URL` =
  `https://echowater.com/tools/hydrogen-research` (Shopify App Proxy subpath `tools/hydrogen-research`).
- Cross-domain canonicals are env-gated OFF (`ECHOWATER_CANONICAL`, seo-bot-middleware.ts).

Live checks:
- https://echowater.com/tools/hydrogen-research → HTTP 404
- https://echowater.com/tools/hydrogen-research/studies → HTTP 404
- https://hydrogenstudies.com/proxy/studies → HTTP 401
- https://echowater.com/pages/hydrogen-studies → HTTP 200 (NO link to hydrogenstudies.com — legacy copy, PLAN.md 8.2)

Disposition: do not fix — Phase 8.1 replaces the runtime proxy with a nightly metaobject sync.
