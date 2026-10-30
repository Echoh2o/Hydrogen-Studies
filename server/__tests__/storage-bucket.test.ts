/**
 * Unit tests for the bucket-backed image storage (server/utils/storage.ts).
 *
 * Mocked S3 client + mocked pg pool (repo convention: no integration DB).
 * Locks in the 2026-10 move of images out of Postgres:
 *   - uploads write the original AND a `<key>.webp` sibling, and return the
 *     stable app-served /uploads path (Railway buckets are private)
 *   - reads prefer the WebP sibling only when asked, fall back to the
 *     original, then to the stored_images table for unmigrated keys
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import sharp from "sharp";

const objects = new Map<string, { body: Buffer; contentType: string }>();
const send = vi.fn(async (cmd: any) => {
  const { Key, Body, ContentType } = cmd.input;
  switch (cmd.constructor.name) {
    case "PutObjectCommand":
      objects.set(Key, { body: Body, contentType: ContentType });
      return {};
    case "DeleteObjectCommand":
      objects.delete(Key);
      return {};
    case "GetObjectCommand": {
      const o = objects.get(Key);
      if (!o) throw Object.assign(new Error("missing"), { name: "NoSuchKey" });
      return {
        Body: { transformToByteArray: async () => new Uint8Array(o.body) },
        ContentType: o.contentType,
      };
    }
  }
  throw new Error(`unexpected command ${cmd.constructor.name}`);
});

vi.mock("@aws-sdk/client-s3", async (orig) => {
  const real: any = await orig();
  return {
    ...real,
    S3Client: class {
      send = send;
    },
  };
});

const dbQuery = vi.fn();
vi.mock("../db", () => ({ pool: { query: (...a: unknown[]) => dbQuery(...a) } }));
vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const ENV = {
  S3_BUCKET: "test-bucket",
  S3_ENDPOINT: "https://example.test",
  S3_ACCESS_KEY_ID: "id",
  S3_SECRET_ACCESS_KEY: "secret",
};

async function png(): Promise<Buffer> {
  return sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 120, b: 200 } },
  }).png().toBuffer();
}

describe("bucket image storage", () => {
  beforeEach(() => {
    objects.clear();
    send.mockClear();
    dbQuery.mockReset();
    Object.assign(process.env, ENV);
    delete process.env.S3_PUBLIC_URL;
  });
  afterEach(() => {
    for (const k of Object.keys(ENV)) delete process.env[k];
  });

  it("uploads the original plus a WebP sibling and returns the /uploads path", async () => {
    const { uploadFile } = await import("../utils/storage");
    const buf = await png();

    const url = await uploadFile(buf, "blog-images/a.png", "image/png");

    expect(url).toBe("/uploads/blog-images/a.png");
    expect(objects.get("blog-images/a.png")?.contentType).toBe("image/png");
    const webp = objects.get("blog-images/a.png.webp");
    expect(webp?.contentType).toBe("image/webp");
    expect((await sharp(webp!.body).metadata()).format).toBe("webp");
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it("does not create a WebP sibling for non-raster types", async () => {
    const { uploadFile } = await import("../utils/storage");
    await uploadFile(Buffer.from("<svg/>"), "x/a.svg", "image/svg+xml");
    expect([...objects.keys()]).toEqual(["x/a.svg"]);
  });

  it("serves the WebP sibling only when the client accepts WebP", async () => {
    const { uploadFile, getStoredImage } = await import("../utils/storage");
    await uploadFile(await png(), "study-images/s.png", "image/png");

    const webp = await getStoredImage("study-images/s.png", { preferWebp: true });
    const original = await getStoredImage("study-images/s.png");

    expect(webp?.contentType).toBe("image/webp");
    expect(original?.contentType).toBe("image/png");
  });

  it("falls back to the original when no WebP sibling exists", async () => {
    const { getStoredImage } = await import("../utils/storage");
    objects.set("blog-images/old.png", { body: Buffer.from("png"), contentType: "image/png" });

    const img = await getStoredImage("blog-images/old.png", { preferWebp: true });

    expect(img?.contentType).toBe("image/png");
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it("falls back to stored_images for keys not yet in the bucket", async () => {
    const { getStoredImage } = await import("../utils/storage");
    dbQuery.mockResolvedValue({ rows: [{ data: Buffer.from("db"), content_type: "image/png" }] });

    const img = await getStoredImage("blog-images/unmigrated.png", { preferWebp: true });

    expect(img?.data.toString()).toBe("db");
    expect(dbQuery).toHaveBeenCalledOnce();
  });

  it("deletes both the original and the WebP sibling", async () => {
    const { uploadFile, deleteFile } = await import("../utils/storage");
    await uploadFile(await png(), "blog-images/d.png", "image/png");
    await deleteFile("blog-images/d.png");
    expect(objects.size).toBe(0);
  });
});
