/**
 * SSO Authentication Middleware
 *
 * JWT token validation and session management for SSO-authenticated users.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { LicenseDatabase } from '../database/schema.js';

// JWT secret key (should be in environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'snow-flow-enterprise-sso-secret-change-in-production';
const JWT_EXPIRATION = '8h'; // 8 hour sessions

export interface SsoJwtPayload {
  customerId: number;
  userId: string;
  email: string;
  displayName?: string;
  nameId?: string;
  sessionIndex?: string;
  attributes?: Record<string, any>;
}

/**
 * Generate JWT token for SSO session
 */
export function generateSsoToken(payload: SsoJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRATION,
    issuer: 'snow-flow-enterprise',
    audience: 'license-server'
  });
}

/**
 * Verify JWT token
 */
export function verifySsoToken(token: string): SsoJwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'snow-flow-enterprise',
      audience: 'license-server'
    }) as SsoJwtPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Middleware to require SSO authentication
 */
export function requireSsoAuth(db: LicenseDatabase) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get token from Authorization header or cookie
      let token: string | undefined;

      // Check Authorization header first
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }

      // Fallback to cookie
      if (!token && req.cookies && req.cookies['sso_token']) {
        token = req.cookies['sso_token'];
      }

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'No SSO token provided - please authenticate via SSO'
        });
      }

      // Verify JWT token
      const payload = verifySsoToken(token);
      if (!payload) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired SSO token'
        });
      }

      // Check session exists in database
      const session = await db.getSsoSession(token);
      if (!session) {
        return res.status(401).json({
          success: false,
          error: 'SSO session not found - please re-authenticate'
        });
      }

      // Check session not expired
      if (session.expiresAt < Date.now()) {
        // Clean up expired session
        db.deleteSsoSession(token);
        return res.status(401).json({
          success: false,
          error: 'SSO session expired - please re-authenticate'
        });
      }

      // Update last activity
      db.updateSessionActivity(token);

      // Get customer
      const customer = await db.getCustomerById(payload.customerId);
      if (!customer) {
        return res.status(403).json({
          success: false,
          error: 'Customer not found'
        });
      }

      if (customer.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: `Customer status: ${customer.status}`
        });
      }

      // Attach to request for downstream use
      (req as any).ssoSession = session;
      (req as any).customer = customer;
      (req as any).ssoUser = {
        customerId: payload.customerId,
        userId: payload.userId,
        email: payload.email,
        displayName: payload.displayName,
        attributes: payload.attributes
      };

      next();
    } catch (error) {
      console.error('SSO authentication error:', error);
      res.status(500).json({
        success: false,
        error: 'SSO authentication failed'
      });
    }
  };
}

/**
 * Optional SSO authentication (doesn't block request if not authenticated)
 */
export function optionalSsoAuth(db: LicenseDatabase) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get token
      let token: string | undefined;

      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }

      if (!token && req.cookies && req.cookies['sso_token']) {
        token = req.cookies['sso_token'];
      }

      // If no token, just continue without SSO
      if (!token) {
        return next();
      }

      // Verify and attach if valid
      const payload = verifySsoToken(token);
      if (payload) {
        const session = await db.getSsoSession(token);
        if (session && session.expiresAt > Date.now()) {
          db.updateSessionActivity(token);
          const customer = await db.getCustomerById(payload.customerId);

          (req as any).ssoSession = session;
          (req as any).customer = customer;
          (req as any).ssoUser = {
            customerId: payload.customerId,
            userId: payload.userId,
            email: payload.email,
            displayName: payload.displayName,
            attributes: payload.attributes
          };
        }
      }

      next();
    } catch (error) {
      // Don't block on errors for optional auth
      next();
    }
  };
}
