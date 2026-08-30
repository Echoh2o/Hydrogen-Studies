/**
 * Regression test for the login 500 bug.
 *
 * Symptom: a specific account got "Something went wrong on our end" (HTTP 500)
 * on login while others were fine. Root cause: the login handler called
 * `bcrypt.compare(password, user.passwordHash || "")` unguarded. bcrypt.compare
 * REJECTS when the stored hash is null/empty/malformed (e.g. an account created
 * via import/Shopify sync that never had a password set), so a normal failed
 * login threw and was mapped to a 500 for that account.
 *
 * The fix (verifyPassword) fails closed: any missing/invalid hash or compare
 * error returns false (invalid credentials) and NEVER throws. This test pins
 * that contract with real bcrypt.
 *
 * Mocked-db unit test per repo convention — importing the route module pulls in
 * ../db, so we stub it (verifyPassword itself never touches the DB).
 */
import { describe, it, expect, vi } from "vitest";
import bcrypt from "bcrypt";

vi.mock("../db", () => ({
  db: {},
  pool: {},
}));

const { verifyPassword } = await import("../routes/auth-routes");

describe("verifyPassword — never throws, fails closed on bad hashes", () => {
  it("returns false for a null stored hash (no password on file)", async () => {
    await expect(verifyPassword("anything", null)).resolves.toBe(false);
  });

  it("returns false for an undefined stored hash", async () => {
    await expect(verifyPassword("anything", undefined)).resolves.toBe(false);
  });

  it("returns false for an empty stored hash", async () => {
    await expect(verifyPassword("anything", "")).resolves.toBe(false);
  });

  it("returns false (does not throw) for a malformed, non-bcrypt hash", async () => {
    await expect(
      verifyPassword("anything", "not-a-real-bcrypt-hash"),
    ).resolves.toBe(false);
  });

  it("returns true for the correct password against a valid bcrypt hash", async () => {
    const hash = bcrypt.hashSync("correct horse battery staple", 10);
    await expect(
      verifyPassword("correct horse battery staple", hash),
    ).resolves.toBe(true);
  });

  it("returns false for the wrong password against a valid bcrypt hash", async () => {
    const hash = bcrypt.hashSync("correct horse battery staple", 10);
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });
});
