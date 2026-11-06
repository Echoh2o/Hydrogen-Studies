import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { stripSentinels, stripSentinelValues } from "../middleware/strip-sentinels";

describe("stripSentinelValues", () => {
  it("nulls pipeline sentinels anywhere in the body, keeps real text", () => {
    const out = stripSentinelValues({
      key_finding: "__no_content__",
      tldr: " __NO_CONTENT__ ",
      title: "Hydrogen water and recovery",
      outcome: "none",
      tags: ["__x__", "sleep"],
      related: [{ key_finding: "__no_content__", n: 3 }],
      when: null,
    });
    expect(out).toEqual({
      key_finding: null,
      tldr: null,
      title: "Hydrogen water and recovery",
      outcome: "none",
      tags: [null, "sleep"],
      related: [{ key_finding: null, n: 3 }],
      when: null,
    });
  });

  it("leaves non-plain objects (Dates) alone", () => {
    const d = new Date("2026-11-05");
    expect(stripSentinelValues({ d }).d).toBe(d);
  });
});

describe("stripSentinels middleware", () => {
  it("applies to res.json", async () => {
    const app = express();
    app.use("/api/studies", stripSentinels, (_req, res) => { res.json({ id: 1, key_finding: "__no_content__" }); });
    const r = await request(app).get("/api/studies/1");
    expect(r.body).toEqual({ id: 1, key_finding: null });
  });
});
