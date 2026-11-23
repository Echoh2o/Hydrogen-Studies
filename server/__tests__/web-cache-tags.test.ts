/**
 * web/lib/page-data.ts cacheTag(): Next drops cache tags over 256 chars, so
 * long study-slug tags must map to a stable short form — and the revalidate
 * route must apply the same mapping so busting still works.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const nextCache = vi.hoisted(() => ({
  unstable_cache: vi.fn((fn: () => unknown, _keys: string[], _opts: { tags: string[] }) => fn),
  revalidateTag: vi.fn(),
}));
vi.mock("next/cache", () => nextCache);
// The server vitest project has no @web alias; point the route's import at
// the real module (not a stub) so both sides share one cacheTag.
vi.mock("@web/lib/page-data", () => import("../../web/lib/page-data"));

const { cacheTag, expressJson, PAGE_DATA_TAG } = await import("../../web/lib/page-data");
// Non-literal specifier: keeps the root tsc (which lacks web/'s @web path
// alias) from type-checking the route; web/ is checked by its own build.
const routePath = "../../web/app/web_revalidate/route";
const { POST } = (await import(/* @vite-ignore */ routePath)) as {
  POST: (req: Request) => Promise<Response>;
};

const longPath = "/study/" + "hydrogen-rich-water-".repeat(20) + "pmid-12345678";

describe("cacheTag", () => {
  it("leaves normal tags untouched", () => {
    expect(cacheTag("/study/short-slug")).toBe("/study/short-slug");
    expect(cacheTag("x".repeat(200))).toBe("x".repeat(200));
  });

  it("maps long tags to a stable, short, distinct form", () => {
    expect(longPath.length).toBeGreaterThan(256);
    const t = cacheTag(longPath);
    expect(t.length).toBeLessThanOrEqual(200);
    expect(t).toBe(cacheTag(longPath));
    expect(t.startsWith("/study/hydrogen-rich-water-")).toBe(true);
    expect(cacheTag(longPath + "x")).not.toBe(t);
  });
});

describe("cache and revalidate use the same mapping", () => {
  beforeEach(() => {
    nextCache.unstable_cache.mockClear();
    nextCache.revalidateTag.mockClear();
    process.env.PAGE_DATA_KEY = "k";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  });

  it("the tag a long path is cached under is the tag revalidation busts", async () => {
    await expressJson("/api/page-data/x", 60, [longPath]);
    const tags = nextCache.unstable_cache.mock.calls[0][2].tags;
    expect(tags).toEqual([PAGE_DATA_TAG, cacheTag(longPath)]);
    expect(tags.every((t: string) => t.length <= 256)).toBe(true);

    const res = await POST(
      new Request("http://web/web_revalidate", {
        method: "POST",
        headers: { "x-page-data-key": "k", "content-type": "application/json" },
        body: JSON.stringify({ paths: [longPath] }),
      }),
    );
    expect(res.status).toBe(200);
    expect(nextCache.revalidateTag).toHaveBeenCalledWith(cacheTag(longPath));
  });
});
