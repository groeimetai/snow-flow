/**
 * Admin API Router
 *
 * Protected endpoints for admin dashboard (license management, analytics, etc.)
 * All endpoints require ADMIN_KEY authentication.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { LicenseDatabase } from '../database/schema.js';

const router = Router();
const db = new LicenseDatabase();

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

    const si = db.createServiceIntegrator({
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
    const integrators = db.listServiceIntegrators(status);

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
    const si = db.getServiceIntegrator(masterKey);

    if (!si) {
      return res.status(404).json({
        success: false,
        error: 'Service integrator not found'
      });
    }

    // Get customer count
    const customers = db.listCustomers(si.id);

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
 * GET /api/admin/service-integrators
 * Alias for /api/admin/si (web dashboard compatibility)
 */
router.get('/service-integrators', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as 'active' | 'suspended' | 'churned' | undefined;
    const integrators = db.listServiceIntegrators(status);

    res.json({
      success: true,
      count: integrators.length,
      service_integrators: integrators
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
    const integrators = db.listServiceIntegrators();
    const id = parseInt(req.params.id);
    const si = integrators.find(s => s.id === id);

    if (!si) {
      return res.status(404).json({
        success: false,
        error: 'Service integrator not found'
      });
    }

    // Get customer count
    const customers = db.listCustomers(si.id);

    res.json({
      success: true,
      service_integrator: si,
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
    const si = db.listServiceIntegrators().find(s => s.id === serviceIntegratorId);
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

    const customer = db.createCustomer({
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
      customers = db.listCustomers(serviceIntegratorId, status);
    } else {
      // Get all customers across all SIs
      const allSIs = db.listServiceIntegrators();
      customers = allSIs.flatMap(si => db.listCustomers(si.id, status));
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
    const customer = db.getCustomerById(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    // Get instances
    const instances = db.listCustomerInstances(customerId);

    // Get usage stats (last 30 days)
    const usageStats = db.getMcpUsageStats(customerId, 30);

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

    const customer = db.getCustomerById(customerId);
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

    const updated = db.getCustomerById(customerId);

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

    const customer = db.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    const stats = db.getMcpUsageStats(customerId, days);
    const timeseries = db.getMcpUsageTimeseries(customerId, days, 'day');

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

    const customer = db.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    const instances = db.listCustomerInstances(customerId);

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
    const allSIs = db.listServiceIntegrators();
    const allCustomers = allSIs.flatMap(si => db.listCustomers(si.id));
    const activeCustomers = allCustomers.filter(c => c.status === 'active');

    // Total API calls across all customers
    const totalApiCalls = allCustomers.reduce((sum, c) => sum + c.totalApiCalls, 0);

    // API stats (last 30 days)
    const apiStats = db.getApiStats(30);

    // Calculate total instances
    const totalInstances = activeCustomers.reduce((sum, c) => {
      return sum + db.getCustomerInstanceCount(c.id);
    }, 0);

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
    const allSIs = db.listServiceIntegrators();
    const allCustomers = allSIs.flatMap(si => db.listCustomers(si.id));

    // Aggregate tool usage across all customers
    const toolUsage: Record<string, number> = {};
    const categoryUsage: Record<string, number> = {};

    allCustomers.forEach(customer => {
      const stats = db.getMcpUsageStats(customer.id, days);

      // Aggregate by tool
      stats.topTools.forEach(tool => {
        toolUsage[tool.toolName] = (toolUsage[tool.toolName] || 0) + tool.count;
      });

      // Aggregate by category
      Object.entries(stats.byCategory).forEach(([category, count]) => {
        categoryUsage[category] = (categoryUsage[category] || 0) + count;
      });
    });

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
    const allSIs = db.listServiceIntegrators();
    const allCustomers = allSIs.flatMap(si => db.listCustomers(si.id));

    const customerStats = allCustomers.map(customer => {
      const stats = db.getMcpUsageStats(customer.id, days);
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
    });

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
    // Get customers count from database
    const stmt = db.database.prepare('SELECT COUNT(*) as total FROM customers');
    const totalCustomers = (stmt.get() as any).total;

    const activeStmt = db.database.prepare("SELECT COUNT(*) as total FROM customers WHERE status = 'active'");
    const activeCustomers = (activeStmt.get() as any).total;

    const suspendedStmt = db.database.prepare("SELECT COUNT(*) as total FROM customers WHERE status = 'suspended'");
    const suspendedCustomers = (suspendedStmt.get() as any).total;

    // Get API stats
    const apiStats1Day = db.getApiStats(1); // Last 24 hours
    const apiStats7Days = db.getApiStats(7); // Last 7 days
    const apiStatsTotal = db.getApiStats(365); // Last year (as total)

    // Get service integrators
    const serviceIntegrators = db.listServiceIntegrators();

    // Get active instances count
    const instancesStmt = db.database.prepare(`
      SELECT COUNT(*) as total FROM customer_instances
      WHERE last_seen > ?
    `);
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const activeInstances = (instancesStmt.get(oneDayAgo) as any).total;

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
    const apiStats = db.getApiStats(1); // Last 24 hours

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
