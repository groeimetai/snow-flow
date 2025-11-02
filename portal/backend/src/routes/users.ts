/**
 * User Management API Routes
 *
 * Protected endpoints for managing enterprise license users
 * Supports both customer and service integrator authentication
 *
 * Version: 2.0.0
 */

import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { LicenseDatabase } from '../database/schema.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface CustomerSessionPayload {
  type: 'customer';
  customerId: number;
  licenseKey: string;
  role?: 'developer' | 'stakeholder' | 'admin';
  machineId?: string;
}

interface ServiceIntegratorSessionPayload {
  type: 'service-integrator';
  serviceIntegratorId: number;
  masterLicenseKey: string;
  company: string;
}

type SessionPayload = CustomerSessionPayload | ServiceIntegratorSessionPayload;

export function createUserRoutes(db: LicenseDatabase): Router {
  var router = Router();

  /**
   * Middleware: Authenticate customer or service integrator
   * Attaches session info to request object
   */
  async function authenticateSession(req: Request, res: Response, next: NextFunction) {
    try {
      var authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: 'Missing authentication token'
        });
        return;
      }

      var token = authHeader.substring(7);

      // Verify JWT token
      var decoded = jwt.verify(token, JWT_SECRET) as SessionPayload;

      // Verify token type
      if (decoded.type !== 'customer' && decoded.type !== 'service-integrator') {
        res.status(401).json({
          success: false,
          error: 'Invalid token type'
        });
        return;
      }

      // Attach session to request
      (req as any).session = decoded;
      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          success: false,
          error: 'Invalid or expired token'
        });
        return;
      }
      console.error('Authentication error:', error);
      res.status(401).json({
        success: false,
        error: 'Authentication failed'
      });
    }
  }

  // Apply auth middleware to all routes
  router.use(authenticateSession);

  /**
   * GET /api/users
   * List users for authenticated customer or service integrator
   *
   * Query params:
   *   - status: active|inactive|suspended (optional)
   *   - role: developer|stakeholder|admin (optional)
   *   - limit: number (default: 100)
   *   - offset: number (default: 0)
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      var session = (req as any).session as SessionPayload;
      var status = req.query.status as 'active' | 'inactive' | 'suspended' | undefined;
      var role = req.query.role as 'developer' | 'stakeholder' | 'admin' | undefined;
      var limit = parseInt(req.query.limit as string) || 100;
      var offset = parseInt(req.query.offset as string) || 0;

      var users;
      if (session.type === 'customer') {
        users = await db.listUsers({
          customerId: session.customerId,
          status: status,
          role: role,
          limit: limit,
          offset: offset
        });
      } else {
        users = await db.listUsers({
          serviceIntegratorId: session.serviceIntegratorId,
          status: status,
          role: role,
          limit: limit,
          offset: offset
        });
      }

      res.json({
        success: true,
        count: users.length,
        users: users
      });
    } catch (error) {
      console.error('Error listing users:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list users'
      });
    }
  });

  /**
   * GET /api/users/with-connections
   * List users with their current connection status (enriched view)
   * Only available for customers (not SIs)
   */
  router.get('/with-connections', async (req: Request, res: Response) => {
    try {
      var session = (req as any).session as SessionPayload;

      if (session.type !== 'customer') {
        res.status(403).json({
          success: false,
          error: 'Only customers can view connection details'
        });
        return;
      }

      var users = await db.getUsersWithConnections(session.customerId);

      res.json({
        success: true,
        count: users.length,
        users: users
      });
    } catch (error) {
      console.error('Error listing users with connections:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list users'
      });
    }
  });

  /**
   * GET /api/users/:id
   * Get specific user details
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      var session = (req as any).session as SessionPayload;
      var userId = parseInt(req.params.id);

      var user = await db.getUserById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      // Verify user belongs to this customer/SI
      if (session.type === 'customer') {
        if (user.customerId !== session.customerId) {
          res.status(403).json({
            success: false,
            error: 'Access denied'
          });
          return;
        }
      } else {
        if (user.serviceIntegratorId !== session.serviceIntegratorId) {
          res.status(403).json({
            success: false,
            error: 'Access denied'
          });
          return;
        }
      }

      res.json({
        success: true,
        user: user
      });
    } catch (error) {
      console.error('Error getting user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user'
      });
    }
  });

  /**
   * PUT /api/users/:id
   * Update user details
   *
   * Body:
   *   - username: string (optional)
   *   - email: string (optional)
   *   - role: developer|stakeholder|admin (optional)
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      var session = (req as any).session as SessionPayload;
      var userId = parseInt(req.params.id);

      // Verify user exists and belongs to this customer/SI
      var existingUser = await db.getUserById(userId);
      if (!existingUser) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      if (session.type === 'customer') {
        if (existingUser.customerId !== session.customerId) {
          res.status(403).json({
            success: false,
            error: 'Access denied'
          });
          return;
        }
      } else {
        if (existingUser.serviceIntegratorId !== session.serviceIntegratorId) {
          res.status(403).json({
            success: false,
            error: 'Access denied'
          });
          return;
        }
      }

      var { username, email, role } = req.body;

      var updates: any = {};
      if (username !== undefined) updates.username = username;
      if (email !== undefined) updates.email = email;
      if (role !== undefined) {
        if (!['developer', 'stakeholder', 'admin'].includes(role)) {
          res.status(400).json({
            success: false,
            error: 'Invalid role'
          });
          return;
        }
        updates.role = role;
      }

      var user = await db.updateUser(userId, updates);

      // Log activity if role changed
      if (role && role !== existingUser.role) {
        await db.logUserActivity({
          userId: userId,
          activityType: 'role_change',
          oldValue: existingUser.role,
          newValue: role,
          performedBy: session.type === 'customer'
            ? 'customer#' + session.customerId.toString()
            : 'si#' + session.serviceIntegratorId.toString(),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      }

      res.json({
        success: true,
        user: user
      });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update user'
      });
    }
  });

  /**
   * PUT /api/users/:id/status
   * Update user status (activate/deactivate/suspend)
   *
   * Body:
   *   - status: active|inactive|suspended
   *   - notes: string (optional)
   */
  router.put('/:id/status', async (req: Request, res: Response) => {
    try {
      var session = (req as any).session as SessionPayload;
      var userId = parseInt(req.params.id);
      var { status, notes } = req.body;

      if (!status || !['active', 'inactive', 'suspended'].includes(status)) {
        res.status(400).json({
          success: false,
          error: 'Invalid status (must be active, inactive, or suspended)'
        });
        return;
      }

      // Verify user exists and belongs to this customer/SI
      var existingUser = await db.getUserById(userId);
      if (!existingUser) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      if (session.type === 'customer') {
        if (existingUser.customerId !== session.customerId) {
          res.status(403).json({
            success: false,
            error: 'Access denied'
          });
          return;
        }
      } else {
        if (existingUser.serviceIntegratorId !== session.serviceIntegratorId) {
          res.status(403).json({
            success: false,
            error: 'Access denied'
          });
          return;
        }
      }

      var performedBy = session.type === 'customer'
        ? 'customer#' + session.customerId.toString()
        : 'si#' + session.serviceIntegratorId.toString();

      var user = await db.setUserStatus(userId, status, performedBy, notes);

      res.json({
        success: true,
        user: user
      });
    } catch (error) {
      console.error('Error updating user status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update user status'
      });
    }
  });

  /**
   * GET /api/users/:id/activity
   * Get user activity log
   *
   * Query params:
   *   - limit: number (default: 100)
   *   - type: login|logout|status_change|role_change (optional)
   */
  router.get('/:id/activity', async (req: Request, res: Response) => {
    try {
      var session = (req as any).session as SessionPayload;
      var userId = parseInt(req.params.id);
      var limit = parseInt(req.query.limit as string) || 100;
      var activityType = req.query.type as any;

      // Verify user exists and belongs to this customer/SI
      var user = await db.getUserById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      if (session.type === 'customer') {
        if (user.customerId !== session.customerId) {
          res.status(403).json({
            success: false,
            error: 'Access denied'
          });
          return;
        }
      } else {
        if (user.serviceIntegratorId !== session.serviceIntegratorId) {
          res.status(403).json({
            success: false,
            error: 'Access denied'
          });
          return;
        }
      }

      var activity = await db.getUserActivity(userId, limit, activityType);

      res.json({
        success: true,
        count: activity.length,
        activity: activity
      });
    } catch (error) {
      console.error('Error getting user activity:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user activity'
      });
    }
  });

  /**
   * DELETE /api/users/:id
   * Delete user (soft delete - sets status to inactive)
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      var session = (req as any).session as SessionPayload;
      var userId = parseInt(req.params.id);

      // Verify user exists and belongs to this customer/SI
      var user = await db.getUserById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      if (session.type === 'customer') {
        if (user.customerId !== session.customerId) {
          res.status(403).json({
            success: false,
            error: 'Access denied'
          });
          return;
        }
      } else {
        if (user.serviceIntegratorId !== session.serviceIntegratorId) {
          res.status(403).json({
            success: false,
            error: 'Access denied'
          });
          return;
        }
      }

      var performedBy = session.type === 'customer'
        ? 'customer#' + session.customerId.toString()
        : 'si#' + session.serviceIntegratorId.toString();

      // Soft delete: set status to inactive
      await db.setUserStatus(userId, 'inactive', performedBy, 'User deleted via API');

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete user'
      });
    }
  });

  return router;
}
