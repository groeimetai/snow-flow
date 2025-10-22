/**
 * License Server
 *
 * Express API server for Snow-Flow Enterprise license validation.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import dotenv from 'dotenv';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { LicenseDatabase } from './database/schema.js';
import { ValidationService, ValidationRequest } from './services/validation.js';
import { adminRouter } from './routes/admin.js';
import { mcpRouter } from './routes/mcp.js';
import { createSsoRoutes } from './routes/sso.js';

// Load environment variables
dotenv.config();

// Configure logger
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
    new winston.transports.File({ filename: 'license-server.log' })
  ]
});

// Initialize database and validation service
const db = new LicenseDatabase(process.env.DB_PATH);
const validationService = new ValidationService(db);

// Create Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/validate', limiter);

// Body parser
app.use(express.json());

// Cookie parser for SSO
app.use(cookieParser());

// Session management for SSO
app.use(session({
  secret: process.env.SESSION_SECRET || 'snow-flow-enterprise-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  }
}));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info({
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime()
  });
});

/**
 * Validate license endpoint
 */
app.post('/validate', async (req: Request, res: Response) => {
  try {
    const validationRequest: ValidationRequest = {
      key: req.body.key,
      version: req.body.version,
      instanceId: req.body.instanceId,
      timestamp: req.body.timestamp,
      signature: req.body.signature
    };

    // Get client info
    const ipAddress = req.ip || req.socket.remoteAddress;
    const hostname = req.hostname;

    // Validate
    const result = await validationService.validate(
      validationRequest,
      ipAddress,
      hostname
    );

    // Set appropriate status code
    const statusCode = result.valid ? 200 : 400;

    logger.info({
      action: 'validation',
      key: validationRequest.key.substring(0, 8) + '...',
      instanceId: validationRequest.instanceId,
      valid: result.valid,
      error: result.error
    });

    res.status(statusCode).json(result);
  } catch (error) {
    logger.error({
      action: 'validation',
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      valid: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get license statistics endpoint (admin only - legacy)
 */
app.get('/stats/:key', async (req: Request, res: Response) => {
  try {
    // Simple admin authentication
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const stats = await validationService.getStats(req.params.key);
    if (!stats) {
      return res.status(404).json({ error: 'License not found' });
    }

    res.json(stats);
  } catch (error) {
    logger.error({
      action: 'get_stats',
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Admin API routes - complete license management
 */
app.use('/api/admin', adminRouter);
logger.info('Admin API routes registered at /api/admin/*');

/**
 * MCP HTTP Server - remote tool execution
 */
app.use('/mcp', mcpRouter);
logger.info('MCP HTTP Server routes registered at /mcp/*');
logger.info('Enterprise MCP tools: 26 tools available');
logger.info('  - Jira: 8 tools');
logger.info('  - Azure DevOps: 10 tools');
logger.info('  - Confluence: 8 tools');

/**
 * SSO/SAML Authentication routes
 */
const ssoRouter = createSsoRoutes(db);
app.use('/sso', ssoRouter);
logger.info('SSO/SAML routes registered at /sso/*');
logger.info('SSO endpoints: login, callback, logout, metadata, config, sessions, stats');

/**
 * Error handling middleware
 */
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({
    error: err.message,
    stack: err.stack
  });

  res.status(500).json({
    error: 'Internal server error'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`License server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    db.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    db.close();
    process.exit(0);
  });
});

export { app, db, validationService };
