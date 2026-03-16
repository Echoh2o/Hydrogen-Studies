import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";

// Mock the category service
vi.mock("../../../server/services/category-service", () => ({
  categoryService: {
    getCategories: vi.fn(),
    getCategoryById: vi.fn(),
  },
}));

import { CategoriesController } from "../../../server/controllers/categories-controller";
import { categoryService } from "../../../server/services/category-service";

function mockResponse(): Response {
  const res: any = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  };
  return res;
}

function mockRequest(params = {}, query = {}): Request {
  return { params, query } as any;
}

describe("CategoriesController", () => {
  let controller: CategoriesController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new CategoriesController();
  });

  it("should have a router", () => {
    expect(controller.router).toBeDefined();
  });

  describe("getAllCategories", () => {
    it("should return categories on success", async () => {
      const mockCategories = [
        { id: 1, name: "Oxidative Stress" },
        { id: 2, name: "Inflammation" },
      ];
      vi.mocked(categoryService.getCategories).mockResolvedValue(
        mockCategories as any,
      );

      const req = mockRequest();
      const res = mockResponse();

      // Access the route handler via the router stack
      const getAllHandler = getRouteHandler(controller.router, "GET", "/");
      await getAllHandler(req, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith(mockCategories);
    });

    it("should return 500 on service error", async () => {
      vi.mocked(categoryService.getCategories).mockRejectedValue(
        new Error("DB error"),
      );

      const req = mockRequest();
      const res = mockResponse();

      const getAllHandler = getRouteHandler(controller.router, "GET", "/");
      await getAllHandler(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getCategoryById", () => {
    it("should return category by id", async () => {
      const mockCategory = { id: 1, name: "Oxidative Stress" };
      vi.mocked(categoryService.getCategoryById).mockResolvedValue(
        mockCategory as any,
      );

      const req = mockRequest({ id: "1" });
      const res = mockResponse();

      const getByIdHandler = getRouteHandler(
        controller.router,
        "GET",
        "/:id",
      );
      await getByIdHandler(req, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith(mockCategory);
    });

    it("should return 400 for invalid id", async () => {
      const req = mockRequest({ id: "abc" });
      const res = mockResponse();

      const getByIdHandler = getRouteHandler(
        controller.router,
        "GET",
        "/:id",
      );
      await getByIdHandler(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 when category not found", async () => {
      vi.mocked(categoryService.getCategoryById).mockResolvedValue(undefined);

      const req = mockRequest({ id: "999" });
      const res = mockResponse();

      const getByIdHandler = getRouteHandler(
        controller.router,
        "GET",
        "/:id",
      );
      await getByIdHandler(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});

/**
 * Helper to extract a route handler from an Express Router
 */
function getRouteHandler(router: any, method: string, path: string) {
  const layer = router.stack.find(
    (l: any) =>
      l.route &&
      l.route.path === path &&
      l.route.methods[method.toLowerCase()],
  );
  if (!layer) throw new Error(`Route ${method} ${path} not found`);
  // Return the last handler (skipping middleware)
  const handlers = layer.route.stack.map((s: any) => s.handle);
  return handlers[handlers.length - 1];
}
