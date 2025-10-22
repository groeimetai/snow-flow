import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { LicenseDatabase } from '../database/schema.js';

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
   * Customer login with license key
   */
  router.post('/customer/login', async (req: Request, res: Response): Promise<void> => {
    try {
      const { licenseKey } = req.body;

      if (!licenseKey) {
        res.status(400).json({ error: 'License key is required' });
        return;
      }

      // Find customer by license key
      const customer = db.getCustomer(licenseKey);
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

      // Generate JWT token
      const tokenPayload: CustomerSessionPayload = {
        type: 'customer',
        customerId: customer.id,
        licenseKey: customer.licenseKey,
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
      console.error('Customer login error:', error);
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
      const customer = db.getCustomerById(decoded.customerId);
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

  return router;
}
