import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { LicenseDatabase } from '../database/schema.js';
import { parseLicenseKey, isLicenseExpired } from '../license/parser.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d'; // Token expires in 7 days

export interface AdminSessionPayload {
  type: 'admin';
  email: string;
}

export interface CustomerSessionPayload {
  type: 'customer';
  customerId: number;
  licenseKey: string;
  // Seat management (v2.0.0)
  role?: 'developer' | 'stakeholder' | 'admin';
  developerSeats?: number; // -1 = unlimited
  stakeholderSeats?: number; // -1 = unlimited
  activeDeveloperSeats?: number;
  activeStakeholderSeats?: number;
  seatLimitsEnforced?: boolean;
  // Machine identity (for MCP connections)
  machineId?: string; // SHA-256 hash of machine fingerprint
}

export interface ServiceIntegratorSessionPayload {
  type: 'service-integrator';
  serviceIntegratorId: number;
  masterLicenseKey: string;
  company: string;
}

export function createAuthRoutes(db: LicenseDatabase): Router {
  const router = Router();

  /**
   * POST /api/auth/admin/login
   * Admin login with ADMIN_KEY
   */
  router.post('/admin/login', async (req: Request, res: Response): Promise<void> => {
    try {
      const { adminKey } = req.body;

      if (!adminKey) {
        res.status(400).json({ error: 'Admin key is required' });
        return;
      }

      // Verify admin key
      const ADMIN_KEY = process.env.ADMIN_KEY;
      if (!ADMIN_KEY) {
        console.error('ADMIN_KEY not configured in environment');
        res.status(500).json({ error: 'Server configuration error' });
        return;
      }

      if (adminKey !== ADMIN_KEY) {
        res.status(401).json({ error: 'Invalid admin key' });
        return;
      }

      // Create admin session (using HTTP-only cookie)
      const sessionPayload: AdminSessionPayload = {
        type: 'admin',
        email: 'admin@snow-flow.local', // Could be configurable
      };

      // Set HTTP-only cookie
      res.cookie('admin_session', JSON.stringify(sessionPayload), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        success: true,
        session: {
          type: 'admin',
          email: sessionPayload.email,
        },
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/auth/customer/login
   * Customer login with license key (web portal login)
   */
  router.post('/customer/login', async (req: Request, res: Response): Promise<void> => {
    try {
      const { licenseKey } = req.body;

      if (!licenseKey) {
        res.status(400).json({ error: 'License key is required' });
        return;
      }

      // Find customer by license key
      const customer = await db.getCustomer(licenseKey);
      if (!customer) {
        res.status(401).json({ error: 'Invalid license key' });
        return;
      }

      // Check customer status
      if (customer.status === 'suspended') {
        res.status(403).json({ error: 'Account suspended' });
        return;
      }

      if (customer.status === 'churned') {
        res.status(403).json({ error: 'Account is no longer active' });
        return;
      }

      // Parse license for seat information
      let parsedLicense;
      try {
        parsedLicense = parseLicenseKey(customer.licenseKey);
      } catch (parseError) {
        console.error('License parse error:', parseError);
        res.status(401).json({ error: 'Invalid license format' });
        return;
      }

      // Check if license is expired
      if (isLicenseExpired(parsedLicense)) {
        res.status(403).json({ error: 'License has expired' });
        return;
      }

      // Generate JWT token
      const tokenPayload: CustomerSessionPayload = {
        type: 'customer',
        customerId: customer.id,
        licenseKey: customer.licenseKey,
        // Seat information for web portal
        developerSeats: customer.developerSeats,
        stakeholderSeats: customer.stakeholderSeats,
        activeDeveloperSeats: customer.activeDeveloperSeats,
        activeStakeholderSeats: customer.activeStakeholderSeats,
        seatLimitsEnforced: customer.seatLimitsEnforced,
      };

      const token = jwt.sign(tokenPayload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      // Fetch custom theme if assigned
      let customTheme = null;
      if (customer.customThemeId) {
        const theme = await db.getSITheme(customer.customThemeId);
        if (theme && theme.isActive) {
          customTheme = {
            themeName: theme.themeName,
            displayName: theme.displayName,
            themeConfig: theme.themeConfig,
            primaryColor: theme.primaryColor,
            secondaryColor: theme.secondaryColor,
            accentColor: theme.accentColor,
          };
        }
      }

      res.json({
        success: true,
        token,
        customer: {
          id: customer.id,
          name: customer.name,
          contactEmail: customer.contactEmail,
          company: customer.company,
          licenseKey: customer.licenseKey,
          theme: customer.theme,
          customTheme: customTheme,
          status: customer.status,
          totalApiCalls: customer.totalApiCalls,
          createdAt: customer.createdAt,
          // Seat information (v2.0.0)
          developerSeats: customer.developerSeats,
          stakeholderSeats: customer.stakeholderSeats,
          activeDeveloperSeats: customer.activeDeveloperSeats,
          activeStakeholderSeats: customer.activeStakeholderSeats,
          seatLimitsEnforced: customer.seatLimitsEnforced,
        },
      });
    } catch (error) {
      console.error('Customer login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/auth/mcp/login
   * MCP client login with license key, machine ID, and role
   * Used by Claude Code clients for seat-based connection tracking
   */
  router.post('/mcp/login', async (req: Request, res: Response): Promise<void> => {
    try {
      const { licenseKey, machineId, role } = req.body;

      // Validate required fields
      if (!licenseKey) {
        res.status(400).json({ error: 'License key is required' });
        return;
      }

      if (!machineId) {
        res.status(400).json({ error: 'Machine ID is required' });
        return;
      }

      if (!role || !['developer', 'stakeholder', 'admin'].includes(role)) {
        res.status(400).json({ error: 'Valid role is required (developer, stakeholder, or admin)' });
        return;
      }

      // Hash machine ID for privacy
      const hashedMachineId = crypto
        .createHash('sha256')
        .update(machineId)
        .digest('hex');

      // Find customer by license key
      const customer = await db.getCustomer(licenseKey);
      if (!customer) {
        res.status(401).json({ error: 'Invalid license key' });
        return;
      }

      // Check customer status
      if (customer.status === 'suspended') {
        res.status(403).json({ error: 'Account suspended' });
        return;
      }

      if (customer.status === 'churned') {
        res.status(403).json({ error: 'Account is no longer active' });
        return;
      }

      // Parse license for seat information
      let parsedLicense;
      try {
        parsedLicense = parseLicenseKey(customer.licenseKey);
      } catch (parseError) {
        console.error('License parse error:', parseError);
        res.status(401).json({ error: 'Invalid license format' });
        return;
      }

      // Check if license is expired
      if (isLicenseExpired(parsedLicense)) {
        res.status(403).json({ error: 'License has expired' });
        return;
      }

      // Generate JWT token with machine ID and role
      const tokenPayload: CustomerSessionPayload = {
        type: 'customer',
        customerId: customer.id,
        licenseKey: customer.licenseKey,
        machineId: hashedMachineId,
        role: role as 'developer' | 'stakeholder' | 'admin',
        // Seat information
        developerSeats: customer.developerSeats,
        stakeholderSeats: customer.stakeholderSeats,
        activeDeveloperSeats: customer.activeDeveloperSeats,
        activeStakeholderSeats: customer.activeStakeholderSeats,
        seatLimitsEnforced: customer.seatLimitsEnforced,
      };

      const token = jwt.sign(tokenPayload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      res.json({
        success: true,
        token,
        customer: {
          id: customer.id,
          name: customer.name,
          company: customer.company,
          role: role,
          // Seat availability information
          developerSeats: customer.developerSeats,
          stakeholderSeats: customer.stakeholderSeats,
          activeDeveloperSeats: customer.activeDeveloperSeats,
          activeStakeholderSeats: customer.activeStakeholderSeats,
          seatLimitsEnforced: customer.seatLimitsEnforced,
          // Computed seat availability
          availableDeveloperSeats: customer.developerSeats === -1
            ? -1
            : customer.developerSeats - customer.activeDeveloperSeats,
          availableStakeholderSeats: customer.stakeholderSeats === -1
            ? -1
            : customer.stakeholderSeats - customer.activeStakeholderSeats,
        },
      });
    } catch (error) {
      console.error('MCP login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/auth/service-integrator/login
   * Service Integrator login with master license key
   */
  router.post('/service-integrator/login', async (req: Request, res: Response): Promise<void> => {
    try {
      const { masterLicenseKey } = req.body;

      if (!masterLicenseKey) {
        res.status(400).json({ error: 'Master license key is required' });
        return;
      }

      // Find service integrator by master license key
      const serviceIntegrator = await db.getServiceIntegrator(masterLicenseKey);
      if (!serviceIntegrator) {
        res.status(401).json({ error: 'Invalid master license key' });
        return;
      }

      // Check service integrator status
      if (serviceIntegrator.status === 'suspended') {
        res.status(403).json({ error: 'Account suspended' });
        return;
      }

      if (serviceIntegrator.status === 'churned') {
        res.status(403).json({ error: 'Account is no longer active' });
        return;
      }

      // Generate JWT token
      const tokenPayload: ServiceIntegratorSessionPayload = {
        type: 'service-integrator',
        serviceIntegratorId: serviceIntegrator.id,
        masterLicenseKey: serviceIntegrator.masterLicenseKey,
        company: serviceIntegrator.companyName,
      };

      const token = jwt.sign(tokenPayload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      res.json({
        success: true,
        token,
        serviceIntegrator: {
          id: serviceIntegrator.id,
          companyName: serviceIntegrator.companyName,
          contactEmail: serviceIntegrator.contactEmail,
          masterLicenseKey: serviceIntegrator.masterLicenseKey,
          status: serviceIntegrator.status,
          whiteLabelEnabled: serviceIntegrator.whiteLabelEnabled,
          createdAt: serviceIntegrator.createdAt,
        },
      });
    } catch (error) {
      console.error('Service integrator login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/auth/admin/session
   * Check admin session (from cookie)
   */
  router.get('/admin/session', async (req: Request, res: Response): Promise<void> => {
    try {
      const adminSessionCookie = req.cookies.admin_session;

      if (!adminSessionCookie) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const session: AdminSessionPayload = JSON.parse(adminSessionCookie);

      if (session.type !== 'admin') {
        res.status(401).json({ error: 'Invalid session' });
        return;
      }

      res.json({
        success: true,
        session: {
          type: 'admin',
          email: session.email,
        },
      });
    } catch (error) {
      console.error('Admin session check error:', error);
      res.status(401).json({ error: 'Invalid session' });
    }
  });

  /**
   * GET /api/auth/customer/session
   * Verify customer JWT token
   */
  router.get('/customer/session', async (req: Request, res: Response): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const token = authHeader.substring(7);

      // Verify JWT
      const decoded = jwt.verify(token, JWT_SECRET) as CustomerSessionPayload;

      if (decoded.type !== 'customer') {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      // Get customer data
      const customer = await db.getCustomerById(decoded.customerId);
      if (!customer) {
        res.status(401).json({ error: 'Customer not found' });
        return;
      }

      // Check status
      if (customer.status !== 'active') {
        res.status(403).json({ error: 'Account not active' });
        return;
      }

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
        },
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      console.error('Customer session check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/auth/service-integrator/session
   * Verify service integrator JWT token
   */
  router.get('/service-integrator/session', async (req: Request, res: Response): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const token = authHeader.substring(7);

      // Verify JWT
      const decoded = jwt.verify(token, JWT_SECRET) as ServiceIntegratorSessionPayload;

      if (decoded.type !== 'service-integrator') {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      // Get service integrator data
      const serviceIntegrator = await db.getServiceIntegratorById(decoded.serviceIntegratorId);
      if (!serviceIntegrator) {
        res.status(401).json({ error: 'Service integrator not found' });
        return;
      }

      // Check status
      if (serviceIntegrator.status !== 'active') {
        res.status(403).json({ error: 'Account not active' });
        return;
      }

      res.json({
        success: true,
        serviceIntegrator: {
          id: serviceIntegrator.id,
          companyName: serviceIntegrator.companyName,
          contactEmail: serviceIntegrator.contactEmail,
          masterLicenseKey: serviceIntegrator.masterLicenseKey,
          status: serviceIntegrator.status,
          whiteLabelEnabled: serviceIntegrator.whiteLabelEnabled,
          createdAt: serviceIntegrator.createdAt,
        },
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      console.error('Service integrator session check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/auth/admin/logout
   * Logout admin
   */
  router.post('/admin/logout', async (req: Request, res: Response): Promise<void> => {
    res.clearCookie('admin_session');
    res.json({ success: true });
  });

  /**
   * POST /api/auth/customer/logout
   * Logout customer (client-side token removal, this just confirms)
   */
  router.post('/customer/logout', async (req: Request, res: Response): Promise<void> => {
    res.json({ success: true });
  });

  /**
   * POST /api/auth/service-integrator/logout
   * Logout service integrator (client-side token removal, this just confirms)
   */
  router.post('/service-integrator/logout', async (req: Request, res: Response): Promise<void> => {
    res.json({ success: true });
  });

  return router;
}
