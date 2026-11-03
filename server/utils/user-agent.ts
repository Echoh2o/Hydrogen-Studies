/**
 * Crawler user-agent detection — used ONLY to scope the crawler rate limiter
 * (server/index.ts). PLAN.md 3.4: user-agent logic may remove things
 * (rate-limit scope, analytics) but must never change the content a visitor
 * receives; every crawler gets the same HTML as a browser.
 */
// Bot user-agent patterns
const BOT_PATTERNS = [
  /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i, /baiduspider/i,
  /yandexbot/i, /sogou/i, /exabot/i, /facebot/i, /facebookexternalhit/i,
  /ia_archiver/i, /twitterbot/i, /linkedinbot/i, /embedly/i, /quora link preview/i,
  /showyoubot/i, /outbrain/i, /pinterest/i, /slackbot/i, /vkshare/i,
  /w3c_validator/i, /redditbot/i, /applebot/i, /whatsapp/i, /flipboard/i,
  /tumblr/i, /bitlybot/i, /skypeuripreview/i, /nuzzel/i, /discordbot/i,
  /google page speed/i, /chromelighthouse/i, /headlesschrome/i,
  /petalbot/i, /ahrefsbot/i, /semrushbot/i, /dotbot/i, /rogerbot/i,
  // AI assistants/search — these citing the site is a distribution channel
  /gptbot/i, /oai-searchbot/i, /chatgpt-user/i, /claudebot/i, /claude-web/i,
  /anthropic-ai/i, /perplexitybot/i, /perplexity-user/i, /ccbot/i,
  /meta-externalagent/i,
  // Claude's user-initiated fetch and search agents (2026-10-30): both got
  // the empty SPA shell, so Claude web search/fetch saw no content.
  /claude-user/i, /claude-searchbot/i,
  // Previously-missing crawlers (audit 2026-08-31): each of these got the
  // empty SPA shell instead of prerendered HTML — invisible content to any
  // fetcher that doesn't execute JS.
  /googleother/i,        // Google R&D/AI fetcher (feeds Gemini) — NOT matched by /googlebot/
  /google-cloudvertexbot/i,
  /duckassistbot/i,      // DuckDuckGo AI answers — NOT matched by /duckduckbot/
  /bingpreview/i, /adidxbot/i, // Bing snapshot + ads crawlers
  /bytespider/i,         // ByteDance — one of the highest-volume AI crawlers
  /amazonbot/i, /mistralai-user/i, /cohere/i, /youbot/i, /diffbot/i,
  /yeti/i,               // Naver (Korea)
  /seznambot/i, /qwant/i, /mojeekbot/i, /coccocbot/i,
  // SEO site-audit crawlers (2026-10-06): AhrefsSiteAudit isn't matched by
  // /ahrefsbot/, so Ahrefs audited the SPA shell (health score 1).
  /ahrefssiteaudit/i, /siteauditbot/i,
  // Generic tail: catches well-behaved crawlers we haven't named. Real browser
  // UAs never contain these tokens, and a false positive is harmless — the
  // "penalty" is being served real prerendered content.
  /crawler/i, /spider/i,
];

export function isBot(userAgent: string): boolean {
  return BOT_PATTERNS.some(pattern => pattern.test(userAgent));
}
