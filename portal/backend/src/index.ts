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

// Debug endpoint for migrations (admin only)
app.get('/debug/migrations', async (req: Request, res: Response) => {
  try {
    // Check admin key
    const adminKey = req.headers['x-admin-key'] || req.query.admin_key;
    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const status = await migrationRunner.getMigrationStatus();

    // Check if customer_credentials table exists
    let tableExists = false;
    try {
      const [rows] = await db.pool.execute(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'licenses' AND table_name = 'customer_credentials'"
      );
      tableExists = (rows as any)[0].count > 0;
    } catch (err) {
      // Ignore error
    }

    // Get migrations_history contents
    let executedMigrations: any[] = [];
    try {
      const [rows] = await db.pool.execute(
        'SELECT * FROM migrations_history ORDER BY executed_at DESC'
      );
      executedMigrations = rows as any[];
    } catch (err) {
      // Table might not exist
    }

    res.json({
      migrationStatus: status,
      customerCredentialsTableExists: tableExists,
      executedMigrations,
      migrationsDir: '/app/migrations',
      workingDir: process.cwd()
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

// Force re-run migrations (admin only)
app.post('/debug/migrations/force-run', async (req: Request, res: Response) => {
  try {
    // Check admin key
    const adminKey = req.headers['x-admin-key'] || req.query.admin_key;
    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Clear migrations_history to force re-run
    await db.pool.execute('DELETE FROM migrations_history WHERE filename = ?', ['001_add_customer_credentials.sql']);

    // Re-run migrations
    await migrationRunner.runMigrations();

    res.json({
      success: true,
      message: 'Migrations re-executed',
      status: await migrationRunner.getMigrationStatus()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

// Create tables directly (admin only - emergency fix)
app.post('/debug/create-tables', async (req: Request, res: Response) => {
  try {
    // Check admin key
    const adminKey = req.headers['x-admin-key'] || req.query.admin_key;
    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const results = [];

    // Create customer_credentials table
    try {
      await db.pool.execute(`
        CREATE TABLE IF NOT EXISTS customer_credentials (
          id INT AUTO_INCREMENT PRIMARY KEY,
          customer_id INT NOT NULL,
          service_type ENUM('jira', 'azure-devops', 'confluence', 'servicenow', 'github', 'gitlab') NOT NULL,
          credential_type ENUM('oauth2', 'api_token', 'basic_auth', 'pat') NOT NULL DEFAULT 'api_token',
          access_token TEXT,
          refresh_token TEXT,
          token_type VARCHAR(50),
          expires_at BIGINT,
          scope TEXT,
          api_token TEXT,
          username VARCHAR(255),
          password TEXT,
          base_url VARCHAR(500) NOT NULL,
          email VARCHAR(255),
          client_id VARCHAR(500),
          config_json TEXT,
          enabled BOOLEAN DEFAULT TRUE,
          last_used BIGINT,
          last_refreshed BIGINT,
          last_test_status ENUM('success', 'failed', 'not_tested') DEFAULT 'not_tested',
          last_test_message TEXT,
          last_tested_at BIGINT,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL,
          INDEX idx_cc_customer (customer_id),
          INDEX idx_cc_service_type (service_type),
          INDEX idx_cc_enabled (enabled),
          INDEX idx_cc_expires (expires_at),
          UNIQUE KEY unique_customer_service (customer_id, service_type),
          FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      results.push({ table: 'customer_credentials', status: 'created' });
    } catch (error) {
      results.push({
        table: 'customer_credentials',
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Create customer_credentials_audit table
    try {
      await db.pool.execute(`
        CREATE TABLE IF NOT EXISTS customer_credentials_audit (
          id INT AUTO_INCREMENT PRIMARY KEY,
          credential_id INT NOT NULL,
          customer_id INT NOT NULL,
          action ENUM('created', 'updated', 'accessed', 'deleted', 'tested', 'refreshed') NOT NULL,
          performed_by VARCHAR(255),
          ip_address VARCHAR(45),
          user_agent TEXT,
          success BOOLEAN DEFAULT TRUE,
          error_message TEXT,
          timestamp BIGINT NOT NULL,
          INDEX idx_cca_credential (credential_id),
          INDEX idx_cca_timestamp (timestamp),
          INDEX idx_cca_action (action),
          FOREIGN KEY (credential_id) REFERENCES customer_credentials(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      results.push({ table: 'customer_credentials_audit', status: 'created' });
    } catch (error) {
      results.push({
        table: 'customer_credentials_audit',
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    res.json({
      success: true,
      message: 'Tables creation attempted',
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
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
