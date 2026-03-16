/**
 * Authentication Routes
 * Handles user registration, login, logout, and session management
 */
import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { db } from "../db";
import { users, auditLogs, passwordResetTokens, UserRole } from "../../shared/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { isAuthenticated, requireRole, hasPermission } from "../auth";
import { authRateLimiter } from "../utils/rate-limiting";
import { addCustomerProfile } from "../services/klaviyo-api";
import { logger } from "../utils/logger";

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
    source: z.string().optional(),
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

const updateUserSchema = z.object({
  role: z.enum(["admin", "editor", "customer", "visitor"]).optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// Helper function to create audit log - fails silently to never block authentication
// Retries once on transient failures for better reliability
function createAuditLog(
  userId: string | null,
  action: string,
  entityType: string | null = null,
  entityId: string | null = null,
  ipAddress: string | null = null,
  userAgent: string | null = null,
  sessionId: string | null = null,
  changes: Record<string, unknown> | null = null,
): void {
  const values = {
    userId,
    action,
    entityType,
    entityId,
    ipAddress,
    userAgent,
    sessionId,
    changes: changes ? JSON.stringify(changes) : null,
  };

  // Fire and forget — void prevents unhandled promise rejection
  void db.insert(auditLogs)
    .values(values)
    .catch((err: unknown) => {
      logger.warn("Audit log failed", "AuthRoutes", { error: err instanceof Error ? err.message : String(err) });
    });
}

// POST /api/auth/register - User registration
router.post("/register", authRateLimiter, async (req: Request, res: Response) => {
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
      validatedData.source ? { source: validatedData.source } : null,
    );

    // Add customer profile to Klaviyo (fire and forget — never blocks registration)
    void addCustomerProfile(validatedData.email, {
      username: validatedData.username,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      source: validatedData.source || "website_registration",
    }).catch((err) => {
      console.warn("[Registration] Klaviyo profile creation failed:", err?.message);
    });

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

    logger.error("Registration error", error, "AuthRoutes");
    res.status(500).json({
      error: "Failed to register user",
    });
  }
});

// POST /api/auth/login - User login
router.post("/login", authRateLimiter, async (req: Request, res: Response) => {
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

    logger.error("Login error", error, "AuthRoutes");
    res.status(500).json({
      error: "Failed to login",
    });
  }
});

// POST /api/auth/logout - User logout (no auth middleware to ensure logout always works)
router.post("/logout", async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;

    // Create audit log (fire and forget)
    if (userId) {
      createAuditLog(
        userId,
        "user_logout",
        "user",
        userId,
        req.ip,
        req.headers["user-agent"] as string,
        req.sessionID,
      );
    }

    // Always clear the cookie first
    res.clearCookie("hydrogen.sid", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    // Destroy session if it exists
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          logger.error("Session destruction error", err, "AuthRoutes");
        }
        // Always return success - we cleared the cookie
        res.json({ message: "Logout successful" });
      });
    } else {
      // No session to destroy
      res.json({ message: "Logout successful" });
    }
  } catch (error) {
    logger.error("Logout error", error, "AuthRoutes");
    // Still clear cookie and return success
    res.clearCookie("hydrogen.sid", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    res.json({ message: "Logout successful" });
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
    logger.error("Get user error", error, "AuthRoutes");
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

      logger.error("Change password error", error, "AuthRoutes");
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
      logger.error("Get users error", error, "AuthRoutes");
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
      const validated = updateUserSchema.parse(req.body);

      // Prevent admin from modifying themselves
      if (
        targetUserId === req.session.userId &&
        (validated.role !== UserRole.ADMIN || validated.isActive === false)
      ) {
        return res.status(400).json({
          error: "Cannot remove admin privileges from yourself",
        });
      }

      // Build typed update object from validated fields
      const updateData: Partial<{ role: string; permissions: string[]; isActive: boolean }> = {};
      if (validated.role !== undefined) updateData.role = validated.role;
      if (validated.permissions !== undefined) updateData.permissions = validated.permissions;
      if (validated.isActive !== undefined) updateData.isActive = validated.isActive;

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
      logger.error("Update user error", error, "AuthRoutes");
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

      let logs;
      if (userId) {
        logs = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.userId, userId))
          .orderBy(auditLogs.createdAt)
          .limit(limit);
      } else {
        logs = await db
          .select()
          .from(auditLogs)
          .orderBy(auditLogs.createdAt)
          .limit(limit);
      }

      res.json({ logs });
    } catch (error) {
      logger.error("Get audit logs error", error, "AuthRoutes");
      res.status(500).json({
        error: "Failed to get audit logs",
      });
    }
  },
);

// POST /api/auth/users - Create user (admin only)
const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "editor", "customer", "visitor"]).default("customer"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

router.post(
  "/users",
  isAuthenticated,
  requireRole([UserRole.ADMIN]),
  async (req: Request, res: Response) => {
    try {
      const validatedData = createUserSchema.parse(req.body);

      // Check duplicates
      const existingUsername = await db
        .select()
        .from(users)
        .where(eq(users.username, validatedData.username))
        .limit(1);

      if (existingUsername.length > 0) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const existingEmail = await db
        .select()
        .from(users)
        .where(eq(users.email, validatedData.email))
        .limit(1);

      if (existingEmail.length > 0) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const passwordHash = await bcrypt.hash(validatedData.password, 10);
      const userId = uuidv4();

      const [newUser] = await db
        .insert(users)
        .values({
          id: userId,
          username: validatedData.username,
          email: validatedData.email,
          passwordHash,
          role: validatedData.role,
          permissions: [],
          isActive: true,
        })
        .returning();

      createAuditLog(
        req.session.userId || null,
        "admin_created_user",
        "user",
        newUser.id,
        req.ip,
        req.headers["user-agent"] as string,
        req.sessionID,
        { role: validatedData.role },
      );

      const { passwordHash: _, ...userWithoutPassword } = newUser;
      res.status(201).json({
        message: "User created successfully",
        user: userWithoutPassword,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Validation error",
          details: error.errors,
        });
      }
      logger.error("Create user error", error, "AuthRoutes");
      res.status(500).json({ error: "Failed to create user" });
    }
  },
);

// POST /api/auth/forgot-password - Request password reset
router.post(
  "/forgot-password",
  authRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);

      // Always return success to prevent email enumeration
      const successMsg = "If an account with that email exists, a password reset link has been sent.";

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return res.json({ message: successMsg });
      }

      // Generate reset token
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
      });

      // Log the reset request (don't expose token in log)
      createAuditLog(
        user.id,
        "password_reset_requested",
        "user",
        user.id,
        req.ip,
        req.headers["user-agent"] as string,
        null,
      );

      // In production, send email via SendGrid
      if (process.env.SENDGRID_API_KEY) {
        try {
          const sgMail = await import("@sendgrid/mail");
          sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);
          const resetUrl = `${process.env.APP_URL || req.protocol + "://" + req.get("host")}/reset-password?token=${token}`;
          await sgMail.default.send({
            to: email,
            from: process.env.FROM_EMAIL || "noreply@hydrogenstudies.com",
            subject: "Password Reset - Hydrogen Studies",
            html: `
              <h2>Password Reset Request</h2>
              <p>You requested a password reset. Click the link below to reset your password:</p>
              <p><a href="${resetUrl}">Reset Password</a></p>
              <p>This link expires in 1 hour.</p>
              <p>If you did not request this, please ignore this email.</p>
            `,
          });
        } catch (emailErr) {
          logger.error("Failed to send reset email", emailErr, "AuthRoutes");
        }
      } else {
        logger.warn("SENDGRID_API_KEY not configured — password reset email not sent", "AuthRoutes");
      }

      res.json({ message: successMsg });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Valid email required" });
      }
      logger.error("Forgot password error", error, "AuthRoutes");
      res.status(500).json({ error: "Failed to process request" });
    }
  },
);

// POST /api/auth/reset-password - Reset password with token
router.post(
  "/reset-password",
  authRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = z
        .object({
          token: z.string().min(1),
          newPassword: z.string().min(6),
        })
        .parse(req.body);

      // Hash password before transaction to avoid holding DB lock during bcrypt
      const passwordHash = await bcrypt.hash(newPassword, 10);

      // Use transaction with row-level locking to atomically validate token + update password
      // FOR UPDATE prevents race condition where concurrent requests reuse the same token
      let resetToken: typeof passwordResetTokens.$inferSelect | undefined;
      await db.transaction(async (tx) => {
        const rows = await tx.execute(
          sql`SELECT * FROM password_reset_tokens
              WHERE token = ${token} AND expires_at > NOW()
              LIMIT 1
              FOR UPDATE SKIP LOCKED`
        );
        resetToken = (rows.rows?.[0] || (rows as any)[0]) as typeof resetToken;

        if (!resetToken || resetToken.usedAt) {
          throw new Error("INVALID_TOKEN");
        }

        // Mark token as used first (prevents concurrent use)
        await tx
          .update(passwordResetTokens)
          .set({ usedAt: new Date() })
          .where(eq(passwordResetTokens.id, resetToken.id));

        // Update password atomically
        await tx
          .update(users)
          .set({ passwordHash })
          .where(eq(users.id, resetToken.userId));
      });

      createAuditLog(
        resetToken!.userId,
        "password_reset_completed",
        "user",
        resetToken!.userId,
        req.ip,
        req.headers["user-agent"] as string,
        null,
      );

      res.json({ message: "Password reset successfully. Please log in." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      if (error instanceof Error && error.message === "INVALID_TOKEN") {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }
      logger.error("Reset password error", error, "AuthRoutes");
      res.status(500).json({ error: "Failed to reset password" });
    }
  },
);

export default router;
