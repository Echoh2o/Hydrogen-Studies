/**
 * Copy every row of stored_images into the S3-compatible bucket, plus a WebP
 * sibling at `<key>.webp` (see server/utils/storage.ts).
 *
 * Read-only against Postgres — it never deletes rows. Emptying stored_images
 * is a separate, manual step once `--verify` reports every key present.
 *
 * Resumable: an image whose WebP sibling already exists is skipped, so a
 * crashed run can simply be restarted.
 *
 *   --verify      list the bucket and report any stored_images key missing
 *                 its original or WebP copy. Uploads nothing.
 *   --limit N     stop after N images (for a trial run)
 *   --concurrency N  parallel uploads (default 6)
 *
 * Run:  railway run --service Hydrogen-Studies -- sh -c \
 *         'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/storage/migrate-images-to-bucket.ts'
 * (DATABASE_PUBLIC_URL comes from the Postgres service; pass it in if the app
 *  service doesn't expose it.)
 */
import pg from "pg";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { toWebp, webpKey, isWebpConvertible } from "../../server/utils/storage";

const VERIFY = process.argv.includes("--verify");
const argNum = (flag: string, dflt: number) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? Number(process.argv[i + 1]) : dflt;
};
const LIMIT = argNum("--limit", Infinity);
const CONCURRENCY = argNum("--concurrency", 6);
const BATCH = 24;

const bucket = process.env.S3_BUCKET;
if (!bucket) throw new Error("S3_BUCKET is not set");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

const s3 = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE
    ? process.env.S3_FORCE_PATH_STYLE === "true"
    : !!process.env.S3_ENDPOINT,
});
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

const CACHE = "public, max-age=31536000, immutable";
const mb = (n: number) => `${(n / 1e6).toFixed(1)} MB`;

async function exists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err: any) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound") return false;
    throw err;
  }
}

async function listBucketKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  let token: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
    );
    for (const o of page.Contents ?? []) if (o.Key) keys.add(o.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function verify() {
  const { rows } = await pool.query<{ key: string; content_type: string }>(
    `SELECT key, content_type FROM stored_images ORDER BY id`,
  );
  const keys = await listBucketKeys();
  const missing = rows.filter(
    (r) =>
      !keys.has(r.key) ||
      (isWebpConvertible(r.content_type) && !keys.has(webpKey(r.key))),
  );
  console.log(`stored_images rows: ${rows.length}; bucket objects: ${keys.size}`);
  console.log(`rows missing an original or WebP copy: ${missing.length}`);
  for (const r of missing.slice(0, 20)) console.log(`  ${r.key}`);
  return missing.length;
}

async function migrate() {
  const { rows: ids } = await pool.query<{ id: number }>(
    `SELECT id FROM stored_images ORDER BY id`,
  );
  const todo = ids.slice(0, LIMIT === Infinity ? undefined : LIMIT).map((r) => r.id);
  console.log(`${todo.length} images to process (concurrency ${CONCURRENCY})`);

  let done = 0, skipped = 0, failed = 0, origBytes = 0, webpBytes = 0;
  const started = Date.now();

  for (let i = 0; i < todo.length; i += BATCH) {
    const { rows } = await pool.query<{
      key: string; data: Buffer; content_type: string;
    }>(
      `SELECT key, data, content_type FROM stored_images WHERE id = ANY($1) ORDER BY id`,
      [todo.slice(i, i + BATCH)],
    );

    const queue = [...rows];
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        for (let row = queue.shift(); row; row = queue.shift()) {
          const convertible = isWebpConvertible(row.content_type);
          try {
            if (await exists(convertible ? webpKey(row.key) : row.key)) {
              skipped++;
              continue;
            }
            await s3.send(new PutObjectCommand({
              Bucket: bucket, Key: row.key, Body: row.data,
              ContentType: row.content_type, CacheControl: CACHE,
            }));
            origBytes += row.data.length;
            if (convertible) {
              const webp = await toWebp(row.data);
              await s3.send(new PutObjectCommand({
                Bucket: bucket, Key: webpKey(row.key), Body: webp,
                ContentType: "image/webp", CacheControl: CACHE,
              }));
              webpBytes += webp.length;
            }
            done++;
          } catch (err: any) {
            failed++;
            console.error(`FAILED ${row.key}: ${err?.message ?? err}`);
          }
        }
      }),
    );

    const n = Math.min(i + BATCH, todo.length);
    const secs = (Date.now() - started) / 1000;
    console.log(
      `${n}/${todo.length}  uploaded ${done} skipped ${skipped} failed ${failed}  ` +
      `orig ${mb(origBytes)} → webp ${mb(webpBytes)}  ${(n / secs).toFixed(1)} img/s`,
    );
  }

  console.log(
    `\nDone: uploaded ${done}, skipped ${skipped}, failed ${failed}. ` +
    `Originals ${mb(origBytes)}, WebP ${mb(webpBytes)}` +
    (origBytes ? ` (${(100 - (webpBytes / origBytes) * 100).toFixed(0)}% smaller)` : ""),
  );
  return failed;
}

(VERIFY ? verify() : migrate())
  .then(async (bad) => {
    await pool.end();
    process.exit(bad ? 1 : 0);
  })
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
