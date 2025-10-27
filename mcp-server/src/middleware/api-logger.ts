/**
 * API Request Logging Middleware
 *
 * Logs all API requests with:
 * - Method, path, status code
 * - Response time
 * - User info (admin/customer)
 * - Request/response size
 * - IP address
 */

import { Request, Response, NextFunction } from 'express';
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
    })
  ]
});

// API call statistics
interface APIStats {
  method: string;
  path: string;
  count: number;
  totalDuration: number;
  avgDuration: number;
  successCount: number;
  errorCount: number;
  lastCalled: number;
  statusCodes: Record<number, number>;
}

const apiStats = new Map<string, APIStats>();

/**
 * Get API statistics
 */
export function getAPIStats(): APIStats[] {
  return Array.from(apiStats.values()).sort((a, b) => b.count - a.count);
}

/**
 * Reset API statistics
 */
export function resetAPIStats(): void {
  apiStats.clear();
}

/**
 * API request logging middleware
 */
export function apiLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const { method, path, ip } = req;

  // Get user info if available
  const userId = (req as any).admin?.email || (req as any).customer?.id || 'anonymous';
  const userType = (req as any).admin ? 'admin' : (req as any).customer ? 'customer' : 'anonymous';

  // Log request
  logger.info({
    type: 'api_request',
    method,
    path,
    ip,
    userId,
    userType,
    timestamp: new Date().toISOString()
  });

  // Intercept response
  const originalSend = res.send;
  res.send = function(data: any): Response {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log response
    logger.info({
      type: 'api_response',
      method,
      path,
      statusCode,
      duration,
      userId,
      userType,
      timestamp: new Date().toISOString()
    });

    // Update statistics
    updateAPIStats(method, path, statusCode, duration);

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Update API statistics
 */
function updateAPIStats(method: string, path: string, statusCode: number, duration: number): void {
  // Normalize path (remove IDs)
  const normalizedPath = path.replace(/\/\d+/g, '/:id').replace(/\/[a-f0-9-]{36}/g, '/:uuid');
  const key = `${method} ${normalizedPath}`;

  const stats = apiStats.get(key) || {
    method,
    path: normalizedPath,
    count: 0,
    totalDuration: 0,
    avgDuration: 0,
    successCount: 0,
    errorCount: 0,
    lastCalled: 0,
    statusCodes: {}
  };

  stats.count++;
  stats.totalDuration += duration;
  stats.avgDuration = stats.totalDuration / stats.count;
  stats.lastCalled = Date.now();

  // Track status codes
  stats.statusCodes[statusCode] = (stats.statusCodes[statusCode] || 0) + 1;

  // Track success/error
  if (statusCode >= 200 && statusCode < 400) {
    stats.successCount++;
  } else {
    stats.errorCount++;
  }

  apiStats.set(key, stats);
}
