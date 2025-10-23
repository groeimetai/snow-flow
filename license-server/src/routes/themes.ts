/**
 * Themes API Routes
 *
 * Provides enterprise theme management for Snow-Flow customers.
 * Allows customers to retrieve their assigned theme and admins to manage themes.
 *
 * Themes provide branded CLI/OpenCode experiences with company colors.
 */

import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LicenseDatabase } from '../database/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createThemesRoutes(db: LicenseDatabase): express.Router {
  const router = express.Router();

  // Helper to get themes directory (works in dev and production)
  function getThemesDir(): string {
    // Try dist/themes first (production)
    const distThemes = path.join(__dirname, '../themes');
    if (fs.existsSync(distThemes)) {
      return distThemes;
    }
    // Fallback to src/themes (should work in both dev and production)
    const srcThemes = path.join(__dirname, '../../src/themes');
    if (fs.existsSync(srcThemes)) {
      return srcThemes;
    }
    // Last resort - relative to project root
    return path.join(process.cwd(), 'src/themes');
  }

  /**
   * GET /themes/list
   * List all available themes
   *
   * Response:
   * {
   *   "success": true,
   *   "themes": [
   *     { "name": "capgemini", "displayName": "Capgemini", "primaryColor": "#0070AD" },
   *     { "name": "ey", "displayName": "EY", "primaryColor": "#FFE600" }
   *   ]
   * }
   */
  router.get('/list', (req: Request, res: Response) => {
    try {
      const themesDir = getThemesDir();
      const themeFiles = fs.readdirSync(themesDir).filter(f => f.endsWith('.json'));

      const themes = themeFiles.map(filename => {
        const themePath = path.join(themesDir, filename);
        const themeData = JSON.parse(fs.readFileSync(themePath, 'utf-8'));
        const themeName = filename.replace('.json', '');

        return {
          name: themeName,
          displayName: themeData.name || themeName,
          description: themeData.description || `${themeName} theme`,
          primaryColor: themeData.colors?.primary || '#000000',
          available: true
        };
      });

      res.json({
        success: true,
        themes: themes
      });
    } catch (error) {
      console.error('Error listing themes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list themes'
      });
    }
  });

  /**
   * GET /themes/:themeName
   * Get specific theme configuration
   *
   * Authentication: License key required
   *
   * Response: Full OpenCode theme JSON
   */
  router.get('/:themeName', async (req: Request, res: Response) => {
    try {
      const { themeName } = req.params;

      // Validate theme name (prevent path traversal)
      if (!themeName || !/^[a-z0-9_-]+$/.test(themeName)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid theme name'
        });
      }

      const themePath = path.join(getThemesDir(), `${themeName}.json`);

      // Check if theme exists
      if (!fs.existsSync(themePath)) {
        return res.status(404).json({
          success: false,
          error: 'Theme not found'
        });
      }

      // Read and return theme
      const themeData = JSON.parse(fs.readFileSync(themePath, 'utf-8'));

      res.json({
        success: true,
        theme: themeData
      });
    } catch (error) {
      console.error('Error getting theme:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get theme'
      });
    }
  });

  /**
   * GET /themes/customer/current
   * Get current customer's assigned theme
   *
   * Authentication: License key required
   *
   * Response:
   * {
   *   "success": true,
   *   "theme": "capgemini",
   *   "themeConfig": { ... full theme JSON ... }
   * }
   */
  router.get('/customer/current', async (req: Request, res: Response) => {
    try {
      // Get license key from Authorization header
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Missing or invalid authorization header'
        });
      }

      const licenseKey = authHeader.substring(7);

      // Get customer
      const customer = db.getCustomer(licenseKey);
      if (!customer) {
        return res.status(401).json({
          success: false,
          error: 'Invalid license key'
        });
      }

      if (customer.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: `Customer status: ${customer.status}`
        });
      }

      // Get customer's theme (default to 'servicenow' if not set)
      const themeName = customer.theme || 'servicenow';
      const themePath = path.join(getThemesDir(), `${themeName}.json`);

      // Check if theme exists
      if (!fs.existsSync(themePath)) {
        return res.status(404).json({
          success: false,
          error: 'Customer theme not found',
          themeName: themeName
        });
      }

      // Read theme
      const themeData = JSON.parse(fs.readFileSync(themePath, 'utf-8'));

      res.json({
        success: true,
        theme: themeName,
        themeConfig: themeData,
        customer: {
          name: customer.name,
          company: customer.company
        }
      });
    } catch (error) {
      console.error('Error getting customer theme:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get customer theme'
      });
    }
  });

  /**
   * POST /themes/customer/:customerId/assign
   * Assign theme to customer (Admin only)
   *
   * Authentication: Admin key required
   *
   * Body:
   * {
   *   "theme": "capgemini"
   * }
   */
  router.post('/customer/:customerId/assign', async (req: Request, res: Response) => {
    try {
      // Admin authentication
      const adminKey = req.headers['x-admin-key'];
      if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized'
        });
      }

      const customerId = parseInt(req.params.customerId);
      const { theme } = req.body;

      if (!theme) {
        return res.status(400).json({
          success: false,
          error: 'Theme name required'
        });
      }

      // Validate theme name
      if (!/^[a-z0-9_-]+$/.test(theme)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid theme name'
        });
      }

      // Check if theme exists
      const themesDir = getThemesDir();
      const themePath = path.join(themesDir, `${theme}.json`);
      if (!fs.existsSync(themePath)) {
        return res.status(404).json({
          success: false,
          error: 'Theme not found',
          availableThemes: fs.readdirSync(themesDir)
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''))
        });
      }

      // Get customer
      const customer = db.getCustomerById(customerId);
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      // Update customer theme
      db.updateCustomer(customerId, { theme });

      res.json({
        success: true,
        message: 'Theme assigned successfully',
        customer: {
          id: customer.id,
          name: customer.name,
          theme: theme
        }
      });
    } catch (error) {
      console.error('Error assigning theme:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to assign theme'
      });
    }
  });

  /**
   * DELETE /themes/customer/:customerId/theme
   * Remove theme assignment (reverts to default 'servicenow')
   *
   * Authentication: Admin key required
   */
  router.delete('/customer/:customerId/theme', async (req: Request, res: Response) => {
    try {
      // Admin authentication
      const adminKey = req.headers['x-admin-key'];
      if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized'
        });
      }

      const customerId = parseInt(req.params.customerId);

      // Get customer
      const customer = db.getCustomerById(customerId);
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      // Remove theme (set to null, will default to 'servicenow')
      db.updateCustomer(customerId, { theme: null as any });

      res.json({
        success: true,
        message: 'Theme removed, reverted to default',
        customer: {
          id: customer.id,
          name: customer.name,
          theme: 'servicenow'
        }
      });
    } catch (error) {
      console.error('Error removing theme:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove theme'
      });
    }
  });

  return router;
}
