/**
 * Tests for server/services/ai-provider.ts (audit 2026-07, M1/M2/M2b):
 *  - M1: generateText must return the text block even when non-text blocks
 *    (e.g. thinking blocks under output_config.effort) come first, and must
 *    THROW (never silently return "") when no text block exists.
 *  - M2: falls back to OpenAI on retryable Anthropic failures (429/5xx/529,
 *    connection errors) when OpenAI is configured; rethrows otherwise, and
 *    never falls back on caller/config errors (400/401/403).
 *  - M2b: logs token usage after each successful Anthropic call.
 *
 * Mocking note: the real SDK's error classes (Anthropic.APIError etc.) are
 * static members of the default-export class and their constructors want full
 * request/response context, which is awkward to fabricate. The wrapper only
 * performs `instanceof` checks plus a `.status` read, so the mock ships minimal
 * Error subclasses in the same static positions with the same shape.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const mocks = vi.hoisted(() => {
  const messagesCreate = vi.fn();
  const openaiCreate = vi.fn();

  class MockAPIError extends Error {
    status?: number;
    constructor(status?: number, message?: string) {
      super(message ?? `Anthropic API error${status ? ` (${status})` : ""}`);
      this.status = status;
    }
  }
  class MockAPIConnectionError extends MockAPIError {
    constructor(message = "Connection error") {
      super(undefined, message);
    }
  }
  class MockAnthropic {
    static APIError = MockAPIError;
    static APIConnectionError = MockAPIConnectionError;
    messages = { create: messagesCreate };
    constructor(_opts?: unknown) {}
  }
  class MockOpenAI {
    chat = { completions: { create: openaiCreate } };
    constructor(_opts?: unknown) {}
  }
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  return {
    messagesCreate,
    openaiCreate,
    MockAnthropic,
    MockOpenAI,
    MockAPIError,
    MockAPIConnectionError,
    logger,
  };
});

vi.mock("@anthropic-ai/sdk", () => ({ default: mocks.MockAnthropic }));
vi.mock("openai", () => ({ default: mocks.MockOpenAI }));
vi.mock("../utils/logger", () => ({ logger: mocks.logger }));

const savedEnv = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  XAI_API_KEY: process.env.XAI_API_KEY,
};

/**
 * ai-provider caches provider clients in module state, so each test loads a
 * fresh module instance with the desired provider env configured.
 */
async function loadAi(env: { anthropic?: boolean; openai?: boolean }) {
  vi.resetModules();
  if (env.anthropic) process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  else delete process.env.ANTHROPIC_API_KEY;
  if (env.openai) process.env.OPENAI_API_KEY = "sk-oai-test";
  else delete process.env.OPENAI_API_KEY;
  delete process.env.XAI_API_KEY;
  return await import("../services/ai-provider");
}

function anthropicResponse(content: Array<Record<string, unknown>>) {
  return {
    content,
    usage: { input_tokens: 123, output_tokens: 45 },
    stop_reason: "end_turn",
  };
}

beforeEach(() => {
  mocks.messagesCreate.mockReset();
  mocks.openaiCreate.mockReset();
  mocks.logger.info.mockClear();
  mocks.logger.warn.mockClear();
  mocks.logger.error.mockClear();
});

afterAll(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("ai.generateText — text block extraction (M1)", () => {
  it("returns the text block even when a non-text block precedes it", async () => {
    const { ai } = await loadAi({ anthropic: true });
    mocks.messagesCreate.mockResolvedValueOnce(
      anthropicResponse([
        { type: "thinking", thinking: "" },
        { type: "text", text: "hello world" },
      ]),
    );

    await expect(ai.generateText("sys", "user")).resolves.toBe("hello world");
  });

  it("throws a descriptive error when the response has no text block", async () => {
    const { ai } = await loadAi({ anthropic: true, openai: true });
    mocks.messagesCreate.mockResolvedValueOnce(
      anthropicResponse([{ type: "tool_use", id: "t1", name: "x", input: {} }]),
    );

    await expect(ai.generateText("sys", "user")).rejects.toThrow(
      /contained no text block.*tool_use/,
    );
    // A malformed response is not a retryable transport error — no fallback.
    expect(mocks.openaiCreate).not.toHaveBeenCalled();
  });
});

describe("ai.generateText — OpenAI fallback on retryable errors (M2)", () => {
  it("falls back to OpenAI on a 529 APIError when OpenAI is configured", async () => {
    const { ai } = await loadAi({ anthropic: true, openai: true });
    mocks.messagesCreate.mockRejectedValueOnce(new mocks.MockAPIError(529, "Overloaded"));
    mocks.openaiCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "openai fallback text" } }],
    });

    await expect(ai.generateText("sys", "user")).resolves.toBe("openai fallback text");
    expect(mocks.openaiCreate).toHaveBeenCalledTimes(1);
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("falling back to OpenAI"),
      "AIProvider",
      expect.objectContaining({ status: 529 }),
    );
  });

  it("falls back to OpenAI on a connection error when OpenAI is configured", async () => {
    const { ai } = await loadAi({ anthropic: true, openai: true });
    mocks.messagesCreate.mockRejectedValueOnce(new mocks.MockAPIConnectionError());
    mocks.openaiCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "recovered" } }],
    });

    await expect(ai.generateText("sys", "user")).resolves.toBe("recovered");
  });

  it("rethrows a 529 APIError when OpenAI is NOT configured", async () => {
    const { ai } = await loadAi({ anthropic: true });
    const err = new mocks.MockAPIError(529, "Overloaded");
    mocks.messagesCreate.mockRejectedValueOnce(err);

    await expect(ai.generateText("sys", "user")).rejects.toBe(err);
    expect(mocks.openaiCreate).not.toHaveBeenCalled();
  });

  it("does NOT fall back on a 401 (config error must surface)", async () => {
    const { ai } = await loadAi({ anthropic: true, openai: true });
    const err = new mocks.MockAPIError(401, "invalid x-api-key");
    mocks.messagesCreate.mockRejectedValueOnce(err);

    await expect(ai.generateText("sys", "user")).rejects.toBe(err);
    expect(mocks.openaiCreate).not.toHaveBeenCalled();
    expect(mocks.logger.warn).not.toHaveBeenCalled();
  });
});

describe("ai.generateText — Anthropic request payload shape", () => {
  function okText() {
    return anthropicResponse([{ type: "text", text: "ok" }]);
  }

  it("omits the temperature field when temperature: null is passed", async () => {
    const { ai, MODELS } = await loadAi({ anthropic: true });
    mocks.messagesCreate.mockResolvedValueOnce(okText());

    await ai.generateText("sys", "user", { model: MODELS.HAIKU, temperature: null });

    const [body] = mocks.messagesCreate.mock.calls[0];
    expect(body).not.toHaveProperty("temperature");
  });

  it("defaults temperature to 0.3 when not specified (temperature-capable model)", async () => {
    const { ai, MODELS } = await loadAi({ anthropic: true });
    mocks.messagesCreate.mockResolvedValueOnce(okText());

    await ai.generateText("sys", "user", { model: MODELS.SONNET });

    const [body] = mocks.messagesCreate.mock.calls[0];
    expect(body.temperature).toBe(0.3);
  });

  it("does not send effort (output_config) for Haiku even when requested", async () => {
    const { ai, MODELS } = await loadAi({ anthropic: true });
    mocks.messagesCreate.mockResolvedValueOnce(okText());

    await ai.generateText("sys", "user", { model: MODELS.HAIKU, effort: "low" });

    const [body] = mocks.messagesCreate.mock.calls[0];
    expect(body).not.toHaveProperty("output_config");
  });

  it("omits temperature and effort for model IDs not in the capability map", async () => {
    const { ai } = await loadAi({ anthropic: true });
    mocks.messagesCreate.mockResolvedValueOnce(okText());

    // Unknown model (e.g. mid-migration override): omitting is always safe;
    // sending an unsupported param would be a non-retryable 400.
    await ai.generateText("sys", "user", { model: "claude-future-model-9", effort: "low" });

    const [body] = mocks.messagesCreate.mock.calls[0];
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("output_config");
  });

  it("uses a 120s per-request timeout when maxTokens > 2048", async () => {
    const { ai, MODELS } = await loadAi({ anthropic: true });
    mocks.messagesCreate.mockResolvedValueOnce(okText());

    await ai.generateText("sys", "user", { model: MODELS.OPUS, maxTokens: 3000 });

    const [, requestOptions] = mocks.messagesCreate.mock.calls[0];
    expect(requestOptions).toMatchObject({ timeout: 120_000 });
  });

  it("uses a 60s per-request timeout when maxTokens <= 2048", async () => {
    const { ai, MODELS } = await loadAi({ anthropic: true });
    mocks.messagesCreate.mockResolvedValueOnce(okText());

    await ai.generateText("sys", "user", { model: MODELS.HAIKU, maxTokens: 200 });

    const [, requestOptions] = mocks.messagesCreate.mock.calls[0];
    expect(requestOptions).toMatchObject({ timeout: 60_000 });
  });
});

describe("ai.generateText — usage logging (M2b)", () => {
  it("logs input/output token usage with model and caller tag", async () => {
    const { ai, MODELS } = await loadAi({ anthropic: true });
    mocks.messagesCreate.mockResolvedValueOnce(
      anthropicResponse([{ type: "text", text: "ok" }]),
    );

    await ai.generateText("sys", "user", { model: MODELS.HAIKU, caller: "Test.caller" });

    expect(mocks.logger.info).toHaveBeenCalledWith(
      "Anthropic usage",
      "AIProvider",
      expect.objectContaining({
        model: MODELS.HAIKU,
        caller: "Test.caller",
        inputTokens: 123,
        outputTokens: 45,
      }),
    );
  });
});
