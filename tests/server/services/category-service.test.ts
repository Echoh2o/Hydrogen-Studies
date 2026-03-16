import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database before importing the service
vi.mock("../../../server/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock("@shared/schema", () => ({
  categories: {
    id: "id",
    name: "name",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, value) => ({ field, value })),
}));

import { CategoryService } from "../../../server/services/category-service";
import { db } from "../../../server/db";

describe("CategoryService", () => {
  let service: CategoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CategoryService();
  });

  describe("getCategories", () => {
    it("should fetch categories from database", async () => {
      const mockCategories = [
        { id: 1, name: "Oxidative Stress" },
        { id: 2, name: "Inflammation" },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockCategories),
      } as any);

      const result = await service.getCategories();
      expect(result).toEqual(mockCategories);
    });

    it("should use cache on subsequent calls within TTL", async () => {
      const mockCategories = [{ id: 1, name: "Test" }];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockCategories),
      } as any);

      // First call - hits database
      await service.getCategories();
      // Second call - should use cache
      const result = await service.getCategories();

      expect(result).toEqual(mockCategories);
      // db.select should have been called only once
      expect(db.select).toHaveBeenCalledTimes(1);
    });
  });

  describe("getCategoryByName", () => {
    it("should return cached category if available", async () => {
      // Pre-populate cache through getCategories
      const mockCategories = [{ id: 1, name: "TestCategory" }];
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockCategories),
      } as any);

      await service.getCategories();
      vi.clearAllMocks();

      const result = await service.getCategoryByName("TestCategory");
      expect(result).toEqual({ id: 1, name: "TestCategory" });
      // Should not hit DB since it's cached
      expect(db.select).not.toHaveBeenCalled();
    });
  });
});
