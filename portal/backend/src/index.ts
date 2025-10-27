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
import { CredentialsDatabase } from './database/credentials-schema.js';
import { ValidationService } from './services/validation.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { adminRouter, initializeAdminRouter } from './routes/admin.js';
import { createSsoRoutes } from './routes/sso.js';
import { createCredentialsRoutes } from './routes/credentials.js';
import { createThemesRoutes } from './routes/themes.js';
import { createAuthRoutes } from './routes/auth.js';
import { TokenRefreshWorker } from './workers/token-refresh.js';
import { createMonitoringRoutes } from './routes/monitoring.js';
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
    new winston.transports.File({ filename: 'portal.log' })
  ]
});

// Database instances
let db: LicenseDatabase;
let credsDb: CredentialsDatabase;
let validationService: ValidationService;

// Create Express app
const app = express();

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
  legacyHeaders: false
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
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'snow-flow-portal',
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'disconnected',
    credentialsDb: credsDb ? 'connected' : 'disconnected'
  });
});

// API routes (will be initialized after DB connection)
let apiRoutesInitialized = false;

function initializeApiRoutes() {
  if (apiRoutesInitialized) return;

  // Auth routes (login, logout, refresh)
  app.use('/api/auth', createAuthRoutes(db, validationService));

  // Admin routes (license management - requires admin key)
  initializeAdminRouter(db, credsDb, validationService);
  app.use('/api/admin', adminRouter);

  // Credentials routes (Jira, Azure, Confluence config)
  app.use('/api/credentials', createCredentialsRoutes(credsDb, db));

  // Themes routes
  app.use('/api/themes', createThemesRoutes(db));

  // SSO routes (SAML authentication)
  app.use('/api/sso', createSsoRoutes(db));

  // Monitoring routes (analytics, usage metrics)
  app.use('/api/monitoring', createMonitoringRoutes(db, credsDb));

  apiRoutesInitialized = true;
  logger.info('✅ API routes initialized');
}

// Serve frontend static files (React app)
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// Catch-all route for SPA (React Router)
app.get('*', (req: Request, res: Response) => {
  if (req.path.startsWith('/api')) {
    // API route not found
    res.status(404).json({ error: 'API endpoint not found' });
  } else {
    // Serve React app
    res.sendFile(path.join(frontendPath, 'index.html'));
  }
});

// Error handler
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    const port = parseInt(process.env.PORT || '8080');

    // Initialize database
    logger.info('🔌 Connecting to database...');

    db = new LicenseDatabase({
      useCloudSQL: process.env.USE_CLOUD_SQL === 'true',
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined,
      socketPath: process.env.DB_SOCKET_PATH
    });

    await db.connect();
    logger.info('✅ License database connected');

    // Initialize credentials database
    credsDb = new CredentialsDatabase({
      useCloudSQL: process.env.USE_CLOUD_SQL === 'true',
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined,
      socketPath: process.env.DB_SOCKET_PATH
    });

    await credsDb.connect();
    logger.info('✅ Credentials database connected');

    // Initialize validation service
    validationService = new ValidationService(db, logger);
    logger.info('✅ Validation service initialized');

    // Initialize session store (for SSO)
    if (process.env.USE_CLOUD_SQL === 'true') {
      const MySQLStore = MySQLStoreFactory(session);
      const sessionStore = new MySQLStore({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        socketPath: process.env.DB_SOCKET_PATH
      });

      app.use(session({
        key: 'snow_flow_session',
        secret: process.env.SESSION_SECRET || 'change-me-in-production',
        store: sessionStore,
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
      }));
      logger.info('✅ Session store (MySQL) initialized');
    }

    // Initialize API routes
    initializeApiRoutes();

    // Start token refresh worker
    const tokenWorker = new TokenRefreshWorker(db);
    tokenWorker.start();
    logger.info('✅ Token refresh worker started');

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
  if (credsDb) await credsDb.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  if (db) await db.close();
  if (credsDb) await credsDb.close();
  process.exit(0);
});

// Start the server
startServer();
