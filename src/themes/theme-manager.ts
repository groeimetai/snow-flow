/**
 * Theme Manager for Enterprise Branded Themes
 *
 * Manages company-specific themes for OpenCode integration.
 * Automatically applies themes based on enterprise license.
 *
 * Supported Companies:
 * - Capgemini: Blue theme
 * - EY: Yellow theme
 * - Deloitte: Green theme
 * - PwC: Orange theme
 * - KPMG: Blue theme
 *
 * @version 1.0.0
 * @author Snow-Flow Team
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EnterpriseLicense } from './types';

/**
 * Theme definition structure (OpenCode format)
 */
interface ThemeDefinition {
  $schema: string;
  name: string;
  description: string;
  author: string;
  version: string;
  defs: Record<string, string>;
  theme: {
    primary: string;
    secondary: string;
    accent: string;
    error: string;
    warning: string;
    success: string;
    info: string;
    [key: string]: any;
  };
}

/**
 * Theme Manager
 */
export class ThemeManager {
  private themesDir: string;
  private activeTheme?: string;

  constructor(themesDir?: string) {
    // Use .opencode/themes directory in user's home
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
    this.themesDir = themesDir || path.join(homeDir, '.snow-flow', 'themes');
  }

  /**
   * Get theme path for company
   */
  private getThemePath(themeName: string): string {
    return path.join(this.themesDir, `${themeName}.json`);
  }

  /**
   * Load theme from file
   */
  async loadTheme(themeName: string): Promise<ThemeDefinition | null> {
    try {
      const themePath = this.getThemePath(themeName);
      const themeData = await fs.readFile(themePath, 'utf-8');
      return JSON.parse(themeData);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('[Theme] Failed to load theme:', themeName, error.message);
      }
      return null;
    }
  }

  /**
   * Save theme to file
   */
  async saveTheme(themeName: string, theme: ThemeDefinition): Promise<boolean> {
    try {
      // Ensure themes directory exists
      await fs.mkdir(this.themesDir, { recursive: true });

      const themePath = this.getThemePath(themeName);
      await fs.writeFile(themePath, JSON.stringify(theme, null, 2), 'utf-8');

      console.log('[Theme] Saved theme:', themeName);
      return true;
    } catch (error: any) {
      console.error('[Theme] Failed to save theme:', themeName, error.message);
      return false;
    }
  }

  /**
   * Apply theme for enterprise license
   */
  async applyThemeForLicense(license: EnterpriseLicense): Promise<boolean> {
    const themeName = license.theme || 'servicenow';

    console.log('[Theme] Applying theme:', themeName, 'for', license.companyName || 'community');

    // Load theme
    let theme = await this.loadTheme(themeName);

    // If theme doesn't exist, create default ServiceNow theme
    if (!theme) {
      console.log('[Theme] Theme not found, using default ServiceNow theme');
      theme = await this.loadTheme('servicenow');
    }

    if (!theme) {
      console.warn('[Theme] No theme available');
      return false;
    }

    this.activeTheme = themeName;
    return true;
  }

  /**
   * Get active theme name
   */
  getActiveTheme(): string | undefined {
    return this.activeTheme;
  }

  /**
   * List available themes
   */
  async listThemes(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.themesDir);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('[Theme] Failed to list themes:', error.message);
      }
      return [];
    }
  }

  /**
   * Initialize default themes (run once on setup)
   */
  async initializeDefaultThemes(): Promise<void> {
    console.log('[Theme] Initializing default themes...');

    // Check if themes already exist
    const existingThemes = await this.listThemes();
    if (existingThemes.length > 0) {
      console.log('[Theme] Themes already initialized:', existingThemes.join(', '));
      return;
    }

    // Create themes directory
    await fs.mkdir(this.themesDir, { recursive: true });

    console.log('[Theme] Created themes directory:', this.themesDir);
    console.log('[Theme] Themes will be created on demand');
  }

  /**
   * Copy theme from source (e.g., .opencode/themes to .snow-flow/themes)
   */
  async copyThemeFromSource(themeName: string, sourcePath: string): Promise<boolean> {
    try {
      const themeData = await fs.readFile(sourcePath, 'utf-8');
      const theme: ThemeDefinition = JSON.parse(themeData);

      await this.saveTheme(themeName, theme);
      console.log('[Theme] Copied theme from:', sourcePath);
      return true;
    } catch (error: any) {
      console.error('[Theme] Failed to copy theme:', error.message);
      return false;
    }
  }
}

/**
 * Singleton theme manager
 */
export const themeManager = new ThemeManager();

/**
 * Apply theme for license (convenience function)
 */
export async function applyThemeForLicense(license: EnterpriseLicense): Promise<boolean> {
  return await themeManager.applyThemeForLicense(license);
}

/**
 * Initialize themes (convenience function)
 */
export async function initializeThemes(): Promise<void> {
  return await themeManager.initializeDefaultThemes();
}
