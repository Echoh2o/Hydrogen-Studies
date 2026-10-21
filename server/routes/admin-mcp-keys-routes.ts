/**
 * Internal MCP keys — /api/admin/mcp-keys (admin only). The plaintext key is
 * returned once, by POST; GET never includes keys or hashes.
 */
import { Router, type Request, type Response } from "express";
import { requireAdmin } from "../auth";
import { createKey, listKeys, revokeKey } from "../services/mcp-keys";
import { logger } from "../utils/logger";

const MAX_NAME = 100;
const router = Router();
router.use(requireAdmin);

const userId = (req: Request): string | null => {
  const id = (req as any).session?.userId;
  return id != null ? String(id) : null;
};

router.get("/", async (_req: Request, res: Response) => {
  try {
    res.json({ keys: await listKeys() });
  } catch (err) {
    logger.error("Failed to list MCP keys", err, "MCP");
    res.status(500).json({ error: "Failed to load keys" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name || name.length > MAX_NAME) {
    return res.status(400).json({ error: `Name is required (max ${MAX_NAME} characters).` });
  }
  try {
    const created = await createKey(name, userId(req));
    logger.info("MCP key created", "MCP", { id: created.id, by: userId(req) });
    res.status(201).json(created);
  } catch (err) {
    logger.error("Failed to create MCP key", err, "MCP");
    res.status(500).json({ error: "Failed to create key" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid key id" });
  try {
    if (!(await revokeKey(id))) return res.status(404).json({ error: "Key not found" });
    logger.info("MCP key revoked", "MCP", { id, by: userId(req) });
    res.json({ ok: true });
  } catch (err) {
    logger.error("Failed to revoke MCP key", err, "MCP");
    res.status(500).json({ error: "Failed to revoke key" });
  }
});

export default router;
