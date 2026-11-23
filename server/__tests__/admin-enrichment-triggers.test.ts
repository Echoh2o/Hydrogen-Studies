/**
 * /api/admin/trigger/* background loops call the enrichment service directly
 * (they used to POST to localhost without a session, so every call 401'd while
 * the job reported started: true). Mocked-db unit test.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db", () => ({ db: {}, pool: { query: vi.fn() } }));
vi.mock("../auth", () => ({ requireAdmin: (_q: any, _s: any, n: any) => n() }));
vi.mock("../services/job-scheduler", () => ({ jobScheduler: {} }));
vi.mock("../services/ai-provider", () => ({ ai: {} }));
const enhanceStudyContent = vi.hoisted(() => vi.fn());
vi.mock("../services/content-enrichment", () => ({ enhanceStudyContent }));

const { runEnrichmentTrigger, processStatus } = await import("../routes/admin-monitoring-routes");

describe("runEnrichmentTrigger", () => {
  beforeEach(() => {
    enhanceStudyContent.mockReset();
    processStatus.researchEnrichment.isRunning = true;
    processStatus.researchEnrichment.studiesProcessed = 0;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("calls the service in-process for each id, sequentially, counting only successes", async () => {
    const order: number[] = [];
    enhanceStudyContent.mockImplementation(async (id: number) => {
      order.push(id);
      return { success: id !== 2, message: "" };
    });
    const n = await runEnrichmentTrigger("researchEnrichment", [1, 2, 3]);
    expect(order).toEqual([1, 2, 3]);
    expect(n).toBe(2);
    expect(processStatus.researchEnrichment.studiesProcessed).toBe(2);
    expect(processStatus.researchEnrichment.isRunning).toBe(false);
  });

  it("a throwing study is logged and skipped; isRunning is still cleared", async () => {
    enhanceStudyContent
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ success: true });
    const n = await runEnrichmentTrigger("researchEnrichment", [1, 2]);
    expect(n).toBe(1);
    expect(processStatus.researchEnrichment.isRunning).toBe(false);
  });
});
