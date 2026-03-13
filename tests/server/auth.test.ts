import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock bcrypt
vi.mock("bcrypt", () => ({
  hash: vi.fn().mockResolvedValue("$2b$10$hashedpassword"),
  compare: vi.fn().mockResolvedValue(true),
}));

// Mock DB
const mockDbSelect = vi.hoisted(() => vi.fn());
vi.mock("../../server/db", () => ({
  db: {
    select: () => mockDbSelect(),
  },
}));

vi.mock("@shared/schema", () => ({
  users: { id: "id", role: "role", isActive: "isActive", permissions: "permissions" },
  UserRole: { ADMIN: "admin", EDITOR: "editor", CUSTOMER: "customer", VISITOR: "visitor" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

import { hash, compare } from "bcrypt";
import {
  hashPassword,
  comparePasswords,
  isAuthenticated,
  requireRole,
  hasPermission,
  getCurrentUser,
  userHasRole,
  userHasPermission,
} from "../../server/auth";

function mockReq(session: any = {}): any {
  return { session };
}

function mockRes(): any {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

describe("hashPassword", () => {
  it("should hash a password using bcrypt", async () => {
    const result = await hashPassword("mypassword");
    expect(hash).toHaveBeenCalledWith("mypassword", 10);
    expect(result).toBe("$2b$10$hashedpassword");
  });
});

describe("comparePasswords", () => {
  it("should compare password with hash", async () => {
    const result = await comparePasswords("mypassword", "$2b$10$hashedpassword");
    expect(compare).toHaveBeenCalledWith("mypassword", "$2b$10$hashedpassword");
    expect(result).toBe(true);
  });

  it("should return false for non-matching password", async () => {
    vi.mocked(compare).mockResolvedValueOnce(false as any);
    const result = await comparePasswords("wrong", "$2b$10$hashedpassword");
    expect(result).toBe(false);
  });
});

describe("isAuthenticated", () => {
  it("should call next when session has userId", () => {
    const req = mockReq({ userId: "user-1" });
    const res = mockRes();
    const next = vi.fn();
    isAuthenticated(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("should return 401 when no session", () => {
    const req = mockReq(null);
    const res = mockRes();
    const next = vi.fn();
    isAuthenticated(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 when no userId in session", () => {
    const req = mockReq({});
    const res = mockRes();
    const next = vi.fn();
    isAuthenticated(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe("requireRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should return 401 when no session", async () => {
    const middleware = requireRole(["admin"]);
    const req = mockReq(null);
    const res = mockRes();
    const next = vi.fn();
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("should return 401 when user not found", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const middleware = requireRole(["admin"]);
    const req = mockReq({ userId: "user-1" });
    const res = mockRes();
    const next = vi.fn();
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("should return 403 when user is deactivated", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "user-1", isActive: false, role: "admin" }]),
        }),
      }),
    });

    const middleware = requireRole(["admin"]);
    const req = mockReq({ userId: "user-1" });
    const res = mockRes();
    const next = vi.fn();
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Account is deactivated" }));
  });

  it("should call next when user has required role", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "user-1", isActive: true, role: "admin" }]),
        }),
      }),
    });

    const middleware = requireRole(["admin"]);
    const req = mockReq({ userId: "user-1" });
    const res = mockRes();
    const next = vi.fn();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("should return 403 when user lacks required role", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "user-1", isActive: true, role: "customer" }]),
        }),
      }),
    });

    const middleware = requireRole(["admin", "editor"]);
    const req = mockReq({ userId: "user-1" });
    const res = mockRes();
    const next = vi.fn();
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Forbidden - Insufficient permissions" }),
    );
  });

  it("should return 500 on database error", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error("DB down")),
        }),
      }),
    });

    const middleware = requireRole(["admin"]);
    const req = mockReq({ userId: "user-1" });
    const res = mockRes();
    const next = vi.fn();
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("hasPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should return 401 when no session", async () => {
    const middleware = hasPermission("manage_studies");
    const req = mockReq(null);
    const res = mockRes();
    const next = vi.fn();
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("should allow admins regardless of specific permissions", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: "user-1", isActive: true, role: "admin", permissions: [] },
          ]),
        }),
      }),
    });

    const middleware = hasPermission("any_permission");
    const req = mockReq({ userId: "user-1" });
    const res = mockRes();
    const next = vi.fn();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("should allow user with specific permission", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: "user-1", isActive: true, role: "editor", permissions: ["manage_studies", "view_analytics"] },
          ]),
        }),
      }),
    });

    const middleware = hasPermission("manage_studies");
    const req = mockReq({ userId: "user-1" });
    const res = mockRes();
    const next = vi.fn();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("should deny user without required permission", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: "user-1", isActive: true, role: "editor", permissions: ["view_analytics"] },
          ]),
        }),
      }),
    });

    const middleware = hasPermission("manage_studies");
    const req = mockReq({ userId: "user-1" });
    const res = mockRes();
    const next = vi.fn();
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("getCurrentUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should return null when no session", async () => {
    const result = await getCurrentUser(mockReq(null));
    expect(result).toBeNull();
  });

  it("should return null when no userId", async () => {
    const result = await getCurrentUser(mockReq({}));
    expect(result).toBeNull();
  });

  it("should return user from database", async () => {
    const user = { id: "user-1", role: "admin" };
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([user]),
        }),
      }),
    });

    const result = await getCurrentUser(mockReq({ userId: "user-1" }));
    expect(result).toEqual(user);
  });

  it("should return null on database error", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error("DB error")),
        }),
      }),
    });

    const result = await getCurrentUser(mockReq({ userId: "user-1" }));
    expect(result).toBeNull();
  });
});

describe("userHasRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should return true when user has role", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "user-1", role: "admin" }]),
        }),
      }),
    });

    expect(await userHasRole("user-1", "admin")).toBe(true);
  });

  it("should return false when user has different role", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "user-1", role: "customer" }]),
        }),
      }),
    });

    expect(await userHasRole("user-1", "admin")).toBe(false);
  });

  it("should return false when user not found", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    expect(await userHasRole("nonexistent", "admin")).toBe(false);
  });
});

describe("userHasPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should return true for admin users (all permissions)", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "user-1", role: "admin", permissions: [] }]),
        }),
      }),
    });

    expect(await userHasPermission("user-1", "anything")).toBe(true);
  });

  it("should return true when user has specific permission", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: "user-1", role: "editor", permissions: ["manage_studies"] },
          ]),
        }),
      }),
    });

    expect(await userHasPermission("user-1", "manage_studies")).toBe(true);
  });

  it("should return false when user lacks permission", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: "user-1", role: "editor", permissions: ["view_only"] },
          ]),
        }),
      }),
    });

    expect(await userHasPermission("user-1", "manage_studies")).toBe(false);
  });

  it("should return false on database error", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error("DB error")),
        }),
      }),
    });

    expect(await userHasPermission("user-1", "manage_studies")).toBe(false);
  });
});
