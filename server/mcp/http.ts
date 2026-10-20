/**
 * MCP over Streamable HTTP, stateless: every POST builds a fresh server +
 * transport (no session state to share across Railway replicas) and answers
 * with plain JSON (enableJsonResponse) — no SSE, so compression and
 * Cloudflare buffering don't matter.
 *
 * Mounted at /mcp in server/app.ts BEFORE the CORS allowlist, sessions and
 * CSRF (like /embed): MCP clients are not browsers on our origin.
 */
import crypto from "crypto";
import express, { Router, type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer, type McpTier } from "./server";
import { createCustomRateLimiter } from "../utils/rate-limiting";
import { logger } from "../utils/logger";

function setCors(res: Response): void {
  // Browser-based MCP clients (e.g. the MCP Inspector) need CORS; there are
  // no cookies or credentials involved, so `*` is safe.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, Mcp-Protocol-Version, Mcp-Session-Id");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("X-Robots-Tag", "noindex");
}

export function handleMcp(tier: McpTier) {
  return async (req: Request, res: Response) => {
    const server = buildMcpServer({ tier });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      logger.error("MCP request failed", err, "MCP", { tier });
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
      }
    }
  };
}

function methodNotAllowed(_req: Request, res: Response) {
  res.status(405).set("Allow", "POST").json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed: this MCP server is stateless — POST JSON-RPC to this URL." },
    id: null,
  });
}

/** Public, read-only MCP server: POST /mcp. */
export function mcpPublicRouter(): Router {
  const router = Router();
  const limiter = createCustomRateLimiter(60 * 1000, 60, "Too many MCP requests — limit is 60 per minute.");
  router.use((req, res, next) => {
    setCors(res);
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  router.post("/", limiter, express.json({ limit: "1mb" }), handleMcp("public"));
  router.all("/", methodNotAllowed);
  return router;
}

/**
 * Admin keys: MCP_ADMIN_KEYS (comma-separated). Compared as SHA-256 digests
 * with timingSafeEqual so neither length nor content leaks through timing.
 */
function adminKeyDigests(): Buffer[] {
  return (process.env.MCP_ADMIN_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length >= 24)
    .map((k) => crypto.createHash("sha256").update(k).digest());
}

export function isValidAdminKey(header: string | undefined): boolean {
  const presented = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!presented) return false;
  const digest = crypto.createHash("sha256").update(presented).digest();
  let ok = false;
  for (const d of adminKeyDigests()) ok = crypto.timingSafeEqual(d, digest) || ok;
  return ok;
}

/** Key fingerprint for logs — never the key itself. */
const fingerprint = (header: string | undefined) =>
  crypto.createHash("sha256").update(header ?? "").digest("hex").slice(0, 8);

/**
 * Admin MCP server: POST /mcp/admin with `Authorization: Bearer <key>`.
 * Public tools + server-side synthesis. Internal use — no rate limit or
 * budget cap (Josh, 2026-10-20); every request is logged with a key fingerprint.
 */
export function mcpAdminRouter(): Router {
  const router = Router();
  router.use((req, res, next) => {
    setCors(res);
    if (req.method === "OPTIONS") return res.sendStatus(204);
    if (!isValidAdminKey(req.headers.authorization)) {
      return res
        .status(401)
        .set("WWW-Authenticate", 'Bearer realm="hydrogen-studies-mcp-admin"')
        .json({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null });
    }
    logger.info("MCP admin request", "MCP", { key: fingerprint(req.headers.authorization) });
    next();
  });
  router.post("/", express.json({ limit: "1mb" }), handleMcp("admin"));
  router.all("/", methodNotAllowed);
  return router;
}
