/**
 * Authentication and authorization utilities
 */
import { compare, hash } from 'bcrypt';
import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { z } from 'zod';
import { insertUserSchema } from '@shared/schema';

// Registration schema with password confirmation
export const registerSchema = insertUserSchema.extend({
  passwordConfirm: z.string().min(6),
}).refine(data => data.password === data.passwordConfirm, {
  message: "Passwords do not match",
  path: ["passwordConfirm"]
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

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
export async function comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
  return await compare(password, hashedPassword);
}

/**
 * Middleware to check if user is authenticated
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized' });
}

/**
 * List of admin user IDs - must be provided via ADMIN_USER_IDS environment variable
 * No default admin IDs for security reasons
 */
function getAdminUserIds(): string[] {
  if (!process.env.ADMIN_USER_IDS) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ADMIN_USER_IDS environment variable is required in production');
    }
    // Only allow a safe default in development mode
    console.warn('Warning: ADMIN_USER_IDS not set, using empty array. Admin functionality will be disabled.');
    return [];
  }
  
  const adminIds = process.env.ADMIN_USER_IDS.split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
    
  if (adminIds.length === 0) {
    throw new Error('ADMIN_USER_IDS cannot be empty - provide at least one valid admin user ID');
  }
  
  return adminIds;
}

const ADMIN_USER_IDS = getAdminUserIds();

/**
 * Middleware to check if user is an admin
 * Requires authentication first - use with isAuthenticated
 */
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const userId = req.session.userId;
  
  // Check if user ID is in the admin list
  if (ADMIN_USER_IDS.includes(userId)) {
    return next();
  }

  // Return 403 Forbidden for non-admin users
  res.status(403).json({ 
    message: 'Forbidden: Admin access required',
    error: 'You do not have permission to perform this action'
  });
}

/**
 * Combined middleware: requires both authentication and admin privileges
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // First check authentication
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Then check admin status
  const userId = req.session.userId;
  if (ADMIN_USER_IDS.includes(userId)) {
    return next();
  }

  // Return 403 Forbidden for non-admin users
  res.status(403).json({ 
    message: 'Forbidden: Admin access required',
    error: 'You do not have permission to perform this action'
  });
}

/**
 * Register a new user
 */
export async function registerUser(userData: z.infer<typeof registerSchema>) {
  // Check if user already exists
  const existingUser = await storage.getUserByEmail(userData.email);
  if (existingUser) {
    throw new Error('Email is already registered');
  }

  // Hash the password
  const hashedPassword = await hashPassword(userData.password);

  // Create the user
  const user = await storage.createUser({
    ...userData,
    password: hashedPassword
  });

  // Create default user preferences
  await storage.createUserPreferences({
    userId: user.id,
    categories: [],
    keywords: [],
    authors: [],
    emailNotifications: true,
    notificationFrequency: 'weekly'
  });

  return user;
}

/**
 * Authenticate a user
 */
export async function authenticateUser(email: string, password: string) {
  const user = await storage.getUserByEmail(email);
  if (!user) {
    return null;
  }

  const isPasswordValid = await comparePasswords(password, user.password);
  if (!isPasswordValid) {
    return null;
  }

  return user;
}