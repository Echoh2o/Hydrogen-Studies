import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock React to avoid JSX parsing issues
vi.mock("react", () => ({
  useState: vi.fn((init: any) => [init, vi.fn()]),
  useEffect: vi.fn(),
  default: { useState: vi.fn(), useEffect: vi.fn() },
}));

// Mock the toast component types
vi.mock("@/components/ui/toast", () => ({}));

import { reducer } from "../../../client/src/hooks/use-toast";

describe("toast reducer", () => {
  const makeToast = (id: string, overrides = {}) => ({
    id,
    open: true,
    onOpenChange: vi.fn(),
    ...overrides,
  });

  describe("ADD_TOAST", () => {
    it("should add a toast to empty state", () => {
      const state = { toasts: [] };
      const toast = makeToast("1");
      const result = reducer(state, { type: "ADD_TOAST", toast: toast as any });
      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0].id).toBe("1");
    });

    it("should add toast at the beginning", () => {
      const state = { toasts: [makeToast("1") as any] };
      const toast = makeToast("2");
      const result = reducer(state, { type: "ADD_TOAST", toast: toast as any });
      expect(result.toasts[0].id).toBe("2");
    });

    it("should limit to TOAST_LIMIT (1 toast)", () => {
      const state = { toasts: [makeToast("1") as any] };
      const toast = makeToast("2");
      const result = reducer(state, { type: "ADD_TOAST", toast: toast as any });
      // TOAST_LIMIT is 1, so only the newest toast should remain
      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0].id).toBe("2");
    });
  });

  describe("UPDATE_TOAST", () => {
    it("should update an existing toast", () => {
      const state = { toasts: [makeToast("1", { title: "Original" }) as any] };
      const result = reducer(state, {
        type: "UPDATE_TOAST",
        toast: { id: "1", title: "Updated" } as any,
      });
      expect(result.toasts[0].title).toBe("Updated");
    });

    it("should not affect other toasts", () => {
      const state = {
        toasts: [makeToast("1", { title: "First" }) as any],
      };
      const result = reducer(state, {
        type: "UPDATE_TOAST",
        toast: { id: "nonexistent", title: "Updated" } as any,
      });
      expect(result.toasts[0].title).toBe("First");
    });
  });

  describe("DISMISS_TOAST", () => {
    it("should set open to false for specific toast", () => {
      const state = { toasts: [makeToast("1") as any] };
      const result = reducer(state, { type: "DISMISS_TOAST", toastId: "1" });
      expect(result.toasts[0].open).toBe(false);
    });

    it("should dismiss all toasts when no toastId", () => {
      const state = {
        toasts: [makeToast("1") as any, makeToast("2") as any],
      };
      const result = reducer(state, { type: "DISMISS_TOAST" });
      result.toasts.forEach((t: any) => expect(t.open).toBe(false));
    });
  });

  describe("REMOVE_TOAST", () => {
    it("should remove a specific toast", () => {
      const state = { toasts: [makeToast("1") as any, makeToast("2") as any] };
      const result = reducer(state, { type: "REMOVE_TOAST", toastId: "1" });
      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0].id).toBe("2");
    });

    it("should remove all toasts when no toastId", () => {
      const state = { toasts: [makeToast("1") as any, makeToast("2") as any] };
      const result = reducer(state, { type: "REMOVE_TOAST" });
      expect(result.toasts).toHaveLength(0);
    });

    it("should not crash when removing from empty state", () => {
      const state = { toasts: [] };
      const result = reducer(state, { type: "REMOVE_TOAST", toastId: "1" });
      expect(result.toasts).toHaveLength(0);
    });
  });
});
