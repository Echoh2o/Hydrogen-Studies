/**
 * Storage Utility for Hydrogen Studies
 *
 * S3-compatible upload abstraction that supports AWS S3, Cloudflare R2,
 * DigitalOcean Spaces, or any S3-compatible service.
 *
 * Falls back to the stored_images table if S3_BUCKET is not configured,
 * so nothing breaks for local development.
 *
 * Raster uploads (PNG/JPEG) are also stored as a WebP sibling at
 * `<key>.webp`. The /uploads route serves the WebP to clients that accept it
 * and the original to everyone else, so public image URLs never change.
 *
 * Environment variables:
 *   S3_BUCKET          — bucket name (required to enable cloud storage)
 *   S3_REGION          — region (default: "auto" for R2)
 *   S3_ENDPOINT        — custom endpoint for R2/Spaces
 *   S3_ACCESS_KEY_ID   — access key
 *   S3_SECRET_ACCESS_KEY — secret key
 *   S3_PUBLIC_URL      — public URL prefix for a public bucket; when unset,
 *                        files are served by the app under /uploads/<key>
 *   S3_FORCE_PATH_STYLE — "true"/"false"; defaults to true when S3_ENDPOINT is set
 */
import fs from "fs";
import path from "path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// S3 client singleton (lazy-initialized)
// ---------------------------------------------------------------------------

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION || "auto";
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set when S3_BUCKET is configured",
      );
    }

    s3Client = new S3Client({
      region,
      ...(endpoint ? { endpoint } : {}),
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      // Path-style is needed by some S3-compatible services; Railway buckets
      // use virtual-host style, so allow an explicit override.
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE
        ? process.env.S3_FORCE_PATH_STYLE === "true"
        : !!endpoint,
    });

    logger.info("S3 client initialized", "Storage", {
      region,
      endpoint: endpoint || "(default AWS)",
      bucket: process.env.S3_BUCKET,
    });
  }
  return s3Client;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether cloud storage (S3/R2/Spaces) is configured.
 */
export function isCloudStorageConfigured(): boolean {
  return !!process.env.S3_BUCKET;
}

/**
 * Get the public URL for a given object key.
 *
 * If S3_PUBLIC_URL is set, it is used as the base (e.g. a CDN or R2 custom domain).
 * Otherwise, falls back to the standard S3 URL pattern.
 */
export function getPublicUrl(key: string): string {
  const publicBase = process.env.S3_PUBLIC_URL;
  if (publicBase) {
    // Strip trailing slash from base, ensure key has no leading slash
    const base = publicBase.replace(/\/+$/, "");
    const normalizedKey = key.replace(/^\/+/, "");
    return `${base}/${normalizedKey}`;
  }

  // Standard S3 URL fallback
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION || "auto";
  const endpoint = process.env.S3_ENDPOINT;

  if (endpoint) {
    // For custom endpoints, construct URL from the endpoint
    const base = endpoint.replace(/\/+$/, "");
    return `${base}/${bucket}/${key}`;
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/** Key of the WebP sibling stored next to a raster original. */
export function webpKey(key: string): string {
  return `${key}.webp`;
}

/** Whether we generate a WebP sibling for this content type. */
export function isWebpConvertible(contentType: string): boolean {
  return /^image\/(png|jpe?g)$/i.test(contentType);
}

/**
 * Re-encode a raster image as WebP at the same dimensions.
 * Quality 80 cuts our AI-generated PNGs by ~85-90% with no visible loss.
 */
export async function toWebp(buffer: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(buffer).webp({ quality: 80, effort: 5 }).toBuffer();
}

/**
 * Upload a file buffer to storage.
 *
 * When cloud storage is configured, uploads to the bucket (plus a WebP
 * sibling for raster images) and returns the public URL — or, for a private
 * bucket, the app-served path. Otherwise, saves to the stored_images table.
 * Either way the app-served path looks like `/uploads/study-images/file.png`.
 *
 * @param buffer   The file contents
 * @param key      The object key / relative path (e.g. `study-images/file.png`)
 * @param contentType  MIME type (e.g. `image/png`)
 * @returns The public URL or local relative path
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  if (isCloudStorageConfigured()) {
    return uploadToS3(buffer, key, contentType);
  }
  // Database storage — no filesystem dependency, enables zero-downtime deploys
  return saveToDatabase(buffer, key, contentType);
}

/**
 * Delete a file from storage.
 *
 * For cloud storage, deletes the object from the bucket.
 * For local storage, deletes the file from disk.
 */
export async function deleteFile(key: string): Promise<void> {
  if (isCloudStorageConfigured()) {
    return deleteFromS3(key);
  }
  return deleteFromDatabase(key);
}

// ---------------------------------------------------------------------------
// S3 operations
// ---------------------------------------------------------------------------

async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  const bucket = process.env.S3_BUCKET!;
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  });

  await client.send(command);

  if (isWebpConvertible(contentType)) {
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: webpKey(key),
          Body: await toWebp(buffer),
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    } catch (err) {
      // The original is stored; the route falls back to it without a WebP.
      logger.error("WebP sibling upload failed", err, "Storage", { key });
    }
  }

  const url = process.env.S3_PUBLIC_URL
    ? getPublicUrl(key)
    : `/uploads/${key.replace(/\\/g, "/")}`;
  logger.info("File uploaded to S3", "Storage", { key, bucket, url });
  return url;
}

async function deleteFromS3(key: string): Promise<void> {
  const bucket = process.env.S3_BUCKET!;
  const client = getS3Client();

  for (const k of [key, webpKey(key)]) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: k }));
  }
  logger.info("File deleted from S3", "Storage", { key, bucket });
}

// ---------------------------------------------------------------------------
// Database storage (default — no volume dependency)
// ---------------------------------------------------------------------------

async function saveToDatabase(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  const { pool } = await import("../db");

  // Upsert: replace if key already exists
  await pool.query(
    `INSERT INTO stored_images (key, data, content_type, size)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (key) DO UPDATE SET data = $2, content_type = $3, size = $4`,
    [key, buffer, contentType, buffer.length],
  );

  const relativePath = `/uploads/${key.replace(/\\/g, "/")}`;
  logger.info("File saved to database", "Storage", { path: relativePath, size: buffer.length });
  return relativePath;
}

async function deleteFromDatabase(key: string): Promise<void> {
  const { pool } = await import("../db");
  await pool.query(`DELETE FROM stored_images WHERE key = $1`, [key]);
  logger.info("File deleted from database", "Storage", { key });
}

async function getFromS3(
  key: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    const res = await getS3Client().send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }),
    );
    if (!res.Body) return null;
    return {
      data: Buffer.from(await res.Body.transformToByteArray()),
      contentType: res.ContentType || "application/octet-stream",
    };
  } catch (err: any) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Fetch an uploaded image by key for the /uploads route.
 *
 * With cloud storage configured, reads the bucket — the WebP sibling first
 * when `preferWebp` is set — and falls back to the stored_images table for
 * anything not yet migrated. Returns null if not found anywhere.
 */
export async function getStoredImage(
  key: string,
  opts: { preferWebp?: boolean } = {},
): Promise<{ data: Buffer; contentType: string } | null> {
  if (isCloudStorageConfigured()) {
    if (opts.preferWebp) {
      const webp = await getFromS3(webpKey(key));
      if (webp) return webp;
    }
    const original = await getFromS3(key);
    if (original) return original;
  }

  const { pool } = await import("../db");
  const result = await pool.query(
    `SELECT data, content_type FROM stored_images WHERE key = $1 LIMIT 1`,
    [key],
  );
  if (result.rows.length === 0) return null;
  return {
    data: result.rows[0].data,
    contentType: result.rows[0].content_type,
  };
}

// ---------------------------------------------------------------------------
// Local filesystem operations (legacy fallback)
// ---------------------------------------------------------------------------

async function saveToLocal(buffer: Buffer, key: string): Promise<string> {
  const uploadDir = path.join(process.cwd(), "uploads", path.dirname(key));
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const filePath = path.join(process.cwd(), "uploads", key);
  fs.writeFileSync(filePath, buffer);
  const relativePath = `/uploads/${key.replace(/\\/g, "/")}`;
  logger.info("File saved to local filesystem", "Storage", { path: relativePath });
  return relativePath;
}

async function deleteFromLocal(key: string): Promise<void> {
  const filePath = path.join(process.cwd(), "uploads", key);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    logger.info("File deleted from local filesystem", "Storage", { path: filePath });
  }
}
