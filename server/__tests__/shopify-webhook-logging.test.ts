/**
 * Shopify webhook logs must not carry customer emails, and the high-volume
 * customer-updated log must be debug level (skipped in production).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "crypto";

const logger = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
const sync = vi.hoisted(() => vi.fn(async () => ({ status: "exists", userId: "u1", email: "x" })));

vi.mock("../utils/logger", () => ({ logger }));
vi.mock("../db", () => {
  const chain: any = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") return (r: any, j: any) => Promise.resolve([{ id: "user-1" }]).then(r, j);
      return () => chain;
    },
    apply: () => chain,
  });
  return { db: { select: () => chain } };
});
vi.mock("../services/shopify-customer-sync", () => ({
  syncShopifyCustomerPayload: sync,
  backfillShopifyCustomers: vi.fn(),
}));
vi.mock("../services/shopify-client", () => ({ shopifyApiConfigured: () => false }));
vi.mock("../auth", () => ({ requireAdmin: (_req: any, _res: any, next: any) => next() }));

const SECRET = "test-webhook-secret";
process.env.SHOPIFY_WEBHOOK_SECRET = SECRET;
const { default: router } = await import("../routes/shopify-webhook-routes");

function makeApp() {
  const app = express();
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use("/api/webhooks/shopify", router);
  return app;
}

function post(path: string, body: unknown) {
  const raw = JSON.stringify(body);
  const hmac = crypto.createHmac("sha256", SECRET).update(raw).digest("base64");
  return request(makeApp())
    .post(`/api/webhooks/shopify${path}`)
    .set("Content-Type", "application/json")
    .set("X-Shopify-Hmac-Sha256", hmac)
    .send(raw);
}

const EMAIL = "Person@Example.com";

function allLoggedPayloads(): string {
  return JSON.stringify([
    ...logger.info.mock.calls,
    ...logger.debug.mock.calls,
    ...logger.warn.mock.calls,
  ]).toLowerCase();
}

describe("Shopify webhook logging", () => {
  beforeEach(() => {
    for (const fn of Object.values(logger)) fn.mockClear();
  });

  it("customer-updated logs at debug, without the email", async () => {
    const res = await post("/customer-updated", { id: 1, email: EMAIL });
    expect(res.status).toBe(200);
    expect(logger.info).not.toHaveBeenCalledWith("Customer updated", expect.anything(), expect.anything());
    expect(logger.debug).toHaveBeenCalledWith("Customer updated", "Shopify", { userId: "user-1" });
    expect(allLoggedPayloads()).not.toContain(EMAIL.toLowerCase());
  });

  it("customer-created and order-created INFO logs omit the email", async () => {
    await post("/customer-created", { id: 2, email: EMAIL });
    await post("/order-created", { id: 3, email: EMAIL, total_price: "10.00", customer: { id: 2 } });
    expect(logger.info).toHaveBeenCalledWith("Customer created webhook received", "Shopify", { shopifyCustomerId: 2 });
    expect(logger.info).toHaveBeenCalledWith(
      "Order created",
      "Shopify",
      expect.objectContaining({ orderId: 3, shopifyCustomerId: 2 }),
    );
    expect(allLoggedPayloads()).not.toContain(EMAIL.toLowerCase());
  });
});
