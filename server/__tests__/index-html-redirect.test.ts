import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { redirectIndexHtml } from "../middleware/index-html-redirect";

const app = express();
app.use(redirectIndexHtml);
app.get("*", (_req, res) => res.send("shell"));

describe("/index.html redirect", () => {
  it("301s GET /index.html to /", async () => {
    const r = await request(app).get("/index.html");
    expect(r.status).toBe(301);
    expect(r.headers.location).toBe("/");
  });
  it("301s HEAD and keeps the query string", async () => {
    const r = await request(app).head("/index.html?utm_source=x");
    expect(r.status).toBe(301);
    expect(r.headers.location).toBe("/?utm_source=x");
  });
  it("leaves other paths alone", async () => {
    expect((await request(app).get("/")).status).toBe(200);
    expect((await request(app).get("/blog/index.html")).status).toBe(200);
  });
});
