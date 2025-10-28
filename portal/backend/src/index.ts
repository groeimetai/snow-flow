/**
 * Snow-Flow Enterprise Portal
 *
 * Web portal for license management, integration configuration, and analytics.
 * Separated from MCP server for independent scaling.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import dotenv from 'dotenv';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import cookieParser from 'cookie-parser';
import { LicenseDatabase } from './database/schema.js';
import { ValidationService } from './services/validation.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { adminRouter, initializeAdminRouter } from './routes/admin.js';
import { createSsoRoutes } from './routes/sso.js';
import { createCredentialsRoutes } from './routes/credentials.js';
import { createThemesRoutes } from './routes/themes.js';
import { createAuthRoutes } from './routes/auth.js';
// import { TokenRefreshWorker } from './workers/token-refresh.js'; // TODO: Update for MySQL
// import { createMonitoringRoutes } from './routes/monitoring.js'; // TODO: Update for MySQL
import { createServiceIntegratorRoutes } from './routes/service-integrator.js';
import { createCustomerRoutes } from './routes/customer.js';
import { validateInput, errorHandler } from './middleware/security.js';
import { apiLogger } from './middleware/api-logger.js';
import { MigrationRunner } from './migrations/runner.js';

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
    new winston.transports.File({ filename: 'portal.log' })
  ]
});

// Database instances
let db: LicenseDatabase;
let validationService: ValidationService | undefined;
let migrationRunner: MigrationRunner;

// Create Express app
const app = express();

// Trust proxy - required for Cloud Run (X-Forwarded-For headers)
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", process.env.ENTERPRISE_MCP_URL || 'https://enterprise.snow-flow.dev']
    }
  }
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: false // Cloud Run handles proxy headers
  }
});

app.use('/api', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Input validation
app.use(validateInput);

// API logging
app.use(apiLogger);

// Cookie parser
app.use(cookieParser());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info({
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Health check
app.get('/health', async (req: Request, res: Response) => {
  try {
    const migrationStatus = migrationRunner ? await migrationRunner.getMigrationStatus() : null;

    res.json({
      status: 'ok',
      service: 'snow-flow-portal',
      timestamp: new Date().toISOString(),
      database: db ? 'connected' : 'disconnected',
      credentialsDb: db ? 'mysql_integrated' : 'disconnected',
      migrations: migrationStatus || { status: 'not_initialized' }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      service: 'snow-flow-portal',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// API routes (will be initialized after DB connection)
let apiRoutesInitialized = false;

function initializeApiRoutes() {
  if (apiRoutesInitialized) return;

  // Auth routes (login, logout, refresh)
  app.use('/api/auth', createAuthRoutes(db));

  // Admin routes (license management - requires admin key)
  initializeAdminRouter(db);
  app.use('/api/admin', adminRouter);

  // Credentials routes (customer service integrations with MySQL + AES-256-GCM encryption)
  app.use('/api/credentials', createCredentialsRoutes(db));
  logger.info('✅ Credentials routes initialized');

  // Themes routes
  app.use('/api/themes', createThemesRoutes(db));

  // SSO routes (SAML authentication)
  app.use('/api/sso', createSsoRoutes(db));

  // Service Integrator routes (customer management, white-label)
  app.use('/api/service-integrator', createServiceIntegratorRoutes(db));

  // Customer routes (usage stats, profile)
  app.use('/api/customer', createCustomerRoutes(db));

  // TODO: Monitoring routes (requires credsDb initialization)
  // app.use('/api/monitoring', createMonitoringRoutes(db, credsDb!));

  apiRoutesInitialized = true;
  logger.info('✅ API routes initialized');
}

// Error handler
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    const port = parseInt(process.env.PORT || '8080');

    // Initialize database
    logger.info('🔌 Connecting to database...');

    db = new LicenseDatabase();
    await db.initialize();
    logger.info('✅ License database connected');

    // Run database migrations
    logger.info('🔄 Running database migrations...');
    migrationRunner = new MigrationRunner(db);
    await migrationRunner.runMigrations();
    logger.info('✅ Database migrations completed');
    logger.info('✅ Credentials management (MySQL with AES-256-GCM encryption)');

    // Initialize validation service (if it doesn't need credsDb)
    // validationService = new ValidationService(db);
    logger.info('✅ Validation service (disabled for now)');

    // TODO: Initialize session store (for SSO) when database is ready
    logger.info('✅ Session store (disabled for now)');

    // Initialize API routes
    initializeApiRoutes();

    // TODO: Start token refresh worker when database is ready
    // const tokenWorker = new TokenRefreshWorker(db);
    // tokenWorker.start();
    logger.info('✅ Token refresh worker (disabled for now)');

    // Serve frontend static files (React app) - AFTER API routes!
    // In production Docker: __dirname = /app/dist, frontend = /app/frontend/dist
    const frontendPath = path.join(__dirname, '../frontend/dist');
    app.use(express.static(frontendPath));

    // Catch-all route for SPA (React Router) - MUST be last!
    app.get('*', (req: Request, res: Response) => {
      if (req.path.startsWith('/api')) {
        // API route not found
        res.status(404).json({ error: 'API endpoint not found' });
      } else {
        // Serve React app
        res.sendFile(path.join(frontendPath, 'index.html'));
      }
    });

    // Start HTTP server
    app.listen(port, '0.0.0.0', () => {
      logger.info('');
      logger.info('╔════════════════════════════════════════════════════════╗');
      logger.info('║  Snow-Flow Enterprise Portal                           ║');
      logger.info('║  Version: 2.0.0                                        ║');
      logger.info('║                                                        ║');
      logger.info(`║  🌐 Server: http://0.0.0.0:${port}                      ║`);
      logger.info('║  🔐 Auth API: /api/auth/*                              ║');
      logger.info('║  🔑 Credentials API: /api/credentials/*                ║');
      logger.info('║  🎨 Themes API: /api/themes/*                          ║');
      logger.info('║  📊 Monitoring API: /api/monitoring/*                  ║');
      logger.info('║  👤 SSO API: /api/sso/*                                ║');
      logger.info('║  🔧 Admin API: /api/admin/* (requires ADMIN_KEY)      ║');
      logger.info('║                                                        ║');
      logger.info('║  Frontend: / (React SPA)                              ║');
      logger.info('╚════════════════════════════════════════════════════════╝');
      logger.info('');
    });
  } catch (error) {
    logger.error('❌ Failed to start portal server:', error);
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  if (db) await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  if (db) await db.close();
  process.exit(0);
});

// Start the server
startServer();
