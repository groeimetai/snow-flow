/**
 * Admin API Router
 *
 * Protected endpoints for admin dashboard (license management, analytics, etc.)
 * All endpoints require ADMIN_KEY authentication.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { LicenseDatabase } from '../database/schema.js';

const router = Router();
let db: LicenseDatabase;

/**
 * Initialize router with database instance
 * MUST be called before using the router
 */
export function initializeAdminRouter(database: LicenseDatabase) {
  db = database;
}

// ===== HELPER FUNCTIONS =====

/**
 * Convert service integrator from database (snake_case) to API format (camelCase)
 */
function formatServiceIntegrator(si: any): any {
  return {
    id: si.id,
    companyName: si.company_name,
    contactEmail: si.contact_email,
    billingEmail: si.billing_email,
    masterLicenseKey: si.master_license_key,
    whiteLabelEnabled: Boolean(si.white_label_enabled),
    customDomain: si.custom_domain,
    logoUrl: si.logo_url,
    createdAt: si.created_at,
    status: si.status
  };
}

// ===== MIDDLEWARE =====

/**
 * Authenticate admin requests with cookie session or ADMIN_KEY header
 */
function authenticateAdmin(req: Request, res: Response, next: NextFunction) {
  // Check for admin session cookie (new web dashboard auth)
  const adminSessionCookie = req.cookies?.admin_session;

  if (adminSessionCookie) {
    try {
      const session = JSON.parse(adminSessionCookie);
      if (session.type === 'admin') {
        // Valid admin session
        return next();
      }
    } catch (error) {
      // Invalid cookie, fall through to header check
    }
  }

  // Fallback to ADMIN_KEY header (legacy API auth)
  const adminKey = req.headers['x-admin-key'] || req.query.admin_key;

  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Invalid or missing admin authentication'
    });
  }

  next();
}

/**
 * Log all admin API requests
 */
function logAdminRequest(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    db.logApiRequest({
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      durationMs: duration,
      timestamp: startTime,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      licenseKey: req.headers['x-admin-key'] as string | undefined,
      errorMessage: res.statusCode >= 400 ? res.statusMessage : undefined
    });
  });

  next();
}

// Apply middleware to all admin routes
router.use(authenticateAdmin);
router.use(logAdminRequest);

// ===== SERVICE INTEGRATOR ENDPOINTS =====

/**
 * POST /api/admin/si
 * Create new service integrator (master account)
 */
router.post('/si', async (req: Request, res: Response) => {
  try {
    const { companyName, contactEmail, billingEmail } = req.body;

    if (!companyName || !contactEmail || !billingEmail) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: companyName, contactEmail, billingEmail'
      });
    }

    // Generate master license key: SNOW-SI-XXXXX
    const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
    const masterLicenseKey = `SNOW-SI-${randomPart}`;

    const si = await db.createServiceIntegrator({
      companyName,
      contactEmail,
      billingEmail,
      masterLicenseKey,
      whiteLabelEnabled: false,
      status: 'active'
    });

    res.json({
      success: true,
      serviceIntegrator: si
    });
  } catch (error) {
    console.error('Error creating service integrator:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create service integrator'
    });
  }
});

/**
 * GET /api/admin/si
 * List all service integrators
 */
router.get('/si', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as 'active' | 'suspended' | 'churned' | undefined;
    const integrators = await db.listServiceIntegrators(status);

    res.json({
      success: true,
      count: integrators.length,
      serviceIntegrators: integrators
    });
  } catch (error) {
    console.error('Error listing service integrators:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list service integrators'
    });
  }
});

/**
 * GET /api/admin/si/:masterKey
 * Get service integrator details
 */
router.get('/si/:masterKey', async (req: Request, res: Response) => {
  try {
    const { masterKey } = req.params;
    const si = await db.getServiceIntegrator(masterKey);

    if (!si) {
      return res.status(404).json({
        success: false,
        error: 'Service integrator not found'
      });
    }

    // Get customer count
    const customers = await db.listCustomers(si.id);

    res.json({
      success: true,
      serviceIntegrator: si,
      stats: {
        totalCustomers: customers.length,
        activeCustomers: customers.filter(c => c.status === 'active').length
      }
    });
  } catch (error) {
    console.error('Error getting service integrator:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get service integrator'
    });
  }
});

// ===== SERVICE INTEGRATORS ALIASES (for web dashboard) =====

/**
 * POST /api/admin/service-integrators
 * Create new service integrator (web dashboard compatibility)
 */
router.post('/service-integrators', async (req: Request, res: Response) => {
  try {
    const { companyName, contactEmail, billingEmail } = req.body;

    if (!companyName || !contactEmail || !billingEmail) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: companyName, contactEmail, billingEmail'
      });
    }

    // Generate master license key: SNOW-SI-XXXXX
    const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
    const masterLicenseKey = `SNOW-SI-${randomPart}`;

    const si = await db.createServiceIntegrator({
      companyName,
      contactEmail,
      billingEmail,
      masterLicenseKey,
      whiteLabelEnabled: false,
      status: 'active'
    });

    res.json({
      success: true,
      service_integrator: si
    });
  } catch (error) {
    console.error('Error creating service integrator:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create service integrator'
    });
  }
});

/**
 * GET /api/admin/service-integrators
 * Alias for /api/admin/si (web dashboard compatibility)
 */
router.get('/service-integrators', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as 'active' | 'suspended' | 'churned' | undefined;
    const integrators = await db.listServiceIntegrators(status);

    res.json({
      success: true,
      count: integrators.length,
      service_integrators: integrators.map(formatServiceIntegrator)
    });
  } catch (error) {
    console.error('Error listing service integrators:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list service integrators'
    });
  }
});

/**
 * GET /api/admin/service-integrators/:id
 * Alias for /api/admin/si/:id (web dashboard compatibility)
 */
router.get('/service-integrators/:id', async (req: Request, res: Response) => {
  try {
    const integrators = await db.listServiceIntegrators();
    const id = parseInt(req.params.id);
    const si = integrators.find(s => s.id === id);

    if (!si) {
      return res.status(404).json({
        success: false,
        error: 'Service integrator not found'
      });
    }

    // Get customer count
    const customers = await db.listCustomers(si.id);

    res.json({
      success: true,
      service_integrator: formatServiceIntegrator(si),
      stats: {
        totalCustomers: customers.length,
        activeCustomers: customers.filter(c => c.status === 'active').length
      }
    });
  } catch (error) {
    console.error('Error getting service integrator:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get service integrator'
    });
  }
});

/**
 * PUT /api/admin/service-integrators/:id
 * Update service integrator
 */
router.put('/service-integrators/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;

    const si = await db.updateServiceIntegrator(id, updates);

    if (!si) {
      return res.status(404).json({
        success: false,
        error: 'Service integrator not found'
      });
    }

    res.json({
      success: true,
      service_integrator: formatServiceIntegrator(si)
    });
  } catch (error) {
    console.error('Error updating service integrator:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update service integrator'
    });
  }
});

/**
 * DELETE /api/admin/service-integrators/:id
 * Delete service integrator
 */
router.delete('/service-integrators/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    // Check if SI has customers
    const customers = await db.listCustomers(id);
    if (customers.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete service integrator with ${customers.length} active customers`
      });
    }

    db.deleteServiceIntegrator(id);

    res.json({
      success: true,
      message: 'Service integrator deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting service integrator:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete service integrator'
    });
  }
});

// ===== CUSTOMER ENDPOINTS =====

/**
 * POST /api/admin/customers
 * Create new customer
 */
router.post('/customers', async (req: Request, res: Response) => {
  try {
    const { serviceIntegratorId, name, contactEmail, company, theme } = req.body;

    if (!serviceIntegratorId || !name || !contactEmail) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: serviceIntegratorId, name, contactEmail'
      });
    }

    // Verify service integrator exists
    const integrators = await db.listServiceIntegrators();
    const si = integrators.find(s => s.id === serviceIntegratorId);
    if (!si) {
      return res.status(404).json({
        success: false,
        error: 'Service integrator not found'
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
      company,
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
 * GET /api/admin/customers
 * List customers (optionally filtered by service integrator)
 */
router.get('/customers', async (req: Request, res: Response) => {
  try {
    const serviceIntegratorId = req.query.si_id ? parseInt(req.query.si_id as string) : undefined;
    const status = req.query.status as 'active' | 'suspended' | 'churned' | undefined;

    let customers;
    if (serviceIntegratorId) {
      customers = await db.listCustomers(serviceIntegratorId, status);
    } else {
      // Get all customers across all SIs
      const allSIs = await db.listServiceIntegrators();
      const customerPromises = allSIs.map(si => db.listCustomers(si.id, status));
      const customerArrays = await Promise.all(customerPromises);
      customers = customerArrays.flat();
    }

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
 * GET /api/admin/customers/:id
 * Get customer details with usage stats
 */
router.get('/customers/:id', async (req: Request, res: Response) => {
  try {
    const customerId = parseInt(req.params.id);
    const customer = await db.getCustomerById(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
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
 * PUT /api/admin/customers/:id
 * Update customer
 */
router.put('/customers/:id', async (req: Request, res: Response) => {
  try {
    const customerId = parseInt(req.params.id);
    const { name, contactEmail, company, status, theme } = req.body;

    const customer = await db.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    // Validate theme if provided
    if (theme !== undefined) {
      const fs = require('fs');
      const path = require('path');
      const themePath = path.join(__dirname, '../themes', `${theme}.json`);
      if (theme && !fs.existsSync(themePath)) {
        return res.status(400).json({
          success: false,
          error: `Theme '${theme}' not found`
        });
      }
    }

    db.updateCustomer(customerId, { name, contactEmail, company, status, theme });

    const updated = await db.getCustomerById(customerId);

    res.json({
      success: true,
      customer: updated
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
 * GET /api/admin/customers/:id/usage
 * Get customer usage statistics
 */
router.get('/customers/:id/usage', async (req: Request, res: Response) => {
  try {
    const customerId = parseInt(req.params.id);
    const days = req.query.days ? parseInt(req.query.days as string) : 30;

    const customer = await db.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    const stats = await db.getMcpUsageStats(customerId, days);
    const timeseries = await db.getMcpUsageTimeseries(customerId, days, 'day');

    res.json({
      success: true,
      customerId,
      period: `${days} days`,
      stats,
      timeseries
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
 * GET /api/admin/customers/:id/instances
 * Get customer instances
 */
router.get('/customers/:id/instances', async (req: Request, res: Response) => {
  try {
    const customerId = parseInt(req.params.id);

    const customer = await db.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    const instances = await db.listCustomerInstances(customerId);

    res.json({
      success: true,
      customerId,
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

// ===== ANALYTICS ENDPOINTS =====

/**
 * GET /api/admin/analytics/overview
 * Dashboard overview metrics
 */
router.get('/analytics/overview', async (req: Request, res: Response) => {
  try {
    const allSIs = await db.listServiceIntegrators();
    const customerPromises = allSIs.map(si => db.listCustomers(si.id));
    const customerArrays = await Promise.all(customerPromises);
    const allCustomers = customerArrays.flat();
    const activeCustomers = allCustomers.filter(c => c.status === 'active');

    // Total API calls across all customers
    const totalApiCalls = allCustomers.reduce((sum, c) => sum + c.totalApiCalls, 0);

    // API stats (last 30 days)
    const apiStats = await db.getApiStats(30);

    // Calculate total instances
    const instancePromises = activeCustomers.map(c => db.getCustomerInstanceCount(c.id));
    const instanceCounts = await Promise.all(instancePromises);
    const totalInstances = instanceCounts.reduce((sum, count) => sum + count, 0);

    res.json({
      success: true,
      overview: {
        totalServiceIntegrators: allSIs.length,
        activeServiceIntegrators: allSIs.filter(si => si.status === 'active').length,
        totalCustomers: allCustomers.length,
        activeCustomers: activeCustomers.length,
        totalInstances,
        totalApiCalls,
        apiStats: {
          totalRequests: apiStats.totalRequests,
          avgDurationMs: Math.round(apiStats.avgDurationMs),
          errorRate: (apiStats.errorRate * 100).toFixed(2) + '%'
        }
      }
    });
  } catch (error) {
    console.error('Error getting analytics overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics overview'
    });
  }
});

/**
 * GET /api/admin/analytics/tools
 * Tool usage statistics across all customers
 */
router.get('/analytics/tools', async (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const allSIs = await db.listServiceIntegrators();
    const customerPromises = allSIs.map(si => db.listCustomers(si.id));
    const customerArrays = await Promise.all(customerPromises);
    const allCustomers = customerArrays.flat();

    // Aggregate tool usage across all customers
    const toolUsage: Record<string, number> = {};
    const categoryUsage: Record<string, number> = {};

    for (const customer of allCustomers) {
      const stats = await db.getMcpUsageStats(customer.id, days);

      // Aggregate by tool
      stats.topTools.forEach(tool => {
        toolUsage[tool.toolName] = (toolUsage[tool.toolName] || 0) + tool.count;
      });

      // Aggregate by category
      Object.entries(stats.byCategory).forEach(([category, count]) => {
        categoryUsage[category] = (categoryUsage[category] || 0) + count;
      });
    }

    // Sort tools by usage
    const topTools = Object.entries(toolUsage)
      .map(([toolName, count]) => ({ toolName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    res.json({
      success: true,
      period: `${days} days`,
      toolUsage: topTools,
      categoryUsage
    });
  } catch (error) {
    console.error('Error getting tool analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tool analytics'
    });
  }
});

/**
 * GET /api/admin/analytics/customers
 * Customer usage analytics
 */
router.get('/analytics/customers', async (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const allSIs = await db.listServiceIntegrators();
    const customerPromises = allSIs.map(si => db.listCustomers(si.id));
    const customerArrays = await Promise.all(customerPromises);
    const allCustomers = customerArrays.flat();

    const customerStats = await Promise.all(allCustomers.map(async (customer) => {
      const stats = await db.getMcpUsageStats(customer.id, days);
      return {
        customerId: customer.id,
        customerName: customer.name,
        licenseKey: customer.licenseKey,
        totalApiCalls: customer.totalApiCalls,
        recentCalls: stats.totalCalls,
        successRate: stats.totalCalls > 0
          ? ((stats.successfulCalls / stats.totalCalls) * 100).toFixed(2) + '%'
          : 'N/A',
        avgDurationMs: Math.round(stats.avgDurationMs),
        topTools: stats.topTools.slice(0, 5)
      };
    }));

    // Sort by recent API calls
    customerStats.sort((a, b) => b.recentCalls - a.recentCalls);

    res.json({
      success: true,
      period: `${days} days`,
      customers: customerStats
    });
  } catch (error) {
    console.error('Error getting customer analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get customer analytics'
    });
  }
});

// ===== DASHBOARD STATS ENDPOINT =====

/**
 * GET /api/admin/stats/dashboard
 * Get dashboard overview statistics
 */
router.get('/stats/dashboard', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    // Check if database is initialized
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'Database not initialized'
      });
    }

    // Get customers count from database (MySQL2)
    const [totalRows] = await (db as any).pool.execute('SELECT COUNT(*) as total FROM customers') as any;
    const totalCustomers = totalRows[0].total;

    const [activeRows] = await (db as any).pool.execute("SELECT COUNT(*) as total FROM customers WHERE status = 'active'") as any;
    const activeCustomers = activeRows[0].total;

    const [suspendedRows] = await (db as any).pool.execute("SELECT COUNT(*) as total FROM customers WHERE status = 'suspended'") as any;
    const suspendedCustomers = suspendedRows[0].total;

    // Get API stats
    const apiStats1Day = await db.getApiStats(1); // Last 24 hours
    const apiStats7Days = await db.getApiStats(7); // Last 7 days
    const apiStatsTotal = await db.getApiStats(365); // Last year (as total)

    // Get service integrators
    const serviceIntegrators = await db.listServiceIntegrators();

    // Get active instances count (MySQL2)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const [instanceRows] = await (db as any).pool.execute(`
      SELECT COUNT(*) as total FROM customer_instances
      WHERE last_seen > ?
    `, [oneDayAgo]) as any;
    const activeInstances = instanceRows[0].total;

    res.json({
      totalCustomers,
      activeCustomers,
      suspendedCustomers,
      totalApiCalls: apiStatsTotal.totalRequests,
      apiCallsToday: apiStats1Day.totalRequests,
      apiCallsThisWeek: apiStats7Days.totalRequests,
      activeInstances,
      totalServiceIntegrators: serviceIntegrators.length,
      recentActivity: [] // Can be enhanced later
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard statistics'
    });
  }
});

// ===== SYSTEM HEALTH ENDPOINTS =====

/**
 * GET /api/admin/health
 * System health check
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const apiStats = await db.getApiStats(1); // Last 24 hours

    res.json({
      success: true,
      status: 'healthy',
      timestamp: Date.now(),
      stats: {
        requestsLast24h: apiStats.totalRequests,
        avgResponseTime: Math.round(apiStats.avgDurationMs) + 'ms',
        errorRate: (apiStats.errorRate * 100).toFixed(2) + '%'
      }
    });
  } catch (error) {
    console.error('Error getting health:', error);
    res.status(500).json({
      success: false,
      error: 'System unhealthy'
    });
  }
});

export { router as adminRouter };
