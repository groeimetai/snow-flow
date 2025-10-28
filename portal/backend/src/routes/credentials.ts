/**
 * Customer Credentials API (MVP - Simple Version)
 *
 * Endpoints for customers to manage service credentials (API tokens, basic auth)
 * Uses MySQL with AES-256-GCM encryption
 */

import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { LicenseDatabase } from '../database/schema.js';
import winston from 'winston';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface CustomerSessionPayload {
  type: 'customer';
  customerId: number;
  licenseKey: string;
}

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

export function createCredentialsRoutes(db: LicenseDatabase): Router {
  const router = Router();

  /**
   * Middleware: Authenticate customer via JWT
   */
  async function authenticateCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Missing authentication token'
        });
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as CustomerSessionPayload;

      if (decoded.type !== 'customer') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token type'
        });
      }

      const customer = await db.getCustomerById(decoded.customerId);
      if (!customer) {
        return res.status(401).json({
          success: false,
          error: 'Customer not found'
        });
      }

      if (customer.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: 'Account is not active'
        });
      }

      (req as any).customerId = decoded.customerId;
      (req as any).customer = customer;
      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token'
        });
      }
      logger.error('Customer authentication error:', error);
      res.status(401).json({
        success: false,
        error: 'Authentication failed'
      });
    }
  }

  router.use(authenticateCustomer);

  /**
   * GET /api/credentials
   * GET /api/credentials/list
   * List all credentials for customer
   */
  const listHandler = async (req: Request, res: Response) => {
    try {
      const customerId = (req as any).customerId;
      const credentials = await db.listCustomerCredentials(customerId);

      logger.info({
        action: 'list_credentials',
        customerId,
        count: credentials.length
      });

      res.json({
        success: true,
        credentials: credentials.map(cred => ({
          service: cred.serviceType,
          credentialType: cred.credentialType,
          baseUrl: cred.baseUrl,
          email: cred.email,
          username: cred.username,
          enabled: cred.enabled,
          expiresAt: cred.expiresAt,
          lastUsed: cred.lastUsed,
          createdAt: cred.createdAt,
          updatedAt: cred.updatedAt
        }))
      });
    } catch (error) {
      logger.error('❌ List credentials error:', {
        action: 'list_credentials',
        customerId: (req as any).customerId,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorCode: (error as any).code,
        errorSqlMessage: (error as any).sqlMessage
      });
      res.status(500).json({
        success: false,
        error: 'Failed to list credentials',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  router.get('/', listHandler);
  router.get('/list', listHandler);

  /**
   * POST /api/credentials/store
   * Store new credential or update existing
   */
  router.post('/store', async (req: Request, res: Response) => {
    try {
      const customerId = (req as any).customerId;
      const { service, username, password, apiToken, instanceUrl } = req.body;

      if (!service || !instanceUrl) {
        return res.status(400).json({
          success: false,
          error: 'service and instanceUrl are required'
        });
      }

      let credentialType: 'api_token' | 'basic_auth';
      if (apiToken) {
        credentialType = 'api_token';
      } else if (username && password) {
        credentialType = 'basic_auth';
      } else {
        return res.status(400).json({
          success: false,
          error: 'Either apiToken or username+password is required'
        });
      }

      const existing = await db.getCustomerCredential(customerId, service);

      if (existing) {
        await db.updateCustomerCredential(customerId, service, {
          baseUrl: instanceUrl,
          apiToken: credentialType === 'api_token' ? apiToken : undefined,
          password: credentialType === 'basic_auth' ? password : undefined
        });
      } else {
        await db.createCustomerCredential({
          customerId,
          serviceType: service,
          credentialType,
          baseUrl: instanceUrl,
          apiToken: credentialType === 'api_token' ? apiToken : undefined,
          username: credentialType === 'basic_auth' ? username : undefined,
          password: credentialType === 'basic_auth' ? password : undefined,
          enabled: true
        });
      }

      logger.info({
        action: 'store_credential',
        customerId,
        service,
        credentialType
      });

      res.json({
        success: true,
        credential: {
          service,
          credentialType,
          instanceUrl,
          enabled: true
        }
      });
    } catch (error) {
      logger.error('❌ Store credential error:', {
        action: 'store_credential',
        customerId: (req as any).customerId,
        service: req.body.service,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorCode: (error as any).code,
        errorSqlMessage: (error as any).sqlMessage
      });
      res.status(500).json({
        success: false,
        error: 'Failed to store credential',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * DELETE /api/credentials/:service
   * Delete credential for service
   */
  router.delete('/:service', async (req: Request, res: Response) => {
    try {
      const customerId = (req as any).customerId;
      const service = req.params.service;

      const existing = await db.getCustomerCredential(customerId, service as any);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Service not configured'
        });
      }

      await db.deleteCustomerCredential(customerId, service);

      logger.info({
        action: 'delete_credential',
        customerId,
        service
      });

      res.json({
        success: true,
        message: `${service} credentials deleted`
      });
    } catch (error) {
      logger.error('❌ Delete credential error:', {
        action: 'delete_credential',
        customerId: (req as any).customerId,
        service: req.params.service,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorCode: (error as any).code,
        errorSqlMessage: (error as any).sqlMessage
      });
      res.status(500).json({
        success: false,
        error: 'Failed to delete credential',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
}
