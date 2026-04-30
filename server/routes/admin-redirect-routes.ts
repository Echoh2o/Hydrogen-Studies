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
  bulkResolve404s,
  bulkIgnore404s,
} from "../services/redirect-service";

const router = Router();

// ── Redirects CRUD ────────────────────────────────────────────

/** GET /api/admin/redirects — List redirects sorted by hit count.
 *  Query params: search (LIKE on from/to), type (auto|manual|all), active (true|false).
 */
router.get("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 200) : undefined;
    const typeRaw = typeof req.query.type === "string" ? req.query.type : undefined;
    const type = typeRaw === "auto" || typeRaw === "manual" ? typeRaw : undefined;
    const activeRaw = typeof req.query.active === "string" ? req.query.active : undefined;
    const active = activeRaw === "true" ? true : activeRaw === "false" ? false : undefined;
    const rows = await listRedirects({ search: search || undefined, type, active });
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

/** POST /api/admin/redirects/404s/bulk-resolve — Accept top suggestions for many entries
 *  Body: { ids: number[], statusCode?: 301 | 302 }
 *  Use case: admin reviewed a batch and wants to mass-accept the auto-suggested targets.
 */
router.post("/404s/bulk-resolve", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((n: any) => typeof n === "number") : [];
    if (ids.length === 0) return res.status(400).json({ error: "ids array required" });
    if (ids.length > 500) return res.status(400).json({ error: "max 500 ids per call" });
    const statusCode = req.body?.statusCode === 302 ? 302 : 301;
    const result = await bulkResolve404s(ids, { statusCode });
    res.json(result);
  } catch (error) {
    console.error("Bulk resolve failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Bulk resolve failed" });
  }
});

/** POST /api/admin/redirects/404s/bulk-ignore — Mark entries resolved without creating redirects
 *  Body: { ids: number[] }
 *  Use case: admin reviewed and decided no good redirect target exists; better to leave 404.
 */
router.post("/404s/bulk-ignore", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((n: any) => typeof n === "number") : [];
    if (ids.length === 0) return res.status(400).json({ error: "ids array required" });
    if (ids.length > 500) return res.status(400).json({ error: "max 500 ids per call" });
    const result = await bulkIgnore404s(ids);
    res.json(result);
  } catch (error) {
    console.error("Bulk ignore failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Bulk ignore failed" });
  }
});

/** POST /api/admin/404s/backfill — Trigger suggestion backfill for unresolved 404s
 *  Body: { limit?: number, force?: boolean }  force=true re-scores entries that already have suggestions
 */
// Fire-and-forget so the client doesn't trip its 30s fetch timeout on
// large batches (500 entries × ~200ms ≈ 100s of work). The actual loop
// runs to completion in the background; client just gets a 202 with the
// batch size and learns the outcome by refreshing the 404 list.
router.post("/404s/backfill", requireAdmin, async (req: Request, res: Response) => {
  const limit = Math.min(500, parseInt(req.body.limit as string) || 50);
  const force = Boolean(req.body?.force);

  // Kick the work off without awaiting. backfillSuggestions has its own
  // per-entry try/catch so a bad row can't crash the unhandled-rejection
  // handler. We attach .catch defensively so a top-level throw still
  // logs cleanly instead of dying silently.
  backfillSuggestions(limit, { force })
    .then((result) => {
      console.log(
        `[Backfill] done — processed ${result.processed}, suggested ${result.suggested}, ` +
        `auto-promoted ${result.autoPromoted}, errors ${result.errors}`
      );
    })
    .catch((err) => {
      console.error("[Backfill] background batch failed:", err);
    });

  res.status(202).json({
    started: true,
    batchSize: limit,
    message: `Backfill started for up to ${limit} entries. Cron also drains 100/30min in the background.`,
  });
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
