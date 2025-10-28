/**
 * Customer API Routes
 *
 * Protected endpoints for customer portal functionality
 * All endpoints require customer authentication (JWT token)
 */

import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { LicenseDatabase } from '../database/schema.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface CustomerSessionPayload {
  type: 'customer';
  customerId: number;
  licenseKey: string;
}

export function createCustomerRoutes(db: LicenseDatabase): Router {
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

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET) as CustomerSessionPayload;

      // Verify token type
      if (decoded.type !== 'customer') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token type'
        });
      }

      // Verify customer exists and is active
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

      // Attach customer to request
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
      console.error('Customer authentication error:', error);
      res.status(401).json({
        success: false,
        error: 'Authentication failed'
      });
    }
  }

  // Apply auth middleware to all routes
  router.use(authenticateCustomer);

  /**
   * GET /api/customer/profile
   * Get customer profile information
   */
  router.get('/profile', async (req: Request, res: Response) => {
    try {
      const customer = (req as any).customer;

      res.json({
        success: true,
        customer: {
          id: customer.id,
          name: customer.name,
          contactEmail: customer.contactEmail,
          company: customer.company,
          licenseKey: customer.licenseKey,
          theme: customer.theme,
          status: customer.status,
          totalApiCalls: customer.totalApiCalls,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt
        }
      });
    } catch (error) {
      console.error('Error getting profile:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get profile'
      });
    }
  });

  /**
   * GET /api/customer/usage
   * Get usage statistics for customer
   */
  router.get('/usage', async (req: Request, res: Response) => {
    try {
      const customerId = (req as any).customerId;
      const days = parseInt(req.query.days as string) || 30;

      // Get customer data
      const customer = await db.getCustomerById(customerId);
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      // Get instances for this customer
      const instances = await db.listCustomerInstances(customerId);
      const activeInstances = instances.filter((i: any) => i.status === 'active').length;

      // Calculate usage stats
      // Note: In a real implementation, you would query actual usage logs/metrics
      // For now, we'll return mock data based on totalApiCalls
      const totalApiCalls = customer.totalApiCalls || 0;
      const dailyAverage = Math.round(totalApiCalls / days);

      // Mock data for demonstration
      const usageStats = {
        totalApiCalls,
        activeInstances,
        avgResponseTime: 250 + Math.random() * 200, // Mock: 250-450ms
        peakUsageDay: new Date(Date.now() - Math.floor(Math.random() * days) * 24 * 60 * 60 * 1000).toLocaleDateString(),
        peakUsageCalls: Math.round(dailyAverage * (1.5 + Math.random())),
        errorRate: Math.random() * 0.05, // Mock: 0-5% error rate
        totalErrors: Math.round(totalApiCalls * Math.random() * 0.05),
        instanceUsage: instances.map((instance: any) => ({
          instanceUrl: instance.instanceUrl,
          apiCalls: Math.round(totalApiCalls / instances.length),
          errors: Math.round((totalApiCalls / instances.length) * Math.random() * 0.05),
          avgResponseTime: 200 + Math.random() * 300,
          lastActive: instance.lastHeartbeat
        }))
      };

      res.json(usageStats);
    } catch (error) {
      console.error('Error getting usage stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get usage statistics'
      });
    }
  });

  /**
   * GET /api/customer/instances
   * Get all instances for customer
   */
  router.get('/instances', async (req: Request, res: Response) => {
    try {
      const customerId = (req as any).customerId;

      const instances = await db.listCustomerInstances(customerId);

      res.json({
        success: true,
        count: instances.length,
        instances
      });
    } catch (error) {
      console.error('Error listing instances:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list instances'
      });
    }
  });

  return router;
}
