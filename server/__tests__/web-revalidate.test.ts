/**
 * Admin edits reach the Next front door at once: notifyWebRevalidate posts
 * the changed path (plus the indexes it feeds) to web/app/web_revalidate.
 */
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("../utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { notifyWebRevalidate } = await import("../services/web-revalidate");

describe("notifyWebRevalidate", () => {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit & { headers: Record<string, string> }) => new Response("{}"));
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
    process.env.WEB_ORIGIN = "http://web.railway.internal:3000";
    process.env.PAGE_DATA_KEY = "k";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.WEB_ORIGIN;
    delete process.env.PAGE_DATA_KEY;
  });

  it("fans a blog post out to /blog and the homepage; studies to the homepage; nothing = all", async () => {
    const sent = () => JSON.parse(String(fetchMock.mock.calls.at(-1)![1].body)).paths;
    notifyWebRevalidate("/blog/x");
    expect(sent()).toEqual(["/blog/x", "/blog", "/"]);
    notifyWebRevalidate("/study/y");
    expect(sent()).toEqual(["/study/y", "/"]);
    notifyWebRevalidate();
    expect(sent()).toEqual([]);
    expect(fetchMock.mock.calls[0][0]).toBe("http://web.railway.internal:3000/web_revalidate");
    expect(fetchMock.mock.calls[0][1].headers["x-page-data-key"]).toBe("k");
  });

  it("does nothing without WEB_ORIGIN", async () => {
    delete process.env.WEB_ORIGIN;
    notifyWebRevalidate("/blog/x");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
