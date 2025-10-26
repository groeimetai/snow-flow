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
import { CredentialsDatabase } from './database/credentials-schema.js';
import { ValidationService, ValidationRequest } from './services/validation.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { adminRouter } from './routes/admin.js';
import { mcpRouter } from './routes/mcp.js';
import { createSsoRoutes } from './routes/sso.js';
import { createCredentialsRoutes } from './routes/credentials.js';
import { createThemesRoutes } from './routes/themes.js';
import { createAuthRoutes } from './routes/auth.js';
import { TokenRefreshWorker } from './workers/token-refresh.js';
import { createMonitoringRoutes, updateToolMetrics } from './routes/monitoring.js';
import { validateInput, errorHandler } from './middleware/security.js';
import { apiLogger } from './middleware/api-logger.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Initialize databases and validation service
const db = new LicenseDatabase(process.env.DB_PATH);
const credsDb = new CredentialsDatabase(db.database); // Reuse same SQLite database
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

// Body parser with size limits (10MB max to prevent DoS)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Input validation and sanitization
app.use(validateInput);

// API request logging
app.use(apiLogger);

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
 * Self-Service Credentials API
 */
const credentialsRouter = createCredentialsRoutes(db, credsDb);
app.use('/api/credentials', credentialsRouter);
logger.info('Credentials API routes registered at /api/credentials/*');
logger.info('Credentials endpoints: list, oauth-init, oauth-callback, store, update, delete, test, refresh');

/**
 * Monitoring & Health Check routes
 */
const monitoringRouter = createMonitoringRoutes(db, credsDb);
app.use('/monitoring', monitoringRouter);
logger.info('Monitoring routes registered at /monitoring/*');
logger.info('Monitoring endpoints: health, health/detailed, health/mcp, metrics, stats/usage, stats/performance, status');

/**
 * Enterprise Themes API
 */
const themesRouter = createThemesRoutes(db);
app.use('/api/themes', themesRouter);
logger.info('Themes API routes registered at /api/themes/*');
logger.info('Themes endpoints: list, :themeName, customer/current, customer/:customerId/assign');

/**
 * Authentication API (Admin & Customer Login)
 */
const authRouter = createAuthRoutes(db);
app.use('/api/auth', authRouter);
logger.info('Authentication API routes registered at /api/auth/*');
logger.info('Auth endpoints: admin/login, customer/login, admin/session, customer/session, logout');

/**
 * Serve Frontend Static Files (Production)
 */
const frontendPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendPath));
logger.info(`Serving frontend from: ${frontendPath}`);

/**
 * Client-side routing - serve index.html for all non-API routes
 */
app.get('*', (req: Request, res: Response, next: NextFunction) => {
  // Skip API routes, health checks, and static assets
  if (req.path.startsWith('/api/') ||
      req.path.startsWith('/mcp') ||
      req.path.startsWith('/sso') ||
      req.path.startsWith('/monitoring') ||
      req.path.startsWith('/validate') ||
      req.path.startsWith('/stats') ||
      req.path.startsWith('/health')) {
    return next();
  }

  res.sendFile(path.join(frontendPath, 'index.html'));
});

/**
 * Error handling middleware (with sanitization)
 */
app.use(errorHandler);

// Start OAuth2 token refresh worker
const tokenRefreshWorker = new TokenRefreshWorker(credsDb);
tokenRefreshWorker.start(5 * 60 * 1000); // Run every 5 minutes
logger.info('OAuth2 token refresh worker started (runs every 5 minutes)');

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`License server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info('');
  logger.info('='.repeat(60));
  logger.info('Snow-Flow Enterprise License Server - Ready');
  logger.info('='.repeat(60));
  logger.info(`HTTP Server: http://localhost:${PORT}`);
  logger.info(`Web Dashboard: http://localhost:${PORT}`);
  logger.info(`Health Check: http://localhost:${PORT}/health`);
  logger.info(`Admin API: http://localhost:${PORT}/api/admin/*`);
  logger.info(`Auth API: http://localhost:${PORT}/api/auth/*`);
  logger.info(`MCP HTTP: http://localhost:${PORT}/mcp/*`);
  logger.info(`SSO/SAML: http://localhost:${PORT}/sso/*`);
  logger.info(`Credentials: http://localhost:${PORT}/api/credentials/*`);
  logger.info(`Themes: http://localhost:${PORT}/api/themes/*`);
  logger.info(`Monitoring: http://localhost:${PORT}/monitoring/*`);
  logger.info('='.repeat(60));
  logger.info('Health Checks:');
  logger.info(`  Basic: http://localhost:${PORT}/monitoring/health`);
  logger.info(`  Detailed: http://localhost:${PORT}/monitoring/health/detailed`);
  logger.info(`  MCP: http://localhost:${PORT}/monitoring/health/mcp`);
  logger.info(`  Status: http://localhost:${PORT}/monitoring/status`);
  logger.info(`  Metrics: http://localhost:${PORT}/monitoring/metrics`);
  logger.info('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  tokenRefreshWorker.stop();
  server.close(() => {
    logger.info('HTTP server closed');
    db.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  tokenRefreshWorker.stop();
  server.close(() => {
    logger.info('HTTP server closed');
    db.close();
    process.exit(0);
  });
});

export { app, db, credsDb, validationService, tokenRefreshWorker };
