import { describe, it, expect, vi } from "vitest";

// Batched ONNX inference over study-length texts grows the runtime's native
// memory arena by 1–2 GB and never gives it back (measured 2026-11-22: RSS
// 272 MB → 2.4 GB embedding 50 studies in batches of 32; ~300 MB one text at a
// time). Prod stepped up ~1.2 GB on every background sync. Embed one at a time.
const calls: number[] = [];
vi.mock("@huggingface/transformers", () => ({
  env: {},
  pipeline: async () => async (input: string | string[]) => {
    const texts = Array.isArray(input) ? input : [input];
    calls.push(texts.length);
    return { tolist: () => texts.map(() => [1, 0, 0]) };
  },
}));

const rows = Array.from({ length: 5 }, (_, i) => ({
  id: i + 1,
  title: `Study ${i + 1}`,
  plain_language_title: null,
  key_finding: null,
  health_conditions: null,
  abstract: "word ".repeat(400),
  content_hash: null,
}));
vi.mock("../db", () => ({
  db: { execute: vi.fn(async () => ({ rows })) },
}));

const emb = await import("../services/study-embeddings");

describe("syncEmbeddings batching", () => {
  it("runs the model on one study at a time", async () => {
    const result = await emb.syncEmbeddings({ limit: 50 });
    expect(result.embedded).toBe(5);
    expect(calls).toEqual([1, 1, 1, 1, 1]);
  });
});
