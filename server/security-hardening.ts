/**
 * Security Hardening Layer
 * 
 * Implements comprehensive security measures for production deployment
 */

import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

// Rate limiting configurations
export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 // 15 minutes
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    error: 'Too many login attempts, please try again later.',
    retryAfter: 15 * 60
  },
  skipSuccessfulRequests: true,
});

export const searchRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 search requests per minute
  message: {
    error: 'Too many search requests, please slow down.',
    retryAfter: 60
  },
});

// Security headers configuration
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Needed for Vite dev
      connectSrc: ["'self'", "wss:", "https:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
});

// Input validation and sanitization
export function validateInput(req: Request, res: Response, next: NextFunction) {
  // Sanitize common injection patterns
  const sanitizeString = (str: string): string => {
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  };

  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    }
  }

  // Sanitize query parameters (skip 'query' parameter for search functionality)
  if (req.query && typeof req.query === 'object') {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string' && key !== 'query') {
        req.query[key] = sanitizeString(req.query[key] as string);
      }
    }
  }

  next();
}

// SQL injection prevention
export function preventSQLInjection(req: Request, res: Response, next: NextFunction) {
  const sqlInjectionPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    /((\%27)|(\'))union/i,
    /exec(\s|\+)+(s|x)p\w+/i,
    /UNION(?:\s+ALL)?\s+SELECT/i
  ];

  const checkForSQLInjection = (value: string): boolean => {
    return sqlInjectionPatterns.some(pattern => pattern.test(value));
  };

  // Check query parameters
  for (const key in req.query) {
    if (typeof req.query[key] === 'string') {
      if (checkForSQLInjection(req.query[key] as string)) {
        return res.status(400).json({
          error: 'Invalid request parameters detected'
        });
      }
    }
  }

  // Check request body
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        if (checkForSQLInjection(req.body[key])) {
          return res.status(400).json({
            error: 'Invalid request data detected'
          });
        }
      }
    }
  }

  next();
}

// Session security enhancement
export function enhanceSessionSecurity(req: Request, res: Response, next: NextFunction) {
  // Regenerate session ID on privilege escalation
  if (req.session && (req.session as any).userId && !(req.session as any).regenerated) {
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration failed:', err);
      } else {
        (req.session as any).regenerated = true;
      }
      next();
    });
  } else {
    next();
  }
}

// Environment validation
export function validateEnvironment(): string[] {
  const errors: string[] = [];
  
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL environment variable is required');
  }
  
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'hydrogen-minimal-secret') {
    errors.push('SESSION_SECRET must be set to a secure random value');
  }
  
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.OPENAI_API_KEY) {
      errors.push('OPENAI_API_KEY is required for production');
    }
  }
  
  return errors;
}

// Security monitoring
export class SecurityMonitor {
  private suspiciousActivity = new Map<string, number>();
  private blockedIPs = new Set<string>();

  logSuspiciousActivity(ip: string, activity: string): void {
    const key = `${ip}:${activity}`;
    const count = this.suspiciousActivity.get(key) || 0;
    this.suspiciousActivity.set(key, count + 1);
    
    // Block IP after 10 suspicious activities
    if (count >= 10) {
      this.blockedIPs.add(ip);
      console.warn(`Blocked IP ${ip} due to suspicious activity: ${activity}`);
    }
  }

  isBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      
      if (this.isBlocked(clientIP)) {
        return res.status(403).json({
          error: 'Access denied due to suspicious activity'
        });
      }
      
      next();
    };
  }
}

export const securityMonitor = new SecurityMonitor();