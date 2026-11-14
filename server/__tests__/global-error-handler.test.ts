import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import http from "http";
import zlib from "zlib";

const reportError = vi.fn();
vi.mock("../utils/error-reporting", () => ({ reportError: (...a: any[]) => reportError(...a) }));

const { globalErrorHandler } = await import("../utils/error-handler");

function buildApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.post("/boom", () => {
    throw new TypeError("Cannot read properties of undefined");
  });
  app.post("/ok", (req, res) => res.json({ got: req.body }));
  app.use(globalErrorHandler);
  return app;
}

function post(app: express.Express, path: string, body: Buffer, headers: Record<string, string>) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as any;
      const req = http.request(
        { port, path, method: "POST", headers: { ...headers, "content-length": String(body.length) } },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            server.close();
            resolve({ status: res.statusCode!, body: data ? JSON.parse(data) : null });
          });
        },
      );
      req.on("error", (e) => { server.close(); reject(e); });
      req.end(body);
    });
  });
}

describe("globalErrorHandler body-parser client errors", () => {
  beforeEach(() => {
    reportError.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 415 for brotli-encoded bodies and does not report to Sentry", async () => {
    const res = await post(buildApp(), "/webhook", zlib.brotliCompressSync(Buffer.from("{}")), {
      "content-type": "application/json",
      "content-encoding": "br",
    });
    expect(res.status).toBe(415);
    expect(res.body.errorType).toBe("VALIDATION_ERROR");
    expect(reportError).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON without reporting", async () => {
    const res = await post(buildApp(), "/ok", Buffer.from("{bad"), { "content-type": "application/json" });
    expect(res.status).toBe(400);
    expect(reportError).not.toHaveBeenCalled();
  });

  it("still returns 500 and reports genuine server errors", async () => {
    const res = await post(buildApp(), "/boom", Buffer.from("{}"), { "content-type": "application/json" });
    expect(res.status).toBe(500);
    expect(reportError).toHaveBeenCalledTimes(1);
  });
});
