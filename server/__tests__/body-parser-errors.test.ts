import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";

// Scanner POSTs with bodies express.json() can't read (Brotli-encoded,
// malformed, oversized) were answered 500 and reported to Sentry
// (HYDROGEN-STUDIES-SERVER-E). They are the client's fault: 4xx, no report.
const reportError = vi.fn();
vi.mock("../utils/error-reporting", () => ({ reportError: (...a: unknown[]) => reportError(...a) }));

const { globalErrorHandler } = await import("../utils/error-handler");

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  app.post("/webhook", (_req, res) => res.json({ ok: true }));
  app.use(globalErrorHandler);
  await new Promise<void>((r) => (server = app.listen(0, "127.0.0.1", () => r())));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const post = (body: string, headers: Record<string, string> = {}) =>
  fetch(`${base}/webhook`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body });

describe("unreadable request bodies", () => {
  it.each([
    ["unsupported content encoding", () => post("{}", { "content-encoding": "br" }), 415],
    ["malformed JSON", () => post("{bad json"), 400],
    ["oversized body", () => post(JSON.stringify({ x: "a".repeat(5000) })), 413],
  ])("%s → client error, not reported", async (_label, send, status) => {
    reportError.mockClear();
    const res = await send();
    expect(res.status).toBe(status);
    expect(reportError).not.toHaveBeenCalled();
  });
});
