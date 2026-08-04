/**
 * Authentication and authorization middleware utilities
 * Supports role-based access control and permissions
 */
import { compare, hash } from "bcrypt";
import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { users, UserRole } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "./utils/logger";

// Extend Express Request type to include session properties
declare module "express-session" {
  interface SessionData {
    userId: string;
    username: string | null;
    userRole: string;
    userIsActive: boolean;
    roleCachedAt: number;
  }
}

// Number of salt rounds for password hashing
const SALT_ROUNDS = 10;

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  return await hash(password, SALT_ROUNDS);
}

/**
 * Compare a password with a hash
 */
export async function comparePasswords(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return await compare(password, hashedPassword);
}

/**
 * Middleware to check if user is authenticated
 */
export function isAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized - Please login" });
}

/**
 * Middleware to require specific roles
 * @param roles Array of allowed roles
 */
export function requireRole(roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Check authentication first
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Unauthorized - Please login" });
    }

    // Use cached role from session if available (refreshed every 5 minutes)
    const now = Date.now();
    const cacheAge = now - (req.session.roleCachedAt || 0);
    const ROLE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    if (req.session.userRole && req.session.userIsActive !== undefined && cacheAge < ROLE_CACHE_TTL) {
      if (!req.session.userIsActive) {
        return res.status(403).json({ error: "Account is deactivated" });
      }
      if (roles.includes(req.session.userRole)) {
        return next();
      }
      return res.status(403).json({
        error: "Forbidden - Insufficient permissions",
        requiredRoles: roles,
        userRole: req.session.userRole,
      });
    }

    // Cache miss or expired — fetch from database
    try {
      const [user] = await db
        .select({ role: users.role, isActive: users.isActive })
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Cache role in session
      req.session.userRole = user.role || "";
      req.session.userIsActive = user.isActive ?? true;
      req.session.roleCachedAt = now;

      if (!user.isActive) {
        return res.status(403).json({ error: "Account is deactivated" });
      }

      if (roles.includes(user.role || "")) {
        return next();
      }

      return res.status(403).json({
        error: "Forbidden - Insufficient permissions",
        requiredRoles: roles,
        userRole: user.role,
      });
    } catch (error) {
      logger.error("Role check error", error, "Auth");
      return res.status(500).json({ error: "Failed to verify permissions" });
    }
  };
}

/**
 * Middleware to check specific permission
 * @param permission The required permission
 */
export function hasPermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Check authentication first
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Unauthorized - Please login" });
    }

    // Get user from database to check permissions
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: "Account is deactivated" });
      }

      // Admins have all permissions
      if (user.role === UserRole.ADMIN) {
        return next();
      }

      // Check if user has the specific permission
      if (user.permissions && user.permissions.includes(permission)) {
        return next();
      }

      return res.status(403).json({
        error: "Forbidden - Missing required permission",
        requiredPermission: permission,
      });
    } catch (error) {
      logger.error("Permission check error", error, "Auth");
      return res.status(500).json({ error: "Failed to verify permissions" });
    }
  };
}

/**
 * Middleware to check if user is an admin
 * Updated to use role-based system instead of environment variable
 */
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole([UserRole.ADMIN])(req, res, next);
}

/**
 * Combined middleware: requires both authentication and admin privileges
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole([UserRole.ADMIN])(req, res, next);
}

/**
 * Middleware to check if user is an admin or editor
 */
export function isAdminOrEditor(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  return requireRole([UserRole.ADMIN, UserRole.EDITOR])(req, res, next);
}

/**
 * Non-blocking check for whether the current request is an authenticated
 * admin or editor. Unlike requireRole/requireAdmin (which respond 401/403),
 * this just returns a boolean so a single endpoint can serve both the public
 * and the admin surface — e.g. the blog list, where anonymous callers must
 * only ever see published rows but admins may filter drafts.
 *
 * Anonymous requests short-circuit with no DB hit; only logged-in sessions
 * incur a role lookup (reusing the session role cache when fresh).
 */
export async function isElevatedRequest(req: Request): Promise<boolean> {
  if (!req.session || !req.session.userId) return false;

  const elevated = [UserRole.ADMIN, UserRole.EDITOR] as string[];

  const cacheAge = Date.now() - (req.session.roleCachedAt || 0);
  const ROLE_CACHE_TTL = 5 * 60 * 1000;
  if (
    req.session.userRole &&
    req.session.userIsActive !== undefined &&
    cacheAge < ROLE_CACHE_TTL
  ) {
    return req.session.userIsActive && elevated.includes(req.session.userRole);
  }

  try {
    const [user] = await db
      .select({ role: users.role, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, req.session.userId))
      .limit(1);
    if (!user) return false;
    req.session.userRole = user.role || "";
    req.session.userIsActive = user.isActive ?? true;
    req.session.roleCachedAt = Date.now();
    return (user.isActive ?? true) && elevated.includes(user.role || "");
  } catch (error) {
    // Fail closed: on any lookup error, treat the request as unprivileged.
    logger.error("isElevatedRequest check error", error, "Auth");
    return false;
  }
}

/**
 * Get current user from request
 */
export async function getCurrentUser(req: Request) {
  if (!req.session || !req.session.userId) {
    return null;
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId))
      .limit(1);

    return user || null;
  } catch (error) {
    logger.error("Get current user error", error, "Auth");
    return null;
  }
}

/**
 * Check if a user has a specific role
 */
export async function userHasRole(
  userId: string,
  role: string,
): Promise<boolean> {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user ? user.role === role : false;
  } catch (error) {
    logger.error("User role check error", error, "Auth");
    return false;
  }
}

/**
 * Check if a user has a specific permission
 */
export async function userHasPermission(
  userId: string,
  permission: string,
): Promise<boolean> {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return false;

    // Admins have all permissions
    if (user.role === UserRole.ADMIN) return true;

    // Check specific permissions
    return user.permissions ? user.permissions.includes(permission) : false;
  } catch (error) {
    logger.error("User permission check error", error, "Auth");
    return false;
  }
}

// Export legacy functions for compatibility (these will be deprecated)
export async function registerUser(userData: any) {
  logger.warn("registerUser is deprecated. Use /api/auth/register endpoint instead.", "Auth");
  throw new Error("Method deprecated");
}

export async function authenticateUser(email: string, password: string) {
  logger.warn("authenticateUser is deprecated. Use /api/auth/login endpoint instead.", "Auth");
  throw new Error("Method deprecated");
}
