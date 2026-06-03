/**
 * Characterization tests for the content-queue drain's cooperative-cancellation
 * guard (added with the timeout-orphan fix). When the scheduler's withTimeout()
 * fires, it aborts an AbortSignal; processContentQueue() must stop claiming new
 * items at the next loop boundary instead of running on as an orphan.
 *
 * These are pure control-flow tests over a mocked db — they verify the abort
 * GUARD, not Postgres race-safety (the atomic claim UPDATE + partial unique
 * index). That semantic correctness needs an integration test against a real
 * Postgres connection, which this project does not yet have a harness for.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Default claim UPDATE returns [] = "lost the race", so the waterfall (which
// would pull in real AI/image services) never runs. The select chain returns
// two pending items so the loop has something to iterate.
const claimUpdate = vi.fn(() => ({
  set: () => ({ where: () => ({ returning: async () => [] as { id: number }[] }) }),
}));

vi.mock("../db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => [
              { id: 1, studyId: 101, completedSteps: [], status: "pending" },
              { id: 2, studyId: 102, completedSteps: [], status: "pending" },
            ],
          }),
        }),
      }),
    }),
    update: claimUpdate,
  },
}));

const { processContentQueue } = await import("../services/content-generation-worker");

describe("processContentQueue — abort guard", () => {
  beforeEach(() => {
    claimUpdate.mockClear();
  });

  it("claims no items when the signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort();

    const result = await processContentQueue(10, ac.signal);

    expect(result).toEqual({ processed: 0, failed: 0 });
    // The guard runs at the top of the loop, before the atomic claim UPDATE.
    // If it regressed, the orphaned drain would claim items and could write
    // 'completed' after the scheduler already gave up on it.
    expect(claimUpdate).not.toHaveBeenCalled();
  });

  it("attempts to claim items when no signal is passed (guard is opt-in)", async () => {
    const result = await processContentQueue(10);

    // Both items "lose the race" (claim returns []), so nothing is processed and
    // the waterfall never runs — but the claim path WAS exercised, proving it
    // was the abort guard (not some other early return) that gated claiming above.
    expect(result).toEqual({ processed: 0, failed: 0 });
    expect(claimUpdate).toHaveBeenCalled();
  });

  it("stops mid-drain: an abort after the first item prevents claiming the second", async () => {
    const ac = new AbortController();
    // Abort as soon as the first claim attempt happens, simulating the timeout
    // firing partway through the drain.
    claimUpdate.mockImplementationOnce(() => {
      ac.abort();
      return { set: () => ({ where: () => ({ returning: async () => [] as { id: number }[] }) }) };
    });

    await processContentQueue(10, ac.signal);

    // First item: claim attempted (then lost the race + abort fired).
    // Second item: loop-top guard sees aborted → break, no second claim.
    expect(claimUpdate).toHaveBeenCalledTimes(1);
  });
});
