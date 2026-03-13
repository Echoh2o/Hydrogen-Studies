import { describe, it, expect, vi, beforeEach } from "vitest";
import { trackError } from "../../../client/src/lib/error-tracking";

describe("trackError", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", {
      userAgent: "test-agent",
      sendBeacon: vi.fn(),
    });
    vi.stubGlobal("window", {
      location: { href: "http://localhost/test" },
      addEventListener: vi.fn(),
    });
  });

  it("should call sendBeacon with error data", () => {
    const error = new Error("Test error");
    trackError(error, "TestComponent");
    expect(navigator.sendBeacon).toHaveBeenCalled();
    const [url, body] = (navigator.sendBeacon as any).mock.calls[0];
    expect(url).toBe("/api/client-errors");
    const parsed = JSON.parse(body);
    expect(parsed.message).toContain("[TestComponent]");
    expect(parsed.message).toContain("Test error");
  });

  it("should include error stack", () => {
    const error = new Error("Stack test");
    trackError(error);
    const [, body] = (navigator.sendBeacon as any).mock.calls[0];
    const parsed = JSON.parse(body);
    expect(parsed.stack).toBeDefined();
  });

  it("should work without context parameter", () => {
    const error = new Error("No context");
    trackError(error);
    const [, body] = (navigator.sendBeacon as any).mock.calls[0];
    const parsed = JSON.parse(body);
    expect(parsed.message).toBe("No context");
  });

  it("should include timestamp", () => {
    trackError(new Error("Timestamp test"));
    const [, body] = (navigator.sendBeacon as any).mock.calls[0];
    const parsed = JSON.parse(body);
    expect(parsed.timestamp).toBeDefined();
    expect(new Date(parsed.timestamp).getTime()).not.toBeNaN();
  });
});
