/**
 * Authentication Routes
 * Handles user registration, login, logout, and session management
 */
import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { db } from "../db";
import { users, auditLogs, UserRole } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { isAuthenticated, requireRole, hasPermission } from "../auth";

const router = Router();

// Validation schemas
const registerSchema = z
  .object({
    username: z.string().min(3).max(50),
    email: z.string().email(),
    password: z.string().min(6),
    confirmPassword: z.string(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const loginSchema = z.object({
  usernameOrEmail: z.string(),
  password: z.string(),
  rememberMe: z.boolean().optional(),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string(),
    newPassword: z.string().min(6),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// Helper function to create audit log
async function createAuditLog(
  userId: string | null,
  action: string,
  entityType: string | null = null,
  entityId: string | null = null,
  ipAddress: string | null = null,
  userAgent: string | null = null,
  sessionId: string | null = null,
  changes: any = null,
) {
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      entityType,
      entityId,
      ipAddress,
      userAgent,
      sessionId,
      changes: changes ? JSON.stringify(changes) : null,
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

// POST /api/auth/register - User registration
router.post("/register", async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = registerSchema.parse(req.body);

    // Check if username already exists
    const existingUsername = await db
      .select()
      .from(users)
      .where(eq(users.username, validatedData.username))
      .limit(1);

    if (existingUsername.length > 0) {
      return res.status(400).json({
        error: "Username already exists",
      });
    }

    // Check if email already exists
    const existingEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, validatedData.email))
      .limit(1);

    if (existingEmail.length > 0) {
      return res.status(400).json({
        error: "Email already registered",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validatedData.password, 10);

    // Generate unique user ID
    const userId = uuidv4();

    // Determine role (first user becomes admin if no admins exist)
    const adminCount = await db
      .select()
      .from(users)
      .where(eq(users.role, UserRole.ADMIN))
      .limit(1);

    const role = adminCount.length === 0 ? UserRole.ADMIN : UserRole.CUSTOMER;

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        id: userId,
        username: validatedData.username,
        email: validatedData.email,
        password: passwordHash, // Set password column to hashed password
        passwordHash,
        role,
        permissions: [],
        isActive: true,
      })
      .returning();

    // Create session
    req.session.userId = newUser.id;
    req.session.userRole = newUser.role as string;
    req.session.username = newUser.username;

    // Create audit log
    await createAuditLog(
      newUser.id,
      "user_registration",
      "user",
      newUser.id,
      req.ip,
      req.headers["user-agent"] as string,
      req.sessionID,
    );

    // Return user data (without password)
    const { passwordHash: _, ...userWithoutPassword } = newUser;
    res.json({
      message: "Registration successful",
      user: userWithoutPassword,
      isFirstAdmin: role === UserRole.ADMIN,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }

    console.error("Registration error:", error);
    res.status(500).json({
      error: "Failed to register user",
    });
  }
});

// POST /api/auth/login - User login
router.post("/login", async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = loginSchema.parse(req.body);

    // Find user by username or email
    const [user] = await db
      .select()
      .from(users)
      .where(
        validatedData.usernameOrEmail.includes("@")
          ? eq(users.email, validatedData.usernameOrEmail)
          : eq(users.username, validatedData.usernameOrEmail),
      )
      .limit(1);

    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        error: "Account is deactivated",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      validatedData.password,
      user.passwordHash || "",
    );

    if (!isPasswordValid) {
      await createAuditLog(
        user.id,
        "failed_login",
        "user",
        user.id,
        req.ip,
        req.headers["user-agent"] as string,
        null,
      );

      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    // Update last login timestamp
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    // Create session
    req.session.userId = user.id;
    req.session.userRole = user.role as string;
    req.session.username = user.username;

    // Set session expiry based on remember me
    if (validatedData.rememberMe) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    } else {
      req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours
    }

    // Create audit log
    await createAuditLog(
      user.id,
      "user_login",
      "user",
      user.id,
      req.ip,
      req.headers["user-agent"] as string,
      req.sessionID,
    );

    // Return user data (without password)
    const { passwordHash: _, ...userWithoutPassword } = user;
    res.json({
      message: "Login successful",
      user: userWithoutPassword,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }

    console.error("Login error:", error);
    res.status(500).json({
      error: "Failed to login",
    });
  }
});

// POST /api/auth/logout - User logout
router.post("/logout", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;

    // Create audit log before destroying session
    await createAuditLog(
      userId || null,
      "user_logout",
      "user",
      userId || null,
      req.ip,
      req.headers["user-agent"] as string,
      req.sessionID,
    );

    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destruction error:", err);
        return res.status(500).json({
          error: "Failed to logout",
        });
      }

      // Clear session cookie
      res.clearCookie("connect.sid");
      res.json({
        message: "Logout successful",
      });
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      error: "Failed to logout",
    });
  }
});

// GET /api/auth/me - Get current user info
router.get("/me", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({
        error: "Not authenticated",
      });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    // Return user data (without password)
    const { passwordHash: _, ...userWithoutPassword } = user;
    res.json({
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      error: "Failed to get user information",
    });
  }
});

// POST /api/auth/change-password - Change password
router.post(
  "/change-password",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;

      if (!userId) {
        return res.status(401).json({
          error: "Not authenticated",
        });
      }

      // Validate input
      const validatedData = changePasswordSchema.parse(req.body);

      // Get current user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(
        validatedData.currentPassword,
        user.passwordHash || "",
      );

      if (!isPasswordValid) {
        return res.status(401).json({
          error: "Current password is incorrect",
        });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(validatedData.newPassword, 10);

      // Update password
      await db
        .update(users)
        .set({ passwordHash: newPasswordHash })
        .where(eq(users.id, userId));

      // Create audit log
      await createAuditLog(
        userId,
        "password_changed",
        "user",
        userId,
        req.ip,
        req.headers["user-agent"] as string,
        req.sessionID,
      );

      res.json({
        message: "Password changed successfully",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Validation error",
          details: error.errors,
        });
      }

      console.error("Change password error:", error);
      res.status(500).json({
        error: "Failed to change password",
      });
    }
  },
);

// GET /api/auth/check-session - Check session validity
router.get("/check-session", (req: Request, res: Response) => {
  if (req.session && req.session.userId) {
    res.json({
      authenticated: true,
      userId: req.session.userId,
      userRole: req.session.userRole,
      username: req.session.username,
      sessionExpiry: req.session.cookie.expires,
    });
  } else {
    res.json({
      authenticated: false,
    });
  }
});

// GET /api/auth/users - Get all users (admin only)
router.get(
  "/users",
  isAuthenticated,
  requireRole([UserRole.ADMIN]),
  async (req: Request, res: Response) => {
    try {
      const allUsers = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          role: users.role,
          permissions: users.permissions,
          isActive: users.isActive,
          lastLogin: users.lastLogin,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(users.createdAt);

      res.json({ users: allUsers });
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({
        error: "Failed to get users",
      });
    }
  },
);

// PATCH /api/auth/users/:id - Update user (admin only)
router.patch(
  "/users/:id",
  isAuthenticated,
  requireRole([UserRole.ADMIN]),
  async (req: Request, res: Response) => {
    try {
      const targetUserId = req.params.id;
      const { role, permissions, isActive } = req.body;

      // Prevent admin from modifying themselves
      if (
        targetUserId === req.session.userId &&
        (role !== UserRole.ADMIN || isActive === false)
      ) {
        return res.status(400).json({
          error: "Cannot remove admin privileges from yourself",
        });
      }

      // Update user
      const updateData: any = {};
      if (role !== undefined) updateData.role = role;
      if (permissions !== undefined) updateData.permissions = permissions;
      if (isActive !== undefined) updateData.isActive = isActive;

      await db.update(users).set(updateData).where(eq(users.id, targetUserId));

      // Create audit log
      await createAuditLog(
        req.session.userId || null,
        "user_updated",
        "user",
        targetUserId,
        req.ip,
        req.headers["user-agent"] as string,
        req.sessionID,
        updateData,
      );

      res.json({
        message: "User updated successfully",
      });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({
        error: "Failed to update user",
      });
    }
  },
);

// GET /api/auth/audit-logs - Get audit logs (admin only)
router.get(
  "/audit-logs",
  isAuthenticated,
  requireRole([UserRole.ADMIN]),
  async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const limit = parseInt(req.query.limit as string) || 100;

      let query = db
        .select()
        .from(auditLogs)
        .orderBy(auditLogs.createdAt)
        .limit(limit);

      if (userId) {
        query = query.where(eq(auditLogs.userId, userId));
      }

      const logs = await query;

      res.json({ logs });
    } catch (error) {
      console.error("Get audit logs error:", error);
      res.status(500).json({
        error: "Failed to get audit logs",
      });
    }
  },
);

export default router;
