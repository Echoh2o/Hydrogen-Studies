import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import geoRoutes from "../routes/geo-routes";

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(geoRoutes);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function geo(headers: Record<string, string> = {}) {
  const res = await fetch(`${base}/api/geo`, { headers });
  return { res, body: await res.json() };
}

describe("GET /api/geo", () => {
  it("EEA country → consentRequired true", async () => {
    const { res, body } = await geo({ "CF-IPCountry": "DE" });
    expect(res.status).toBe(200);
    expect(body).toEqual({ country: "DE", consentRequired: true });
  });

  it("UK and Switzerland → consentRequired true", async () => {
    expect((await geo({ "CF-IPCountry": "GB" })).body.consentRequired).toBe(true);
    expect((await geo({ "CF-IPCountry": "CH" })).body.consentRequired).toBe(true);
  });

  it("US → consentRequired false", async () => {
    const { body } = await geo({ "CF-IPCountry": "US" });
    expect(body).toEqual({ country: "US", consentRequired: false });
  });

  it("missing header (local dev) → consentRequired false, country null", async () => {
    const { body } = await geo();
    expect(body).toEqual({ country: null, consentRequired: false });
  });

  it("normalizes case", async () => {
    const { body } = await geo({ "CF-IPCountry": "fr" });
    expect(body).toEqual({ country: "FR", consentRequired: true });
  });

  it("Cloudflare unknown/Tor codes → consentRequired true", async () => {
    expect((await geo({ "CF-IPCountry": "XX" })).body.consentRequired).toBe(true);
    expect((await geo({ "CF-IPCountry": "T1" })).body.consentRequired).toBe(true);
  });

  it("garbage header → country null, not required", async () => {
    const { body } = await geo({ "CF-IPCountry": "<script>" });
    expect(body).toEqual({ country: null, consentRequired: false });
  });

  it("is never cached (per-visitor answer; safe behind Cloudflare)", async () => {
    const { res } = await geo({ "CF-IPCountry": "DE" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("does not set cookies", async () => {
    const { res } = await geo({ "CF-IPCountry": "DE" });
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
