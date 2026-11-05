/**
 * /api/admin/evidence-fields — TRUST-BADGE-PLAN Phase 0.8 review list.
 *
 * Extracted evidence fields are auto-approved under the reviewer (Josh,
 * 2026-11-05: "assume she approved, she can unapprove later"). This lets Sarah
 * (or any admin) list them, approve, unapprove, or correct a value. Every
 * action is logged in evidence_field_changes, and the public evidence numbers
 * are invalidated so the change shows on the next page render.
 */
import { Router, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../auth";
import { db } from "../db";
import { logger } from "../utils/logger";
import { invalidateEvidenceStats } from "../services/evidence-stats";
import { EDITABLE_EVIDENCE_FIELDS, EVIDENCE_STATUSES } from "../../shared/evidence-fields";

const router = Router();
router.use(requireAdmin);
const PAGE = 50;

async function actorOf(req: Request): Promise<string> {
  const id = (req as any).session?.userId;
  if (id == null) return "admin";
  try {
    const r = await db.execute(sql`SELECT coalesce(username, email, id) AS who FROM users WHERE id = ${String(id)} LIMIT 1`);
    return String((r.rows?.[0] as any)?.who ?? id);
  } catch {
    return String(id);
  }
}

router.get("/", async (req: Request, res: Response) => {
  const status = String(req.query.status ?? "");
  const direction = String(req.query.direction ?? "");
  const q = String(req.query.q ?? "").trim().slice(0, 100);
  const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);
  const conds = [sql`s.evidence_fields_status IS NOT NULL`];
  if ((EVIDENCE_STATUSES as readonly string[]).includes(status)) conds.push(sql`s.evidence_fields_status = ${status}`);
  if ((EDITABLE_EVIDENCE_FIELDS.effect_direction as readonly string[]).includes(direction)) conds.push(sql`s.effect_direction = ${direction}`);
  if (q) conds.push(sql`(s.title ILIKE ${"%" + q + "%"} OR s.primary_outcome ILIKE ${"%" + q + "%"})`);
  const where = sql.join(conds, sql` AND `);
  try {
    const [rows, counts] = await Promise.all([
      db.execute(sql`
        SELECT s.id, s.slug, s.title, s.publish_year, s.primary_outcome, s.effect_direction, s.effect_direction_evidence,
               s.h2_concentration_ppm, s.h2_concentration_raw, s.delivery_route, s.population_kind, s.population_condition,
               s.species, s.funding_category, s.evidence_fields_status, s.evidence_fields_reviewed_by, s.evidence_fields_reviewed_at
          FROM studies s WHERE ${where}
         ORDER BY s.evidence_fields_reviewed_at DESC NULLS LAST, s.id DESC
         LIMIT ${PAGE} OFFSET ${offset}`),
      db.execute(sql`SELECT evidence_fields_status AS status, count(*)::int AS n FROM studies WHERE evidence_fields_status IS NOT NULL GROUP BY 1`),
    ]);
    res.json({ rows: rows.rows, counts: Object.fromEntries((counts.rows as any[]).map((c) => [c.status, c.n])), pageSize: PAGE, offset });
  } catch (err) {
    logger.error("evidence review list failed", err, "EvidenceReview");
    res.status(500).json({ error: "Failed to load evidence fields" });
  }
});

async function setStatus(req: Request, res: Response, status: "approved" | "unapproved") {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Bad study id" });
  try {
    const actor = await actorOf(req);
    const r = await db.execute(sql`
      UPDATE studies SET evidence_fields_status = ${status}, evidence_fields_reviewed_by = ${actor}, evidence_fields_reviewed_at = now()
       WHERE id = ${id} AND evidence_fields_status IS NOT NULL RETURNING id`);
    if (!r.rows?.length) return res.status(404).json({ error: "No evidence fields for this study" });
    await db.execute(sql`INSERT INTO evidence_field_changes (study_id, action, actor, changes) VALUES (${id}, ${status === "approved" ? "approve" : "unapprove"}, ${actor}, NULL)`);
    invalidateEvidenceStats();
    res.json({ id, status });
  } catch (err) {
    logger.error(`evidence ${status} failed`, err, "EvidenceReview");
    res.status(500).json({ error: "Update failed" });
  }
}

router.post("/:id/approve", (req, res) => setStatus(req, res, "approved"));
router.post("/:id/unapprove", (req, res) => setStatus(req, res, "unapproved"));

/** Correct one or more editable fields; a correction counts as an approval. */
router.patch("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Bad study id" });
  const body = req.body ?? {};
  const set: Record<string, string | number | null> = {};
  for (const [field, allowed] of Object.entries(EDITABLE_EVIDENCE_FIELDS)) {
    if (field in body) {
      if (!(allowed as readonly string[]).includes(body[field])) return res.status(400).json({ error: `Invalid ${field}` });
      set[field] = body[field];
    }
  }
  if ("h2_concentration_ppm" in body) {
    const v = body.h2_concentration_ppm;
    if (v !== null && !(typeof v === "number" && v >= 0.005 && v <= 50)) return res.status(400).json({ error: "h2_concentration_ppm must be 0.005–50 or null" });
    set.h2_concentration_ppm = v;
  }
  if (!Object.keys(set).length) return res.status(400).json({ error: "Nothing to change" });
  try {
    const actor = await actorOf(req);
    const before = await db.execute(sql`SELECT ${sql.raw(Object.keys(set).join(", "))} FROM studies WHERE id = ${id} AND evidence_fields_status IS NOT NULL`);
    if (!before.rows?.length) return res.status(404).json({ error: "No evidence fields for this study" });
    const assignments = sql.join(Object.entries(set).map(([k, v]) => sql`${sql.raw(k)} = ${v}`), sql`, `);
    await db.execute(sql`
      UPDATE studies SET ${assignments}, evidence_fields_status = 'approved', evidence_fields_reviewed_by = ${actor}, evidence_fields_reviewed_at = now()
       WHERE id = ${id}`);
    await db.execute(sql`INSERT INTO evidence_field_changes (study_id, action, actor, changes) VALUES (${id}, 'correct', ${actor}, ${JSON.stringify({ before: before.rows[0], after: set })}::jsonb)`);
    invalidateEvidenceStats();
    res.json({ id, status: "approved", changed: set });
  } catch (err) {
    logger.error("evidence correction failed", err, "EvidenceReview");
    res.status(500).json({ error: "Update failed" });
  }
});

export default router;
