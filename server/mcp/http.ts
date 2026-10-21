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
import rateLimit from "express-rate-limit";
import { clientIpKey } from "../utils/rate-limiting";
import { logger } from "../utils/logger";
import { verifyKey } from "../services/mcp-keys";

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

const skipInE2E = () => process.env.E2E_DISABLE_RATE_LIMIT === "1";
const rateLimited = (message: string) => (_req: Request, res: Response) =>
  res.status(429).json({ jsonrpc: "2.0", error: { code: -32000, message }, id: null });

/**
 * Public-tier limits. Per IP is generous because hosted MCP clients
 * (claude.ai, ChatGPT connectors) call from their vendors' shared servers, so
 * one IP can carry many users — 60/min would throttle them all at once. The
 * tools are cheap (in-memory corpus); the global ceiling guards against abuse.
 */
export const MCP_PUBLIC_PER_IP_PER_MIN = 600;
export const MCP_PUBLIC_GLOBAL_PER_MIN = 6000;

/** Public, read-only MCP server: POST /mcp. */
export function mcpPublicRouter(): Router {
  const router = Router();
  const perIp = rateLimit({
    windowMs: 60 * 1000,
    limit: MCP_PUBLIC_PER_IP_PER_MIN,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientIpKey,
    skip: skipInE2E,
    handler: rateLimited(`Too many MCP requests — limit is ${MCP_PUBLIC_PER_IP_PER_MIN} per minute per client.`),
  });
  const global = rateLimit({
    windowMs: 60 * 1000,
    limit: MCP_PUBLIC_GLOBAL_PER_MIN,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: () => "mcp-public-global",
    validate: false,
    skip: skipInE2E,
    handler: rateLimited("The MCP server is busy — please retry shortly."),
  });
  const limiter = [global, perIp];
  router.use((req, res, next) => {
    setCors(res);
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  router.post("/", ...limiter, express.json({ limit: "1mb" }), handleMcp("public"));
  router.all("/", methodNotAllowed);
  return router;
}

/**
 * Admin keys: issued from /admin/mcp (mcp_api_keys) or set in MCP_ADMIN_KEYS
 * (comma-separated); see services/mcp-keys.ts.
 */
const bearerToken = (header: string | undefined) => header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

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
  router.use(async (req, res, next) => {
    setCors(res);
    if (req.method === "OPTIONS") return res.sendStatus(204);
    const presented = bearerToken(req.headers.authorization);
    const auth: Awaited<ReturnType<typeof verifyKey>> = presented ? await verifyKey(presented) : { ok: false };
    if (!auth.ok) {
      return res
        .status(401)
        .set("WWW-Authenticate", 'Bearer realm="hydrogen-studies-mcp-admin"')
        .json({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null });
    }
    logger.info("MCP admin request", "MCP", { key: fingerprint(req.headers.authorization), keyId: auth.keyId });
    next();
  });
  router.post("/", express.json({ limit: "1mb" }), handleMcp("admin"));
  router.all("/", methodNotAllowed);
  return router;
}

/**
 * MCP Registry domain verification (registry.modelcontextprotocol.io): proves
 * hydrogenstudies.com owns the com.hydrogenstudies/* server namespace. Public
 * key only — the signing key is in Railway (MCP_REGISTRY_PRIVATE_KEY_PEM_B64)
 * and is used solely by `mcp-publisher login http` when (re)publishing
 * mcp/server.json.
 */
export const MCP_REGISTRY_AUTH = "v=MCPv1; k=ed25519; p=3+f9Qy+SPYhZU6IcFxxHSigIUMXHhJGWIOiopfLS4mI=";

export function mcpRegistryAuthHandler(_req: Request, res: Response): void {
  res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(MCP_REGISTRY_AUTH);
}
