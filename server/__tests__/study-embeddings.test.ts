import { describe, it, expect, vi } from "vitest";

vi.mock("../db", () => ({ db: { execute: vi.fn(async () => ({ rows: [] })) } }));
vi.mock("@huggingface/transformers", () => {
  throw new Error("model must not load in these tests");
});

const emb = await import("../services/study-embeddings");

describe("study-embeddings", () => {
  it("builds embedding text from our titles, finding, conditions and the abstract opening", () => {
    const text = emb.embeddingText({
      title: "Original title",
      plain_language_title: "Plain title",
      key_finding: "It helped.",
      health_conditions: ["Fatigue", "Sleep"],
      abstract: `<p>Background</p> ${"word ".repeat(1000)}`,
    });
    expect(text.split("\n").slice(0, 4)).toEqual(["Plain title", "Original title", "It helped.", "Conditions: Fatigue, Sleep"]);
    expect(text).not.toMatch(/<p>/);
    expect(text.split("\n")[4].length).toBeLessThanOrEqual(2000);
  });

  it("hashes text with the model so a model change re-embeds everything", () => {
    expect(emb.contentHash("a")).toBe(emb.contentHash("a"));
    expect(emb.contentHash("a")).not.toBe(emb.contentHash("b"));
  });

  it("dot of unit vectors is cosine similarity", () => {
    const a = emb.normalize([3, 4]);
    expect(emb.dot(a, a)).toBeCloseTo(1);
    expect(emb.dot(emb.normalize([1, 0]), emb.normalize([0, 1]))).toBeCloseTo(0);
  });

  it("returns no scores — and never loads the model — when no study is embedded", async () => {
    expect((await emb.semanticScores("anything")).size).toBe(0);
  });
});
