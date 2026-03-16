import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";

// Mock the database before importing auth module
vi.mock("../db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

// Must import after mocks are set up
const { hashPassword, comparePasswords, isAuthenticated } = await import(
  "../auth"
);

describe("hashPassword", () => {
  it("returns a bcrypt hash", async () => {
    const hash = await hashPassword("testpassword");
    expect(hash).toBeDefined();
    expect(hash).not.toBe("testpassword");
    expect(hash.startsWith("$2b$")).toBe(true);
  });

  it("produces different hashes for same input (salt)", async () => {
    const hash1 = await hashPassword("same");
    const hash2 = await hashPassword("same");
    expect(hash1).not.toBe(hash2);
  });
});

describe("comparePasswords", () => {
  it("returns true for matching password", async () => {
    const hash = await hashPassword("mypassword");
    const result = await comparePasswords("mypassword", hash);
    expect(result).toBe(true);
  });

  it("returns false for wrong password", async () => {
    const hash = await hashPassword("mypassword");
    const result = await comparePasswords("wrongpassword", hash);
    expect(result).toBe(false);
  });
});

describe("isAuthenticated middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = { session: {} as any };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  it("calls next() when session has userId", () => {
    mockReq.session = { userId: "user-123" } as any;
    isAuthenticated(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it("returns 401 when no userId in session", () => {
    mockReq.session = {} as any;
    isAuthenticated(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("returns 401 when no session at all", () => {
    mockReq.session = undefined as any;
    isAuthenticated(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });
});
