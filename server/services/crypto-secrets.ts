/**
 * AES-256-GCM symmetric encryption for at-rest secrets (currently the
 * GSC OAuth refresh token).
 *
 * The encryption key lives in `system_secrets` keyed by a constant name.
 * On first boot, if no row exists, we generate a fresh 32-byte key and
 * persist it. Subsequent boots read the same key — without that
 * persistence, encrypted tokens become unreadable on every restart.
 *
 * In-process cache avoids hitting the DB for every encrypt/decrypt call.
 */

import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { systemSecrets } from "@shared/schema";
import { logger } from "../utils/logger";

const TAG = "CryptoSecrets";
const GSC_TOKEN_KEY_NAME = "gsc_token_encryption_key";
const KEY_LENGTH = 32; // AES-256
const IV_LENGTH = 12; // GCM standard
const TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;

/** Idempotent boot setup — creates the system_secrets table if not present. */
let ensurePromise: Promise<void> | null = null;
export function ensureSystemSecretsTable(): Promise<void> {
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS system_secrets (
          key_name text PRIMARY KEY,
          value text NOT NULL,
          created_at timestamp NOT NULL DEFAULT NOW()
        )
      `);
    } catch (err) {
      ensurePromise = null;
      logger.error("Failed to ensure system_secrets table", err, TAG);
      throw err;
    }
  })();
  return ensurePromise;
}

/**
 * Get (or lazily generate + persist) the GSC token encryption key.
 * Cached in-process after the first call.
 */
async function getGscEncryptionKey(): Promise<Buffer> {
  if (cachedKey) return cachedKey;
  await ensureSystemSecretsTable();

  const [existing] = await db
    .select()
    .from(systemSecrets)
    .where(sql`${systemSecrets.keyName} = ${GSC_TOKEN_KEY_NAME}`)
    .limit(1);

  if (existing?.value) {
    cachedKey = Buffer.from(existing.value, "base64");
    if (cachedKey.length !== KEY_LENGTH) {
      throw new Error(
        `Encryption key has wrong length (${cachedKey.length}, expected ${KEY_LENGTH}). ` +
          `Refusing to use it.`,
      );
    }
    return cachedKey;
  }

  // First boot — generate and persist. Use ON CONFLICT to handle a
  // simultaneous-first-request race where two instances both miss the
  // cache and both try to insert.
  const newKey = randomBytes(KEY_LENGTH);
  await db.execute(sql`
    INSERT INTO system_secrets (key_name, value)
    VALUES (${GSC_TOKEN_KEY_NAME}, ${newKey.toString("base64")})
    ON CONFLICT (key_name) DO NOTHING
  `);

  // Re-read in case another instance won the race; that row's key wins.
  const [confirmed] = await db
    .select()
    .from(systemSecrets)
    .where(sql`${systemSecrets.keyName} = ${GSC_TOKEN_KEY_NAME}`)
    .limit(1);
  cachedKey = Buffer.from(confirmed!.value, "base64");
  logger.info("Generated and persisted GSC encryption key", TAG);
  return cachedKey;
}

/**
 * Encrypt a string. Output format: base64(iv || authTag || ciphertext).
 * GCM gives both confidentiality and integrity; tampering is detected
 * on decrypt and throws.
 */
export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await getGscEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/**
 * Decrypt a value produced by `encryptSecret`. Throws if the auth tag
 * doesn't match (tampering or wrong key).
 */
export async function decryptSecret(ciphertextB64: string): Promise<string> {
  const key = await getGscEncryptionKey();
  const buf = Buffer.from(ciphertextB64, "base64");
  if (buf.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Ciphertext too short to contain IV + auth tag");
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
