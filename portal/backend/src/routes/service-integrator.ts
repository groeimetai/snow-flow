/**
 * Service Integrator API Routes
 *
 * Protected endpoints for service integrator portal functionality
 * All endpoints require service integrator authentication (JWT token)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { LicenseDatabase } from '../database/schema.js';

export function createServiceIntegratorRoutes(db: LicenseDatabase): Router {
  const router = Router();

  /**
   * Middleware: Authenticate service integrator via JWT
   */
  async function authenticateSI(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Missing authentication token'
        });
      }

      // TODO: Verify JWT and extract SI ID
      // For now, we'll trust the token format
      const siId = parseInt(token.split('_')[1] || '0');

      if (!siId) {
        return res.status(401).json({
          success: false,
          error: 'Invalid token'
        });
      }

      // Attach SI ID to request
      (req as any).serviceIntegratorId = siId;
      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'Authentication failed'
      });
    }
  }

  // Apply auth middleware to all routes
  router.use(authenticateSI);

  /**
   * GET /api/service-integrator/profile
   * Get own profile
   */
  router.get('/profile', async (req: Request, res: Response) => {
    try {
      const siId = (req as any).serviceIntegratorId;
      const si = await db.getServiceIntegratorById(siId);

      if (!si) {
        return res.status(404).json({
          success: false,
          error: 'Service integrator not found'
        });
      }

      res.json({
        success: true,
        serviceIntegrator: si
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
   * PUT /api/service-integrator/profile
   * Update own profile
   */
  router.put('/profile', async (req: Request, res: Response) => {
    try {
      const siId = (req as any).serviceIntegratorId;
      const { companyName, contactEmail, billingEmail, customDomain, logoUrl } = req.body;

      const updates: any = {};
      if (companyName) updates.companyName = companyName;
      if (contactEmail) updates.contactEmail = contactEmail;
      if (billingEmail) updates.billingEmail = billingEmail;
      if (customDomain !== undefined) updates.customDomain = customDomain;
      if (logoUrl !== undefined) updates.logoUrl = logoUrl;

      const si = await db.updateServiceIntegrator(siId, updates);

      if (!si) {
        return res.status(404).json({
          success: false,
          error: 'Service integrator not found'
        });
      }

      res.json({
        success: true,
        serviceIntegrator: si
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile'
      });
    }
  });

  /**
   * GET /api/service-integrator/customers
   * Get all customers for this SI
   */
  router.get('/customers', async (req: Request, res: Response) => {
    try {
      const siId = (req as any).serviceIntegratorId;
      const status = req.query.status as 'active' | 'suspended' | 'churned' | undefined;

      const customers = await db.listCustomers(siId, status);

      res.json({
        success: true,
        count: customers.length,
        customers: customers
      });
    } catch (error) {
      console.error('Error listing customers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list customers'
      });
    }
  });

  /**
   * POST /api/service-integrator/customers
   * Create new customer
   */
  router.post('/customers', async (req: Request, res: Response) => {
    try {
      const siId = (req as any).serviceIntegratorId;
      const { name, contactEmail, company, theme } = req.body;

      if (!name || !contactEmail) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, contactEmail'
        });
      }

      // Generate license key
      const licenseKey = `SNOW-ENT-${siId}-${Date.now().toString(36).toUpperCase()}`;

      const customer = await db.createCustomer({
        serviceIntegratorId: siId,
        name,
        contactEmail,
        company: company || name,
        licenseKey,
        theme: theme || null,
        status: 'active'
      });

      res.json({
        success: true,
        customer: customer
      });
    } catch (error) {
      console.error('Error creating customer:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create customer'
      });
    }
  });

  /**
   * GET /api/service-integrator/customers/:id
   * Get customer details
   */
  router.get('/customers/:id', async (req: Request, res: Response) => {
    try {
      const siId = (req as any).serviceIntegratorId;
      const customerId = parseInt(req.params.id);

      const customer = await db.getCustomerById(customerId);

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      // Verify customer belongs to this SI
      if (customer.serviceIntegratorId !== siId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      res.json({
        success: true,
        customer: customer
      });
    } catch (error) {
      console.error('Error getting customer:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get customer'
      });
    }
  });

  /**
   * PUT /api/service-integrator/customers/:id
   * Update customer
   */
  router.put('/customers/:id', async (req: Request, res: Response) => {
    try {
      const siId = (req as any).serviceIntegratorId;
      const customerId = parseInt(req.params.id);

      // Verify customer belongs to this SI
      const existing = await db.getCustomerById(customerId);
      if (!existing || existing.serviceIntegratorId !== siId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const { name, contactEmail, company, theme, status } = req.body;

      const updates: any = {};
      if (name) updates.name = name;
      if (contactEmail) updates.contactEmail = contactEmail;
      if (company) updates.company = company;
      if (theme !== undefined) updates.theme = theme;
      if (status) updates.status = status;

      const customer = await db.updateCustomer(customerId, updates);

      res.json({
        success: true,
        customer: customer
      });
    } catch (error) {
      console.error('Error updating customer:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update customer'
      });
    }
  });

  /**
   * PUT /api/service-integrator/white-label
   * Update white-label settings
   */
  router.put('/white-label', async (req: Request, res: Response) => {
    try {
      const siId = (req as any).serviceIntegratorId;
      const { customDomain, logoUrl, whiteLabelEnabled } = req.body;

      const updates: any = {};
      if (customDomain !== undefined) updates.customDomain = customDomain;
      if (logoUrl !== undefined) updates.logoUrl = logoUrl;
      if (whiteLabelEnabled !== undefined) updates.whiteLabelEnabled = whiteLabelEnabled;

      const si = await db.updateServiceIntegrator(siId, updates);

      if (!si) {
        return res.status(404).json({
          success: false,
          error: 'Service integrator not found'
        });
      }

      res.json({
        success: true,
        serviceIntegrator: si
      });
    } catch (error) {
      console.error('Error updating white-label settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update white-label settings'
      });
    }
  });

  /**
   * GET /api/service-integrator/stats
   * Get dashboard statistics
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const siId = (req as any).serviceIntegratorId;

      // Get all customers
      const customers = await db.listCustomers(siId);

      // Calculate stats
      const activeCustomers = customers.filter((c: any) => c.status === 'active').length;
      const totalApiCalls = customers.reduce((sum: number, c: any) => sum + (c.totalApiCalls || 0), 0);

      res.json({
        success: true,
        stats: {
          totalCustomers: customers.length,
          activeCustomers: activeCustomers,
          suspendedCustomers: customers.filter((c: any) => c.status === 'suspended').length,
          totalApiCalls: totalApiCalls
        }
      });
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get stats'
      });
    }
  });

  return router;
}
