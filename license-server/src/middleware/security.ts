/**
 * Security Middleware
 *
 * Comprehensive security middleware for enterprise license server:
 * - Rate limiting (per customer, per IP)
 * - Input validation and sanitization
 * - CSRF protection
 * - Error sanitization
 * - Request validation
 * - Execution timeouts
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'security.log' })
  ]
});

// ===== RATE LIMITING =====

/**
 * Per-customer rate limiting for MCP endpoints
 * Limits: 100 requests per 15 minutes per customer
 */
export const mcpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Rate limit per customer ID
    const customer = (req as any).customer;
    if (customer && customer.id) {
      return `customer:${customer.id}`;
    }
    // Fallback to IP if no customer (should not happen with auth middleware)
    return req.ip || 'unknown';
  },
  message: {
    success: false,
    error: 'Rate limit exceeded. Maximum 100 requests per 15 minutes.',
    retryAfter: '15 minutes'
  },
  handler: (req: Request, res: Response) => {
    const customer = (req as any).customer;

    logger.warn('Rate limit exceeded', {
      customerId: customer?.id,
      customerName: customer?.name,
      ip: req.ip,
      path: req.path,
      method: req.method
    });

    res.status(429).json({
      success: false,
      error: 'Too many requests. Please slow down.',
      retryAfter: Math.ceil(15 * 60) // seconds
    });
  }
});

/**
 * Per-customer rate limiting for Credentials API
 * Limits: 50 requests per 15 minutes per customer
 */
export const credentialsRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const customer = (req as any).customer;
    return customer?.id ? `customer:creds:${customer.id}` : req.ip || 'unknown';
  },
  message: {
    success: false,
    error: 'Rate limit exceeded for credentials API',
    retryAfter: '15 minutes'
  }
});

/**
 * Aggressive rate limiting for SSO login endpoints
 * Limits: 10 login attempts per 15 minutes per IP
 */
export const ssoLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return `sso:login:${req.ip}`;
  },
  message: {
    success: false,
    error: 'Too many SSO login attempts. Please try again later.',
    retryAfter: '15 minutes'
  },
  handler: (req: Request, res: Response) => {
    logger.warn('SSO rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });

    res.status(429).json({
      success: false,
      error: 'Too many login attempts. Please try again in 15 minutes.'
    });
  }
});

// ===== INPUT VALIDATION =====

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: []
  });
}

/**
 * Recursively sanitize object
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Validate email address
 */
export function validateEmail(email: string): boolean {
  return validator.isEmail(email);
}

/**
 * Validate URL (HTTPS only)
 */
export function validateUrl(url: string): boolean {
  return validator.isURL(url, {
    protocols: ['https'],
    require_protocol: true,
    require_valid_protocol: true
  });
}

/**
 * Validate license key format
 */
export function validateLicenseKey(key: string): boolean {
  return /^SNOW-ENT-[A-Z0-9]+-[A-Z0-9]+$/.test(key);
}

/**
 * Input validation middleware
 */
export function validateInput(req: Request, res: Response, next: NextFunction): void {
  try {
    // Sanitize request body
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    next();
  } catch (error) {
    logger.error('Input validation failed', {
      error: error instanceof Error ? error.message : String(error),
      path: req.path
    });

    res.status(400).json({
      success: false,
      error: 'Invalid input data'
    });
  }
}

// ===== ERROR SANITIZATION =====

/**
 * Generate unique error ID for support lookup
 */
export function generateErrorId(): string {
  return `ERR-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
}

/**
 * Sanitize error for client response
 */
export function sanitizeError(error: Error, includeMessage: boolean = false): any {
  const errorId = generateErrorId();

  // Log full error internally
  logger.error('Error occurred', {
    errorId,
    message: error.message,
    stack: error.stack,
    name: error.name
  });

  // Return sanitized error to client
  return {
    success: false,
    error: includeMessage && process.env.NODE_ENV !== 'production'
      ? error.message
      : 'An internal error occurred. Please contact support.',
    errorId,
    support: 'Contact support@snow-flow.com with this error ID'
  };
}

/**
 * Error handling middleware
 */
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  const sanitized = sanitizeError(err);

  // Log request details for debugging
  logger.error('Request failed', {
    errorId: sanitized.errorId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    customerId: (req as any).customer?.id,
    userAgent: req.get('User-Agent')
  });

  res.status(500).json(sanitized);
}

// ===== EXECUTION TIMEOUT =====

/**
 * Wrap async function with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timeout'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    )
  ]);
}

// ===== PATH TRAVERSAL PROTECTION =====

/**
 * Validate file path to prevent path traversal
 */
export function validateFilePath(userPath: string, allowedDir: string): string {
  const path = require('path');

  const normalized = path.normalize(userPath);
  const resolved = path.resolve(allowedDir, normalized);

  // Ensure resolved path is within allowed directory
  if (!resolved.startsWith(path.resolve(allowedDir))) {
    throw new Error('Path traversal detected');
  }

  return resolved;
}

// ===== CREDENTIAL REDACTION =====

/**
 * Redact sensitive fields from object for logging
 */
export function redactSensitiveFields(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sensitiveKeys = [
    'password',
    'apiToken',
    'api_token',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'secret',
    'clientSecret',
    'client_secret',
    'apiKey',
    'api_key',
    'pat',
    'token',
    'authorization'
  ];

  const redacted: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const lowerKey = key.toLowerCase();

      if (sensitiveKeys.some(sensitiveKey => lowerKey.includes(sensitiveKey))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        redacted[key] = redactSensitiveFields(obj[key]);
      } else {
        redacted[key] = obj[key];
      }
    }
  }

  return redacted;
}

// ===== REQUEST VALIDATION =====

/**
 * Validate request size
 */
export function validateRequestSize(maxSizeBytes: number = 10 * 1024 * 1024) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get('content-length') || '0');

    if (contentLength > maxSizeBytes) {
      logger.warn('Request size exceeded', {
        contentLength,
        maxSize: maxSizeBytes,
        ip: req.ip,
        path: req.path
      });

      return res.status(413).json({
        success: false,
        error: 'Request payload too large',
        maxSize: `${maxSizeBytes / 1024 / 1024}MB`
      });
    }

    next();
  };
}

// ===== SQL INJECTION PREVENTION =====

/**
 * Validate SQL-safe string (no SQL injection patterns)
 */
export function isSqlSafe(input: string): boolean {
  // Check for common SQL injection patterns
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(\bUNION\b.*\bSELECT\b)/i,
    /(;|\-\-|\/\*|\*\/)/,
    /(\bOR\b.*=.*)/i,
    /(\bAND\b.*=.*)/i,
    /(\'|\"|`)/
  ];

  return !sqlPatterns.some(pattern => pattern.test(input));
}

/**
 * SQL injection validation middleware
 */
export function validateSqlSafe(req: Request, res: Response, next: NextFunction): any {
  const checkObject = (obj: any, path: string = ''): boolean => {
    if (typeof obj === 'string') {
      if (!isSqlSafe(obj)) {
        logger.warn('Potential SQL injection detected', {
          path,
          value: obj,
          ip: req.ip
        });
        return false;
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (!checkObject(obj[key], `${path}.${key}`)) {
            return false;
          }
        }
      }
    }
    return true;
  };

  if (req.body && !checkObject(req.body, 'body')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid input: potential SQL injection detected'
    });
  }

  if (req.query && !checkObject(req.query, 'query')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid input: potential SQL injection detected'
    });
  }

  next();
}

// ===== COMMAND INJECTION PREVENTION =====

/**
 * Validate command-safe string (no command injection patterns)
 */
export function isCommandSafe(input: string): boolean {
  // Check for common command injection patterns
  const commandPatterns = [
    /[;&|`$(){}[\]<>]/,
    /(\n|\r)/,
    /(\/bin\/|\/usr\/|\.\.\/)/,
    /(\bsh\b|\bbash\b|\bcmd\b|\bpowershell\b)/i
  ];

  return !commandPatterns.some(pattern => pattern.test(input));
}

// ===== EXPORT ALL =====

export default {
  mcpRateLimiter,
  credentialsRateLimiter,
  ssoLoginRateLimiter,
  validateInput,
  errorHandler,
  sanitizeError,
  sanitizeObject,
  validateEmail,
  validateUrl,
  validateLicenseKey,
  withTimeout,
  validateFilePath,
  redactSensitiveFields,
  validateRequestSize,
  validateSqlSafe,
  isSqlSafe,
  isCommandSafe,
  generateErrorId
};
