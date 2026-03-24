/**
 * Storage Utility for Hydrogen Studies
 *
 * S3-compatible upload abstraction that supports AWS S3, Cloudflare R2,
 * DigitalOcean Spaces, or any S3-compatible service.
 *
 * Falls back to local filesystem if S3_BUCKET is not configured,
 * so nothing breaks for existing users or local development.
 *
 * Environment variables:
 *   S3_BUCKET          — bucket name (required to enable cloud storage)
 *   S3_REGION          — region (default: "auto" for R2)
 *   S3_ENDPOINT        — custom endpoint for R2/Spaces
 *   S3_ACCESS_KEY_ID   — access key
 *   S3_SECRET_ACCESS_KEY — secret key
 *   S3_PUBLIC_URL      — public URL prefix for served files
 */
import fs from "fs";
import path from "path";
import {
  S3Client,
  PutObjectCommand,
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
      // Required for path-style access with some S3-compatible services
      forcePathStyle: !!endpoint,
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

/**
 * Upload a file buffer to storage.
 *
 * When cloud storage is configured, uploads to S3/R2/Spaces and returns
 * the public URL. Otherwise, saves to the local `uploads/` directory and
 * returns the relative path (e.g. `/uploads/study-images/file.png`).
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
  return saveToLocal(buffer, key);
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
  return deleteFromLocal(key);
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

  const url = getPublicUrl(key);
  logger.info("File uploaded to S3", "Storage", { key, bucket, url });
  return url;
}

async function deleteFromS3(key: string): Promise<void> {
  const bucket = process.env.S3_BUCKET!;
  const client = getS3Client();

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await client.send(command);
  logger.info("File deleted from S3", "Storage", { key, bucket });
}

// ---------------------------------------------------------------------------
// Local filesystem operations (fallback)
// ---------------------------------------------------------------------------

async function saveToLocal(buffer: Buffer, key: string): Promise<string> {
  // key is something like "study-images/file.png" or "blog-images/file.png"
  const uploadDir = path.join(process.cwd(), "uploads", path.dirname(key));
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filePath = path.join(process.cwd(), "uploads", key);
  fs.writeFileSync(filePath, buffer);

  // Return web-accessible relative path with forward slashes
  const relativePath = `/uploads/${key.replace(/\\/g, "/")}`;
  logger.info("File saved to local filesystem", "Storage", {
    path: relativePath,
  });
  return relativePath;
}

async function deleteFromLocal(key: string): Promise<void> {
  const filePath = path.join(process.cwd(), "uploads", key);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    logger.info("File deleted from local filesystem", "Storage", {
      path: filePath,
    });
  }
}
