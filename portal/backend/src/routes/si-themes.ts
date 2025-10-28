/**
 * Service Integrator Theme Management API Routes
 *
 * Allows Service Integrators to create, manage, and assign custom themes
 * to their customers for branded SnowCode CLI experiences.
 */

import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { LicenseDatabase } from '../database/schema.js';
import winston from 'winston';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface ServiceIntegratorSessionPayload {
  type: 'service-integrator';
  serviceIntegratorId: number;
  masterLicenseKey: string;
  company: string;
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export function createSIThemesRoutes(db: LicenseDatabase): Router {
  const router = Router();

  /**
   * Middleware: Authenticate service integrator via JWT
   */
  async function authenticateSI(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Missing authentication token'
        });
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as ServiceIntegratorSessionPayload;

      if (decoded.type !== 'service-integrator') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token type'
        });
      }

      const si = await db.getServiceIntegratorById(decoded.serviceIntegratorId);
      if (!si || si.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: 'Account is not active'
        });
      }

      (req as any).serviceIntegratorId = decoded.serviceIntegratorId;
      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token'
        });
      }
      logger.error('SI authentication error:', error);
      res.status(401).json({
        success: false,
        error: 'Authentication failed'
      });
    }
  }

  router.use(authenticateSI);

  /**
   * GET /api/service-integrator/themes
   * List all custom themes for this SI
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const siId = (req as any).serviceIntegratorId;
      const activeOnly = req.query.active === 'true';

      const themes = await db.listSIThemes(siId, activeOnly);

      logger.info({
        action: 'list_themes',
        siId,
        count: themes.length
      });

      res.json({
        success: true,
        count: themes.length,
        themes: themes
      });
    } catch (error) {
      logger.error('List themes error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list themes'
      });
    }
  });

  /**
   * GET /api/service-integrator/themes/:id
   * Get specific theme details
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const siId = (req as any).serviceIntegratorId;
      const themeId = parseInt(req.params.id);

      const theme = await db.getSITheme(themeId);

      if (!theme) {
        return res.status(404).json({
          success: false,
          error: 'Theme not found'
        });
      }

      // Verify theme belongs to this SI
      if (theme.serviceIntegratorId !== siId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Get usage stats
      const stats = await db.getThemeUsageStats(themeId);

      res.json({
        success: true,
        theme: theme,
        usage: stats
      });
    } catch (error) {
      logger.error('Get theme error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get theme'
      });
    }
  });

  /**
   * POST /api/service-integrator/themes
   * Create new custom theme
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const siId = (req as any).serviceIntegratorId;
      const {
        themeName,
        displayName,
        description,
        themeConfig,
        primaryColor,
        secondaryColor,
        accentColor,
        isDefault
      } = req.body;

      // Validation
      if (!themeName || !displayName || !themeConfig || !primaryColor) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: themeName, displayName, themeConfig, primaryColor'
        });
      }

      // Validate theme name format (alphanumeric, hyphens, underscores only)
      if (!/^[a-z0-9_-]+$/.test(themeName)) {
        return res.status(400).json({
          success: false,
          error: 'Theme name must contain only lowercase letters, numbers, hyphens, and underscores'
        });
      }

      // Validate color format
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      if (!hexColorRegex.test(primaryColor)) {
        return res.status(400).json({
          success: false,
          error: 'Primary color must be a valid hex color (e.g., #0070AD)'
        });
      }

      // Check if theme name already exists for this SI
      const existing = await db.getSIThemeByName(siId, themeName);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: `Theme '${themeName}' already exists`
        });
      }

      // Create theme
      const theme = await db.createSITheme({
        serviceIntegratorId: siId,
        themeName,
        displayName,
        description,
        themeConfig,
        primaryColor,
        secondaryColor,
        accentColor,
        isActive: true,
        isDefault: isDefault || false
      });

      // If this is set as default, update the SI's default theme
      if (isDefault) {
        await db.setSIDefaultTheme(siId, theme.id);
      }

      logger.info({
        action: 'create_theme',
        siId,
        themeId: theme.id,
        themeName
      });

      res.status(201).json({
        success: true,
        theme: theme
      });
    } catch (error) {
      logger.error('Create theme error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create theme'
      });
    }
  });

  /**
   * PUT /api/service-integrator/themes/:id
   * Update existing theme
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const siId = (req as any).serviceIntegratorId;
      const themeId = parseInt(req.params.id);

      // Verify theme exists and belongs to this SI
      const existing = await db.getSITheme(themeId);
      if (!existing || existing.serviceIntegratorId !== siId) {
        return res.status(404).json({
          success: false,
          error: 'Theme not found'
        });
      }

      const {
        displayName,
        description,
        themeConfig,
        primaryColor,
        secondaryColor,
        accentColor,
        isActive,
        isDefault
      } = req.body;

      const updates: any = {};
      if (displayName !== undefined) updates.displayName = displayName;
      if (description !== undefined) updates.description = description;
      if (themeConfig !== undefined) updates.themeConfig = themeConfig;
      if (primaryColor !== undefined) {
        // Validate hex color
        const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
        if (!hexColorRegex.test(primaryColor)) {
          return res.status(400).json({
            success: false,
            error: 'Primary color must be a valid hex color (e.g., #0070AD)'
          });
        }
        updates.primaryColor = primaryColor;
      }
      if (secondaryColor !== undefined) updates.secondaryColor = secondaryColor;
      if (accentColor !== undefined) updates.accentColor = accentColor;
      if (isActive !== undefined) updates.isActive = isActive;
      if (isDefault !== undefined) updates.isDefault = isDefault;

      await db.updateSITheme(themeId, updates);

      // If setting as default, update SI default theme
      if (isDefault) {
        await db.setSIDefaultTheme(siId, themeId);
      }

      const updated = await db.getSITheme(themeId);

      logger.info({
        action: 'update_theme',
        siId,
        themeId,
        changes: Object.keys(updates)
      });

      res.json({
        success: true,
        theme: updated
      });
    } catch (error) {
      logger.error('Update theme error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update theme'
      });
    }
  });

  /**
   * DELETE /api/service-integrator/themes/:id
   * Delete custom theme
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const siId = (req as any).serviceIntegratorId;
      const themeId = parseInt(req.params.id);

      // Verify theme exists and belongs to this SI
      const existing = await db.getSITheme(themeId);
      if (!existing || existing.serviceIntegratorId !== siId) {
        return res.status(404).json({
          success: false,
          error: 'Theme not found'
        });
      }

      // Check if theme is in use by any customers
      const stats = await db.getThemeUsageStats(themeId);
      if (stats.activeCustomers > 0) {
        return res.status(409).json({
          success: false,
          error: `Cannot delete theme: ${stats.activeCustomers} customer(s) are currently using it`,
          activeCustomers: stats.activeCustomers
        });
      }

      await db.deleteSITheme(themeId);

      logger.info({
        action: 'delete_theme',
        siId,
        themeId
      });

      res.json({
        success: true,
        message: 'Theme deleted successfully'
      });
    } catch (error) {
      logger.error('Delete theme error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete theme'
      });
    }
  });

  /**
   * POST /api/service-integrator/themes/:id/set-default
   * Set theme as default for new customers
   */
  router.post('/:id/set-default', async (req: Request, res: Response) => {
    try {
      const siId = (req as any).serviceIntegratorId;
      const themeId = parseInt(req.params.id);

      // Verify theme exists and belongs to this SI
      const existing = await db.getSITheme(themeId);
      if (!existing || existing.serviceIntegratorId !== siId) {
        return res.status(404).json({
          success: false,
          error: 'Theme not found'
        });
      }

      await db.setSIDefaultTheme(siId, themeId);

      logger.info({
        action: 'set_default_theme',
        siId,
        themeId
      });

      res.json({
        success: true,
        message: 'Default theme updated'
      });
    } catch (error) {
      logger.error('Set default theme error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to set default theme'
      });
    }
  });

  /**
   * POST /api/service-integrator/themes/:id/assign-customer
   * Assign theme to a customer
   */
  router.post('/:id/assign-customer', async (req: Request, res: Response) => {
    try {
      const siId = (req as any).serviceIntegratorId;
      const themeId = parseInt(req.params.id);
      const { customerId } = req.body;

      if (!customerId) {
        return res.status(400).json({
          success: false,
          error: 'customerId is required'
        });
      }

      // Verify theme exists and belongs to this SI
      const theme = await db.getSITheme(themeId);
      if (!theme || theme.serviceIntegratorId !== siId) {
        return res.status(404).json({
          success: false,
          error: 'Theme not found'
        });
      }

      // Verify customer exists and belongs to this SI
      const customer = await db.getCustomerById(customerId);
      if (!customer || customer.serviceIntegratorId !== siId) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      // Update customer with theme
      await db.updateCustomer(customerId, {
        theme: theme.themeName
      });

      // Execute direct SQL to also set custom_theme_id (for tracking)
      await db.pool.execute(
        'UPDATE customers SET custom_theme_id = ? WHERE id = ?',
        [themeId, customerId]
      );

      // Log theme usage
      await db.logThemeUsage(customerId, themeId, 'assigned');

      logger.info({
        action: 'assign_theme_to_customer',
        siId,
        themeId,
        customerId
      });

      res.json({
        success: true,
        message: `Theme '${theme.displayName}' assigned to customer`
      });
    } catch (error) {
      logger.error('Assign theme error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to assign theme to customer'
      });
    }
  });

  /**
   * GET /api/service-integrator/themes/:id/usage
   * Get usage statistics for theme
   */
  router.get('/:id/usage', async (req: Request, res: Response) => {
    try {
      const siId = (req as any).serviceIntegratorId;
      const themeId = parseInt(req.params.id);
      const days = parseInt(req.query.days as string) || 30;

      // Verify theme exists and belongs to this SI
      const theme = await db.getSITheme(themeId);
      if (!theme || theme.serviceIntegratorId !== siId) {
        return res.status(404).json({
          success: false,
          error: 'Theme not found'
        });
      }

      const stats = await db.getThemeUsageStats(themeId, days);

      res.json({
        success: true,
        theme: {
          id: theme.id,
          name: theme.displayName
        },
        period: {
          days,
          from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
          to: new Date().toISOString()
        },
        stats
      });
    } catch (error) {
      logger.error('Get theme usage error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get theme usage stats'
      });
    }
  });

  return router;
}
