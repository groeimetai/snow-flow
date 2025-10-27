/**
 * Service Integrator API Router
 *
 * Protected endpoints for service integrator dashboard (customer management, white-label config, etc.)
 * All endpoints require valid Service Integrator JWT authentication.
 */

import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { LicenseDatabase } from '../database/schema.js';
import { ServiceIntegratorSessionPayload } from './auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const router = Router();
let db: LicenseDatabase;

/**
 * Initialize router with database instance
 * MUST be called before using the router
 */
export function initializeServiceIntegratorRouter(database: LicenseDatabase) {
  db = database;
}

// ===== MIDDLEWARE =====

/**
 * Authenticate service integrator requests with JWT token
 */
function authenticateServiceIntegrator(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.substring(7);

    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET) as ServiceIntegratorSessionPayload;

    if (decoded.type !== 'service-integrator') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    // Store service integrator ID in request for later use
    (req as any).serviceIntegratorId = decoded.serviceIntegratorId;
    (req as any).masterLicenseKey = decoded.masterLicenseKey;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
    console.error('Service integrator authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * Log all service integrator API requests
 */
function logServiceIntegratorRequest(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const masterLicenseKey = (req as any).masterLicenseKey;

    db.logApiRequest({
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      durationMs: duration,
      timestamp: startTime,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      licenseKey: masterLicenseKey,
      errorMessage: res.statusCode >= 400 ? res.statusMessage : undefined
    });
  });

  next();
}

// Apply middleware to all service integrator routes
router.use(authenticateServiceIntegrator);
router.use(logServiceIntegratorRequest);

// ===== CUSTOMER MANAGEMENT ENDPOINTS =====

/**
 * POST /api/service-integrator/customers
 * Create new end-customer license
 */
router.post('/customers', async (req: Request, res: Response) => {
  try {
    const serviceIntegratorId = (req as any).serviceIntegratorId;
    const { name, contactEmail, company, theme } = req.body;

    if (!name || !contactEmail) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, contactEmail'
      });
    }

    // Validate theme if provided
    if (theme) {
      const fs = require('fs');
      const path = require('path');
      const themePath = path.join(__dirname, '../themes', `${theme}.json`);
      if (!fs.existsSync(themePath)) {
        return res.status(400).json({
          success: false,
          error: `Theme '${theme}' not found`
        });
      }
    }

    // Generate license key: SNOW-ENT-CUSTNAME-XXXXX
    const custPrefix = name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '');
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const licenseKey = `SNOW-ENT-${custPrefix}-${randomPart}`;

    const customer = await db.createCustomer({
      serviceIntegratorId,
      name,
      contactEmail,
      company: company || name,
      theme,
      licenseKey,
      status: 'active'
    });

    res.json({
      success: true,
      customer
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
 * GET /api/service-integrator/customers
 * List all customers for this service integrator
 */
router.get('/customers', async (req: Request, res: Response) => {
  try {
    const serviceIntegratorId = (req as any).serviceIntegratorId;
    const status = req.query.status as 'active' | 'suspended' | 'churned' | undefined;

    const customers = await db.listCustomers(serviceIntegratorId, status);

    res.json({
      success: true,
      count: customers.length,
      customers
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
 * GET /api/service-integrator/customers/:id
 * Get customer details with usage stats
 */
router.get('/customers/:id', async (req: Request, res: Response) => {
  try {
    const serviceIntegratorId = (req as any).serviceIntegratorId;
    const customerId = parseInt(req.params.id);

    const customer = await db.getCustomerById(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    // Verify this customer belongs to this service integrator
    if (customer.serviceIntegratorId !== serviceIntegratorId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get instances
    const instances = await db.listCustomerInstances(customerId);

    // Get usage stats (last 30 days)
    const usageStats = await db.getMcpUsageStats(customerId, 30);

    res.json({
      success: true,
      customer,
      instances: instances.length,
      instanceDetails: instances,
      usage: usageStats
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
    const serviceIntegratorId = (req as any).serviceIntegratorId;
    const customerId = parseInt(req.params.id);
    const { name, contactEmail, company, status, theme } = req.body;

    const customer = await db.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    // Verify this customer belongs to this service integrator
    if (customer.serviceIntegratorId !== serviceIntegratorId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Validate theme if provided
    if (theme) {
      const fs = require('fs');
      const path = require('path');
      const themePath = path.join(__dirname, '../themes', `${theme}.json`);
      if (!fs.existsSync(themePath)) {
        return res.status(400).json({
          success: false,
          error: `Theme '${theme}' not found`
        });
      }
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (contactEmail !== undefined) updates.contactEmail = contactEmail;
    if (company !== undefined) updates.company = company;
    if (status !== undefined) updates.status = status;
    if (theme !== undefined) updates.theme = theme;

    const updatedCustomer = await db.updateCustomer(customerId, updates);

    res.json({
      success: true,
      customer: updatedCustomer
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
 * DELETE /api/service-integrator/customers/:id
 * Delete customer
 */
router.delete('/customers/:id', async (req: Request, res: Response) => {
  try {
    const serviceIntegratorId = (req as any).serviceIntegratorId;
    const customerId = parseInt(req.params.id);

    const customer = await db.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    // Verify this customer belongs to this service integrator
    if (customer.serviceIntegratorId !== serviceIntegratorId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await db.deleteCustomer(customerId);

    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete customer'
    });
  }
});

/**
 * GET /api/service-integrator/customers/:id/usage
 * Get customer usage statistics
 */
router.get('/customers/:id/usage', async (req: Request, res: Response) => {
  try {
    const serviceIntegratorId = (req as any).serviceIntegratorId;
    const customerId = parseInt(req.params.id);
    const days = parseInt(req.query.days as string) || 30;

    const customer = await db.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    // Verify this customer belongs to this service integrator
    if (customer.serviceIntegratorId !== serviceIntegratorId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const usageStats = await db.getMcpUsageStats(customerId, days);

    res.json({
      success: true,
      usage: usageStats
    });
  } catch (error) {
    console.error('Error getting customer usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get customer usage'
    });
  }
});

/**
 * GET /api/service-integrator/customers/:id/instances
 * Get customer instances
 */
router.get('/customers/:id/instances', async (req: Request, res: Response) => {
  try {
    const serviceIntegratorId = (req as any).serviceIntegratorId;
    const customerId = parseInt(req.params.id);

    const customer = await db.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    // Verify this customer belongs to this service integrator
    if (customer.serviceIntegratorId !== serviceIntegratorId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const instances = await db.listCustomerInstances(customerId);

    res.json({
      success: true,
      count: instances.length,
      instances
    });
  } catch (error) {
    console.error('Error getting customer instances:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get customer instances'
    });
  }
});

// ===== WHITE-LABEL CONFIGURATION ENDPOINTS =====

/**
 * GET /api/service-integrator/white-label
 * Get white-label configuration
 */
router.get('/white-label', async (req: Request, res: Response) => {
  try {
    const serviceIntegratorId = (req as any).serviceIntegratorId;

    const si = await db.getServiceIntegratorById(serviceIntegratorId);
    if (!si) {
      return res.status(404).json({
        success: false,
        error: 'Service integrator not found'
      });
    }

    res.json({
      success: true,
      whiteLabelEnabled: si.whiteLabelEnabled,
      customDomain: si.customDomain,
      logoUrl: si.logoUrl
    });
  } catch (error) {
    console.error('Error getting white-label config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get white-label configuration'
    });
  }
});

/**
 * PUT /api/service-integrator/white-label
 * Update white-label configuration
 */
router.put('/white-label', async (req: Request, res: Response) => {
  try {
    const serviceIntegratorId = (req as any).serviceIntegratorId;
    const { whiteLabelEnabled, customDomain, logoUrl } = req.body;

    const si = await db.getServiceIntegratorById(serviceIntegratorId);
    if (!si) {
      return res.status(404).json({
        success: false,
        error: 'Service integrator not found'
      });
    }

    const updates: any = {};
    if (whiteLabelEnabled !== undefined) updates.whiteLabelEnabled = whiteLabelEnabled;
    if (customDomain !== undefined) updates.customDomain = customDomain;
    if (logoUrl !== undefined) updates.logoUrl = logoUrl;

    const updatedSi = await db.updateServiceIntegrator(serviceIntegratorId, updates);

    res.json({
      success: true,
      serviceIntegrator: updatedSi
    });
  } catch (error) {
    console.error('Error updating white-label config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update white-label configuration'
    });
  }
});

// ===== PROFILE/SETTINGS ENDPOINTS =====

/**
 * GET /api/service-integrator/profile
 * Get own profile
 */
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const serviceIntegratorId = (req as any).serviceIntegratorId;

    const si = await db.getServiceIntegratorById(serviceIntegratorId);
    if (!si) {
      return res.status(404).json({
        success: false,
        error: 'Service integrator not found'
      });
    }

    // Get customer count
    const customers = await db.listCustomers(serviceIntegratorId);

    res.json({
      success: true,
      serviceIntegrator: si,
      customerCount: customers.length
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
    const serviceIntegratorId = (req as any).serviceIntegratorId;
    const { companyName, contactEmail, billingEmail } = req.body;

    const si = await db.getServiceIntegratorById(serviceIntegratorId);
    if (!si) {
      return res.status(404).json({
        success: false,
        error: 'Service integrator not found'
      });
    }

    const updates: any = {};
    if (companyName !== undefined) updates.companyName = companyName;
    if (contactEmail !== undefined) updates.contactEmail = contactEmail;
    if (billingEmail !== undefined) updates.billingEmail = billingEmail;

    const updatedSi = await db.updateServiceIntegrator(serviceIntegratorId, updates);

    res.json({
      success: true,
      serviceIntegrator: updatedSi
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

// ===== DASHBOARD STATS ENDPOINTS =====

/**
 * GET /api/service-integrator/stats
 * Get dashboard statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const serviceIntegratorId = (req as any).serviceIntegratorId;

    const customers = await db.listCustomers(serviceIntegratorId);
    const activeCustomers = customers.filter(c => c.status === 'active');
    const suspendedCustomers = customers.filter(c => c.status === 'suspended');

    // Calculate total API calls across all customers
    let totalApiCalls = 0;
    for (const customer of customers) {
      totalApiCalls += customer.totalApiCalls || 0;
    }

    res.json({
      success: true,
      stats: {
        totalCustomers: customers.length,
        activeCustomers: activeCustomers.length,
        suspendedCustomers: suspendedCustomers.length,
        totalApiCalls
      }
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics'
    });
  }
});

export const serviceIntegratorRouter = router;
