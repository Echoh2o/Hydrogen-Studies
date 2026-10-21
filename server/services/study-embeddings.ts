/**
 * Meaning-based search for the MCP server: one vector per live study, stored
 * in study_embeddings (migration 027) and searched in memory with cosine
 * similarity. Keyword search can't read intent ("is hydrogen water safe"
 * ranked disinfectant papers first on "safe"); research-query.ts blends these
 * scores with its keyword ranking.
 *
 * The model runs IN-PROCESS — bge-small-en-v1.5 (384 dims, int8, ~34 MB) via
 * transformers.js/ONNX. No external API, no per-query cost; Josh 2026-10-21:
 * OpenAI is not part of the product. Weights download from the Hugging Face
 * hub on first use (HF_CACHE_DIR, default /tmp/hf-cache).
 *
 * Degrades to keyword-only search when the model can't load or the table is
 * empty. Stays fresh on its own: when the index loads and finds live studies
 * without a current vector, it embeds a small batch in the background (bulk
 * backfill: scripts/research/embed-studies.ts).
 */
import { createHash } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { logger } from "../utils/logger";

export const EMBED_MODEL = "Xenova/bge-small-en-v1.5";
export const EMBED_DIMS = 384;
/** bge retrieval models embed QUERIES with this instruction; documents without it. */
const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";
const INDEX_TTL_MS = 30 * 60 * 1000;
const BATCH = 32;

/** The text a study is embedded from: our titles and finding, its conditions, and the abstract opening. */
export function embeddingText(s: {
  title?: string | null;
  plain_language_title?: string | null;
  key_finding?: string | null;
  health_conditions?: string[] | null;
  abstract?: string | null;
}): string {
  return [
    s.plain_language_title,
    s.title,
    s.key_finding,
    s.health_conditions?.length ? `Conditions: ${s.health_conditions.join(", ")}` : null,
    s.abstract?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 2000),
  ]
    .filter((x) => x && String(x).trim())
    .join("\n");
}

export const contentHash = (text: string) => createHash("sha1").update(`${EMBED_MODEL}:${EMBED_DIMS}:${text}`).digest("hex");

/** Unit-normalize so cosine similarity is a plain dot product. */
export function normalize(v: ArrayLike<number>): Float32Array {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  const inv = n > 0 ? 1 / Math.sqrt(n) : 0;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] * inv;
  return out;
}

export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

type Extractor = (input: string | string[], opts: { pooling: "cls"; normalize: boolean }) => Promise<{ tolist(): number[][] }>;
let extractor: Promise<Extractor> | null = null;

function getExtractor(): Promise<Extractor> {
  if (!extractor) {
    extractor = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.cacheDir = process.env.HF_CACHE_DIR || "/tmp/hf-cache";
      return (await pipeline("feature-extraction", EMBED_MODEL, { dtype: "q8" })) as unknown as Extractor;
    })();
    extractor.catch(() => (extractor = null)); // retry on the next call
  }
  return extractor;
}

/** Unit vectors for documents (no prefix) or a query (bge instruction prefix). */
export async function embedTexts(texts: string[], kind: "document" | "query" = "document"): Promise<Float32Array[]> {
  const ext = await getExtractor();
  const input = kind === "query" ? texts.map((t) => QUERY_PREFIX + t) : texts;
  return (await ext(input, { pooling: "cls", normalize: true })).tolist().map((v) => Float32Array.from(v));
}

// ── index ────────────────────────────────────────────────────

let index: { at: number; vectors: Map<number, Float32Array> } | null = null;
let indexLoading: Promise<Map<number, Float32Array>> | null = null;
let syncing: Promise<unknown> | null = null;

/** id → unit vector for every embedded live study. Single-flight, cached 30 min. */
export async function getEmbeddingIndex(): Promise<Map<number, Float32Array>> {
  if (index && Date.now() - index.at < INDEX_TTL_MS) return index.vectors;
  if (!indexLoading) {
    indexLoading = (async () => {
      const r = await db.execute(sql`
        SELECT e.study_id, e.embedding FROM study_embeddings e
          JOIN studies s ON s.id = e.study_id
         WHERE s.is_excluded = false AND e.model = ${EMBED_MODEL} AND e.dims = ${EMBED_DIMS}
      `);
      const vectors = new Map<number, Float32Array>();
      for (const row of (r.rows ?? []) as any[]) vectors.set(Number(row.study_id), Float32Array.from(row.embedding));
      index = { at: Date.now(), vectors };
      // Keep fresh without a scheduler: embed a few new/changed studies in the
      // background (new imports are a handful a day). Skipped when the table is
      // empty — the bulk backfill is a script, not the web process's job.
      if (!syncing && vectors.size > 0) {
        syncing = syncEmbeddings({ limit: 50 })
          .then((n) => n.embedded && (index = null)) // reload next call to pick them up
          .catch((err) => logger.warn("Embedding sync failed", "Embeddings", { error: String(err?.message ?? err) }))
          .finally(() => (syncing = null));
      }
      return vectors;
    })().finally(() => (indexLoading = null));
  }
  return indexLoading;
}

const queryCache = new Map<string, Float32Array>();

async function embedQuery(query: string): Promise<Float32Array | null> {
  const key = query.trim().toLowerCase();
  const hit = queryCache.get(key);
  if (hit) return hit;
  const [v] = await embedTexts([key], "query");
  if (!v) return null;
  if (queryCache.size >= 500) queryCache.delete(queryCache.keys().next().value!);
  queryCache.set(key, v);
  return v;
}

/**
 * Cosine similarity of the query to every embedded study. Empty when
 * embeddings are unavailable (no key, empty table, or an API error) — callers
 * fall back to keyword ranking.
 */
export async function semanticScores(query: string): Promise<Map<number, number>> {
  try {
    const vectors = await getEmbeddingIndex();
    if (!vectors.size) return new Map(); // never load the model when there is nothing to search
    const q = await embedQuery(query);
    if (!q) return new Map();
    const out = new Map<number, number>();
    for (const [id, v] of vectors) out.set(id, dot(q, v));
    return out;
  } catch (err) {
    logger.warn("Semantic search unavailable — keyword only", "Embeddings", { error: String((err as Error)?.message ?? err) });
    return new Map();
  }
}

// ── sync ─────────────────────────────────────────────────────

/** Embed live studies with no vector or stale text. Returns counts. */
export async function syncEmbeddings(opts: { limit?: number; dryRun?: boolean } = {}) {
  const r = await db.execute(sql`
    SELECT s.id, s.title, s.plain_language_title, s.key_finding, s.health_conditions, s.abstract, e.content_hash
      FROM studies s LEFT JOIN study_embeddings e ON e.study_id = s.id
     WHERE s.is_excluded = false
     ORDER BY s.id
  `);
  const todo: Array<{ id: number; text: string; hash: string }> = [];
  for (const row of (r.rows ?? []) as any[]) {
    const text = embeddingText(row);
    const hash = contentHash(text);
    if (text && row.content_hash !== hash) todo.push({ id: Number(row.id), text, hash });
  }
  const batch = opts.limit ? todo.slice(0, opts.limit) : todo;
  if (opts.dryRun || !batch.length) return { pending: todo.length, embedded: 0 };

  let embedded = 0;
  for (let i = 0; i < batch.length; i += BATCH) {
    const chunk = batch.slice(i, i + BATCH);
    const vectors = await embedTexts(chunk.map((c) => c.text));
    for (let j = 0; j < chunk.length; j++) {
      const arr = `{${Array.from(vectors[j], (x) => x.toFixed(6)).join(",")}}`;
      await db.execute(sql`
        INSERT INTO study_embeddings (study_id, model, dims, embedding, content_hash, updated_at)
        VALUES (${chunk[j].id}, ${EMBED_MODEL}, ${EMBED_DIMS}, ${arr}::real[], ${chunk[j].hash}, NOW())
        ON CONFLICT (study_id) DO UPDATE
          SET model = EXCLUDED.model, dims = EXCLUDED.dims, embedding = EXCLUDED.embedding,
              content_hash = EXCLUDED.content_hash, updated_at = NOW()
      `);
      embedded++;
    }
  }
  logger.info("Study embeddings synced", "Embeddings", { embedded, pending: todo.length - embedded });
  return { pending: todo.length - embedded, embedded };
}

/** Test hook. */
export function resetEmbeddingCaches(): void {
  index = null;
  indexLoading = null;
  queryCache.clear();
}
