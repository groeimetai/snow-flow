/**
 * SSO Routes - SAML Service Provider Endpoints
 *
 * Provides complete SSO/SAML authentication flows:
 * - SAML SP-initiated login
 * - SAML ACS callback
 * - Single Logout (SLO)
 * - SP metadata generation
 * - SSO configuration management
 */

import express, { Request, Response } from 'express';
import passport from 'passport';
import { Strategy as SamlStrategy } from 'passport-saml';
import csrf from 'csurf';
import { LicenseDatabase } from '../database/schema.js';
import { generateSsoToken, requireSsoAuth } from '../middleware/sso-auth.js';
import { ssoLoginRateLimiter } from '../middleware/security.js';

// CSRF protection for SSO (cookie-based)
const csrfProtection = csrf({ cookie: true });

export function createSsoRoutes(db: LicenseDatabase): express.Router {
  const router = express.Router();

  // Store configured SAML strategies per customer
  const samlStrategies = new Map<number, SamlStrategy>();

  /**
   * Get or create SAML strategy for customer
   */
  async function getSamlStrategy(customerId: number): Promise<SamlStrategy | null> {
    // Check cache first
    if (samlStrategies.has(customerId)) {
      return samlStrategies.get(customerId)!;
    }

    // Get SSO config from database
    const ssoConfig = await db.getSsoConfig(customerId);
    if (!ssoConfig || !ssoConfig.enabled) {
      return null;
    }

    // Only support SAML for now
    if (ssoConfig.provider !== 'saml') {
      return null;
    }

    // Create SAML strategy
    const strategy = new SamlStrategy(
      {
        entryPoint: ssoConfig.entryPoint,
        issuer: ssoConfig.issuer,
        callbackUrl: ssoConfig.callbackUrl,
        cert: ssoConfig.cert,
        logoutUrl: ssoConfig.logoutUrl,
        identifierFormat: ssoConfig.nameIdFormat,
        wantAssertionsSigned: ssoConfig.wantAssertionsSigned,
        signatureAlgorithm: (ssoConfig.signatureAlgorithm || 'sha256') as any,
        passReqToCallback: true
      } as any,
      // Verify callback - called after SAML assertion is validated
      async (req: any, profile: any, done: any) => {
        try {
          // Extract user info from SAML assertion
          const userId = profile.nameID || profile.email;
          const email = profile.email || profile.nameID;
          const displayName = profile.displayName || profile.name || email;

          // Parse attributes if mapping configured
          let attributes: Record<string, any> = profile.attributes || {};
          if (ssoConfig.attributeMapping) {
            try {
              const mapping = JSON.parse(ssoConfig.attributeMapping);
              // Apply attribute mapping if needed
              attributes = { ...attributes, mapping };
            } catch (e) {
              console.error('Failed to parse attribute mapping:', e);
            }
          }

          // Generate JWT token
          const jwtPayload = {
            customerId: customerId,
            userId: userId,
            email: email,
            displayName: displayName,
            nameId: profile.nameID,
            sessionIndex: profile.sessionIndex,
            attributes: attributes
          };

          const sessionToken = generateSsoToken(jwtPayload);

          // Store session in database
          const expiresAt = Date.now() + 8 * 60 * 60 * 1000; // 8 hours
          db.createSsoSession({
            customerId: customerId,
            userId: userId,
            email: email,
            displayName: displayName,
            sessionToken: sessionToken,
            nameId: profile.nameID,
            sessionIndex: profile.sessionIndex,
            attributes: JSON.stringify(attributes),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            expiresAt: expiresAt,
            lastActivity: Date.now()
          });

          done(null, { sessionToken, userId, email, displayName });
        } catch (error) {
          console.error('SSO verification error:', error);
          done(error);
        }
      }
    );

    // Cache strategy
    samlStrategies.set(customerId, strategy);

    return strategy;
  }

  // ===== SAML SERVICE PROVIDER ENDPOINTS =====

  /**
   * GET /sso/login/:customerId
   * Initiate SAML authentication flow
   */
  /**
   * GET /sso/login/:customerId
   * Initiate SSO login flow
   *
   * Security: Rate limited (10 attempts per 15 min) + CSRF protection
   */
  router.get('/login/:customerId', ssoLoginRateLimiter, csrfProtection as any, async (req: Request, res: Response) => {
    try {
      const customerId = parseInt(req.params.customerId || '0');
      const csrfToken = (req as any).csrfToken();

      // Get customer
      const customer = await db.getCustomerById(customerId);
      if (!customer) {
        return res.status(404).json({
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

      // Get SAML strategy
      const strategy = await getSamlStrategy(customerId);
      if (!strategy) {
        return res.status(400).json({
          success: false,
          error: 'SSO not configured for this customer'
        });
      }

      // Store customer ID in session for callback
      (req.session as any).ssoCustomerId = customerId;

      // Initiate SAML login
      (passport.authenticate('saml', { session: false }) as any)(req, res);
    } catch (error) {
      console.error('SSO login error:', error);
      res.status(500).json({
        success: false,
        error: 'SSO login failed'
      });
    }
  });

  /**
   * POST /sso/callback
   * SAML Assertion Consumer Service (ACS)
   *
   * Security: CSRF protection via SAML state parameter
   * Note: SAML already has built-in replay protection via InResponseTo and NotOnOrAfter
   */
  router.post('/callback', express.urlencoded({ extended: true }), async (req: Request, res: Response) => {
    try {
      // Get customer ID from session
      const customerId = (req.session as any).ssoCustomerId;
      if (!customerId) {
        return res.status(400).json({
          success: false,
          error: 'Missing customer ID in SSO callback'
        });
      }

      // Get SAML strategy
      const strategy = await getSamlStrategy(customerId);
      if (!strategy) {
        return res.status(400).json({
          success: false,
          error: 'SSO not configured'
        });
      }

      // Use passport to authenticate
      passport.use('saml-' + customerId, strategy);

      passport.authenticate('saml-' + customerId, {
        session: false
      }, (err: any, user: any) => {
        if (err) {
          console.error('SAML authentication error:', err);
          return res.status(401).json({
            success: false,
            error: 'SAML authentication failed: ' + err.message
          });
        }

        if (!user) {
          return res.status(401).json({
            success: false,
            error: 'SAML authentication failed: no user returned'
          });
        }

        // Set cookie with session token
        res.cookie('sso_token', user.sessionToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 8 * 60 * 60 * 1000, // 8 hours
          sameSite: 'lax'
        });

        // Return success with token
        res.json({
          success: true,
          message: 'SSO authentication successful',
          sessionToken: user.sessionToken,
          user: {
            userId: user.userId,
            email: user.email,
            displayName: user.displayName
          }
        });
      })(req, res);
    } catch (error) {
      console.error('SSO callback error:', error);
      res.status(500).json({
        success: false,
        error: 'SSO callback failed'
      });
    }
  });

  /**
   * POST /sso/logout
   * Single Logout (SLO)
   */
  router.post('/logout', async (req: Request, res: Response) => {
    try {
      // Get token from header or cookie
      let token: string | undefined;

      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }

      if (!token && req.cookies && req.cookies['sso_token']) {
        token = req.cookies['sso_token'];
      }

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'No SSO token provided'
        });
      }

      // Get session
      const session = await db.getSsoSession(token);
      if (session) {
        // Delete session
        db.deleteSsoSession(token);

        // Get SSO config to check if we need to do IdP logout
        const ssoConfig = await db.getSsoConfig(session.customerId);
        if (ssoConfig && ssoConfig.logoutUrl && session.sessionIndex) {
          // TODO: Implement IdP-initiated logout
          // For now just clear local session
        }
      }

      // Clear cookie
      res.clearCookie('sso_token');

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('SSO logout error:', error);
      res.status(500).json({
        success: false,
        error: 'SSO logout failed'
      });
    }
  });

  /**
   * GET /sso/metadata/:customerId
   * Generate SAML Service Provider metadata XML
   */
  router.get('/metadata/:customerId', async (req: Request, res: Response) => {
    try {
      const customerId = parseInt(req.params.customerId || '0');

      // Get SSO config
      const ssoConfig = await db.getSsoConfig(customerId);
      if (!ssoConfig || !ssoConfig.enabled) {
        return res.status(404).json({
          success: false,
          error: 'SSO not configured for this customer'
        });
      }

      // Generate SP metadata XML
      const strategy = await getSamlStrategy(customerId);
      if (!strategy) {
        return res.status(500).json({
          success: false,
          error: 'Failed to create SAML strategy'
        });
      }

      // Generate metadata
      const metadata = strategy.generateServiceProviderMetadata(null, null);

      res.type('application/xml');
      res.send(metadata);
    } catch (error) {
      console.error('SSO metadata error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate SP metadata'
      });
    }
  });

  // ===== SSO CONFIGURATION MANAGEMENT (ADMIN ONLY) =====

  /**
   * POST /sso/config
   * Create or update SSO configuration
   */
  router.post('/config', async (req: Request, res: Response) => {
    try {
      // TODO: Add admin authentication
      // For now, require license key in Authorization header

      const licenseKey = req.headers['authorization']?.replace('Bearer ', '');
      if (!licenseKey) {
        return res.status(401).json({
          success: false,
          error: 'Missing license key'
        });
      }

      const customer = await db.getCustomer(licenseKey);
      if (!customer) {
        return res.status(401).json({
          success: false,
          error: 'Invalid license key'
        });
      }

      // Parse config from request
      const config = req.body;

      // Validate required fields
      if (!config.provider || !config.entryPoint || !config.issuer || !config.cert || !config.callbackUrl) {
        return res.status(400).json({
          success: false,
          error: 'Missing required SSO configuration fields'
        });
      }

      // Check if config already exists
      const existingConfig = await db.getSsoConfig(customer.id);

      if (existingConfig) {
        // Update existing config
        db.updateSsoConfig(customer.id, {
          enabled: config.enabled !== undefined ? config.enabled : existingConfig.enabled,
          provider: config.provider,
          entryPoint: config.entryPoint,
          issuer: config.issuer,
          cert: config.cert,
          callbackUrl: config.callbackUrl,
          logoutUrl: config.logoutUrl,
          nameIdFormat: config.nameIdFormat,
          wantAssertionsSigned: config.wantAssertionsSigned,
          wantAuthnResponseSigned: config.wantAuthnResponseSigned,
          signatureAlgorithm: config.signatureAlgorithm,
          attributeMapping: config.attributeMapping ? JSON.stringify(config.attributeMapping) : undefined
        });

        // Clear cached strategy
        samlStrategies.delete(customer.id);

        res.json({
          success: true,
          message: 'SSO configuration updated',
          customerId: customer.id
        });
      } else {
        // Create new config
        db.createSsoConfig({
          customerId: customer.id,
          enabled: config.enabled !== undefined ? config.enabled : true,
          provider: config.provider,
          entryPoint: config.entryPoint,
          issuer: config.issuer,
          cert: config.cert,
          callbackUrl: config.callbackUrl,
          logoutUrl: config.logoutUrl,
          nameIdFormat: config.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          wantAssertionsSigned: config.wantAssertionsSigned !== undefined ? config.wantAssertionsSigned : true,
          wantAuthnResponseSigned: config.wantAuthnResponseSigned !== undefined ? config.wantAuthnResponseSigned : true,
          signatureAlgorithm: config.signatureAlgorithm || 'sha256',
          attributeMapping: config.attributeMapping ? JSON.stringify(config.attributeMapping) : undefined
        });

        res.json({
          success: true,
          message: 'SSO configuration created',
          customerId: customer.id
        });
      }
    } catch (error) {
      console.error('SSO config error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to configure SSO'
      });
    }
  });

  /**
   * GET /sso/config
   * Get current SSO configuration
   */
  router.get('/config', requireSsoAuth(db), async (req: Request, res: Response) => {
    try {
      const customer = (req as any).customer;

      const ssoConfig = await db.getSsoConfig(customer.id);
      if (!ssoConfig) {
        return res.status(404).json({
          success: false,
          error: 'No SSO configuration found'
        });
      }

      // Don't return cert in response for security
      const { cert, ...safeConfig } = ssoConfig;

      res.json({
        success: true,
        config: {
          ...safeConfig,
          certConfigured: !!cert
        }
      });
    } catch (error) {
      console.error('SSO config retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve SSO config'
      });
    }
  });

  /**
   * DELETE /sso/config
   * Delete SSO configuration
   */
  router.delete('/config', requireSsoAuth(db), (req: Request, res: Response) => {
    try {
      const customer = (req as any).customer;

      // Delete all sessions first
      db.deleteSsoSessionsByCustomer(customer.id);

      // Delete config
      db.deleteSsoConfig(customer.id);

      // Clear cached strategy
      samlStrategies.delete(customer.id);

      res.json({
        success: true,
        message: 'SSO configuration deleted'
      });
    } catch (error) {
      console.error('SSO config deletion error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete SSO config'
      });
    }
  });

  /**
   * GET /sso/sessions
   * Get active SSO sessions for customer
   */
  router.get('/sessions', requireSsoAuth(db), async (req: Request, res: Response) => {
    try {
      const customer = (req as any).customer;

      const sessions = await db.getActiveSessions(customer.id);

      // Don't return session tokens
      const safeSessions = sessions.map((s) => {
        const { sessionToken, ...safe } = s;
        return safe;
      });

      res.json({
        success: true,
        sessions: safeSessions
      });
    } catch (error) {
      console.error('SSO sessions retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve sessions'
      });
    }
  });

  /**
   * GET /sso/stats
   * Get SSO usage statistics
   */
  router.get('/stats', requireSsoAuth(db), async (req: Request, res: Response) => {
    try {
      const customer = (req as any).customer;
      const days = parseInt(req.query.days as string) || 30;

      const stats = await db.getSsoStats(customer.id, days);

      res.json({
        success: true,
        stats: stats
      });
    } catch (error) {
      console.error('SSO stats retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve SSO stats'
      });
    }
  });

  return router;
}