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