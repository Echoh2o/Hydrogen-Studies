/**
 * Admin Redirect Management Routes
 * CRUD endpoints for managing 301/302 redirects and viewing 404 logs
 */
import { Router, Request, Response } from "express";
import { requireAdmin } from "../auth";
import {
  listRedirects,
  createRedirect,
  updateRedirect,
  deleteRedirect,
  list404s,
  resolve404,
  backfillSuggestions,
  getRankedSuggestions,
  getRedirectDiagnostics,
} from "../services/redirect-service";

const router = Router();

// ── Redirects CRUD ────────────────────────────────────────────

/** GET /api/admin/redirects — List all redirects sorted by hit count */
router.get("/", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await listRedirects();
    res.json({ data: rows });
  } catch (error) {
    console.error("Failed to fetch redirects:", error);
    res.status(500).json({ error: "Failed to fetch redirects" });
  }
});

/** POST /api/admin/redirects — Create a new redirect */
router.post("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { fromPath, toPath, statusCode, note } = req.body;
    if (!fromPath || !toPath) {
      return res.status(400).json({ error: "fromPath and toPath are required" });
    }
    const code = statusCode === 302 ? 302 : 301;
    const row = await createRedirect(fromPath, toPath, code, note);
    res.status(201).json(row);
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "A redirect for this path already exists" });
    }
    if (error.message?.includes("loop") || error.message?.includes("itself") || error.message?.includes("relative path")) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Failed to create redirect:", error);
    res.status(500).json({ error: "Failed to create redirect" });
  }
});

/** PUT /api/admin/redirects/:id — Update a redirect */
router.put("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid redirect ID" });

    const { toPath, statusCode, isActive, note } = req.body;
    const updates: Record<string, any> = {};
    if (toPath !== undefined) updates.toPath = toPath;
    if (statusCode !== undefined) updates.statusCode = statusCode === 302 ? 302 : 301;
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (note !== undefined) updates.note = note;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid update fields provided" });
    }

    const row = await updateRedirect(id, updates);
    if (!row) return res.status(404).json({ error: "Redirect not found" });
    res.json(row);
  } catch (error) {
    console.error("Failed to update redirect:", error);
    res.status(500).json({ error: "Failed to update redirect" });
  }
});

/** DELETE /api/admin/redirects/:id — Delete a redirect */
router.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid redirect ID" });
    await deleteRedirect(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete redirect:", error);
    res.status(500).json({ error: "Failed to delete redirect" });
  }
});

// ── 404 Log Endpoints ─────────────────────────────────────────

/** GET /api/admin/404s — List 404 log entries */
router.get("/404s", requireAdmin, async (req: Request, res: Response) => {
  try {
    const resolved = req.query.resolved === "true" ? true : req.query.resolved === "false" ? false : undefined;
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const rows = await list404s({ resolved, limit, offset });
    res.json({ data: rows });
  } catch (error) {
    console.error("Failed to fetch 404s:", error);
    res.status(500).json({ error: "Failed to fetch 404 log" });
  }
});

/** POST /api/admin/404s/:id/resolve — Convert a 404 entry into a redirect */
router.post("/404s/:id/resolve", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid 404 entry ID" });

    const { toPath, statusCode } = req.body;
    if (!toPath) return res.status(400).json({ error: "toPath is required" });

    const result = await resolve404(id, toPath, statusCode === 302 ? 302 : 301);
    res.status(201).json(result);
  } catch (error: any) {
    if (error.message === "404 entry not found") {
      return res.status(404).json({ error: "404 entry not found" });
    }
    if (error.code === "23505") {
      return res.status(409).json({ error: "A redirect for this path already exists" });
    }
    console.error("Failed to resolve 404:", error);
    res.status(500).json({ error: "Failed to resolve 404" });
  }
});

/** POST /api/admin/404s/backfill — Trigger suggestion backfill for unresolved 404s
 *  Body: { limit?: number, force?: boolean }  force=true re-scores entries that already have suggestions
 */
router.post("/404s/backfill", requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(200, parseInt(req.body.limit as string) || 50);
    const force = Boolean(req.body?.force);
    const result = await backfillSuggestions(limit, { force });
    res.json(result);
  } catch (error) {
    console.error("Failed to backfill suggestions:", error);
    res.status(500).json({ error: "Failed to backfill suggestions" });
  }
});

/** GET /api/admin/redirects/diagnostics — Why are suggestions empty?
 *  Returns pg_trgm availability, schema state, and per-table content counts so
 *  the admin can self-diagnose without server log access.
 */
router.get("/diagnostics", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const diag = await getRedirectDiagnostics();
    res.json(diag);
  } catch (error) {
    console.error("Failed to run redirect diagnostics:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to run diagnostics" });
  }
});

/** GET /api/admin/redirects/suggest?path=/foo — Live ranked suggestions for a single path
 *  Used by the resolve dialog so admins can preview/refresh without a full backfill run.
 */
router.get("/suggest", requireAdmin, async (req: Request, res: Response) => {
  try {
    const path = (req.query.path as string) || "";
    // Length cap protects Postgres: `getRankedSuggestions` runs three
    // `similarity()` trigram queries against studies/blogs/conditions.
    // A multi-KB path input would make each query compute trigrams over
    // a multi-KB pattern per row. 500 chars covers every legitimate URL.
    if (path.length > 500) {
      return res.status(400).json({ error: "path too long (max 500 chars)" });
    }
    if (!path.startsWith("/")) {
      return res.status(400).json({ error: "path query param must start with /" });
    }
    const suggestions = await getRankedSuggestions(path);
    res.json({ data: suggestions });
  } catch (error) {
    console.error("Failed to generate suggestions:", error);
    res.status(500).json({ error: "Failed to generate suggestions" });
  }
});

export default router;
