/**
 * CSRF Protection Module
 * Implements double-submit cookie pattern for CSRF protection
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

interface CsrfSession {
  csrfSecret?: string;
}

const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE = 'csrf-token';
const CSRF_FIELD = '_csrf';

/**
 * Generates a CSRF token using crypto
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generates a hash of the token with a secret
 */
function hashToken(token: string, secret: string): string {
  return crypto
    .createHash('sha256')
    .update(token + secret)
    .digest('hex');
}

/**
 * Verifies a CSRF token against the session secret
 */
function verifyToken(token: string, secret: string, hashedToken: string): boolean {
  const expectedHash = hashToken(token, secret);
  return crypto.timingSafeEqual(
    Buffer.from(expectedHash),
    Buffer.from(hashedToken)
  );
}

/**
 * CSRF middleware configuration options
 */
interface CsrfOptions {
  ignoreMethods?: string[];
  ignoreRoutes?: string[];
  cookie?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
  };
}

/**
 * Creates CSRF protection middleware
 */
export function csrfProtection(options: CsrfOptions = {}) {
  const {
    ignoreMethods = ['GET', 'HEAD', 'OPTIONS'],
    ignoreRoutes = ['/health', '/api/stats', '/api/search'],
    cookie = {}
  } = options;

  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: cookie.httpOnly !== false,
    secure: cookie.secure ?? isProduction,
    sameSite: cookie.sameSite ?? (isProduction ? 'strict' : 'lax')
  };

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF check for ignored methods
    if (ignoreMethods.includes(req.method)) {
      // Generate token for GET requests to provide to forms
      if (req.method === 'GET' && req.session) {
        ensureCsrfToken(req, res, cookieOptions);
      }
      return next();
    }

    // Skip CSRF check for ignored routes
    if (ignoreRoutes.some(route => req.path.startsWith(route))) {
      return next();
    }

    // Skip if no session (not authenticated)
    if (!req.session) {
      return next();
    }

    // Get token from request
    const token = getTokenFromRequest(req);
    
    if (!token) {
      return res.status(403).json({ 
        error: 'CSRF token missing',
        message: 'This request requires a valid CSRF token'
      });
    }

    // Get session secret
    const session = req.session as any;
    const secret = session.csrfSecret;

    if (!secret) {
      return res.status(403).json({ 
        error: 'CSRF validation failed',
        message: 'No CSRF secret in session'
      });
    }

    // Get the hashed token from cookie
    const hashedToken = req.cookies?.[CSRF_COOKIE];
    
    if (!hashedToken) {
      return res.status(403).json({ 
        error: 'CSRF validation failed',
        message: 'No CSRF cookie present'
      });
    }

    // Verify token
    try {
      if (!verifyToken(token, secret, hashedToken)) {
        return res.status(403).json({ 
          error: 'CSRF validation failed',
          message: 'Invalid CSRF token'
        });
      }
    } catch (error) {
      console.error('CSRF verification error:', error);
      return res.status(403).json({ 
        error: 'CSRF validation failed',
        message: 'Token verification failed'
      });
    }

    // Token is valid, proceed
    next();
  };
}

/**
 * Ensures a CSRF token exists for the session
 */
function ensureCsrfToken(req: Request, res: Response, cookieOptions: any) {
  const session = req.session as any;
  
  // Generate secret if it doesn't exist
  if (!session.csrfSecret) {
    session.csrfSecret = generateToken();
  }

  // Generate token and set cookie
  const token = generateToken();
  const hashedToken = hashToken(token, session.csrfSecret);
  
  res.cookie(CSRF_COOKIE, hashedToken, {
    ...cookieOptions,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });

  // Attach token to response locals for use in templates
  res.locals.csrfToken = token;
}

/**
 * Gets CSRF token from request (header, body, or query)
 */
function getTokenFromRequest(req: Request): string | undefined {
  // Check header first (preferred for API requests)
  const headerToken = req.headers[CSRF_HEADER] as string;
  if (headerToken) {
    return headerToken;
  }

  // Check body (for form submissions)
  if (req.body && req.body[CSRF_FIELD]) {
    return req.body[CSRF_FIELD];
  }

  // Check query (fallback)
  if (req.query && req.query[CSRF_FIELD]) {
    return req.query[CSRF_FIELD] as string;
  }

  return undefined;
}

/**
 * Express middleware to provide CSRF token to views
 */
export function csrfToken() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Make token available to views
    res.locals.csrfToken = res.locals.csrfToken || '';
    
    // Add a helper function to get the token
    res.locals.getCsrfToken = () => res.locals.csrfToken;
    
    next();
  };
}

/**
 * Helper to add CSRF token to API responses
 */
export function addCsrfToResponse(req: Request, res: Response) {
  if (res.locals.csrfToken) {
    res.setHeader('X-CSRF-Token', res.locals.csrfToken);
  }
}