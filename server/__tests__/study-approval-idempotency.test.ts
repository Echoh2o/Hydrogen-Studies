import { describe, it, expect, vi, beforeEach } from "vitest";

// Configurable result for the atomic claim UPDATE ... RETURNING.
let claimResult: any[] = [];
const setSpy = vi.fn();

vi.mock("../db", () => ({
  db: {
    update: () => ({
      set: (vals: any) => {
        setSpy(vals);
        return {
          where: () => ({
            returning: () => Promise.resolve(claimResult),
          }),
        };
      },
    }),
  },
}));

// ai-provider is imported transitively; stub it so no SDK/key setup is needed.
vi.mock("../services/ai-provider", () => ({
  ai: { generateText: vi.fn(), generateJSON: vi.fn(), getProviderStatus: () => ({ primary: "none" }) },
  MODELS: {},
}));

const { createStudyFromPipelineItem } = await import("../services/study-analysis-pipeline");

describe("createStudyFromPipelineItem idempotency guard", () => {
  beforeEach(() => {
    claimResult = [];
    setSpy.mockClear();
  });

  it("throws (and creates no study) when the item cannot be claimed — already approved, rejected, or missing", async () => {
    claimResult = []; // claim UPDATE matched no awaiting_approval row
    await expect(createStudyFromPipelineItem(123)).rejects.toThrow(
      /not awaiting approval/i,
    );
  });

  it("attempts the claim by transitioning status to 'approving'", async () => {
    claimResult = [];
    await createStudyFromPipelineItem(123).catch(() => {});
    // The first .set() call is the atomic claim.
    expect(setSpy).toHaveBeenCalled();
    expect(setSpy.mock.calls[0][0]).toMatchObject({ status: "approving" });
  });
});
