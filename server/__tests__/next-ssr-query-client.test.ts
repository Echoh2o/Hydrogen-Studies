import { describe, it, expect } from "vitest";
import { makeQueryClient, queryClient } from "../../client/src/lib/queryClient";

// web/components/ClientProviders.tsx renders with a fresh client per server
// render; a shared singleton served the first-cached response forever.
describe("makeQueryClient", () => {
  it("returns independent clients with the app defaults", () => {
    const a = makeQueryClient();
    const b = makeQueryClient();
    expect(a).not.toBe(b);
    expect(a).not.toBe(queryClient);
    a.setQueryData(["/api/public-stats"], { latestStudyUpdate: "2026-11-01" });
    expect(b.getQueryData(["/api/public-stats"])).toBeUndefined();
    expect(a.getDefaultOptions().queries?.staleTime).toBe(queryClient.getDefaultOptions().queries?.staleTime);
    expect(typeof a.getDefaultOptions().queries?.queryFn).toBe("function");
  });
});
