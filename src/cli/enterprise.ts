/**
 * Enterprise authentication commands for Snow-Flow
 *
 * NOTE: This file contains LEGACY portal authentication code.
 * Primary enterprise auth is now handled by SnowCode (see snow-code auth enterprise).
 * These functions remain for backwards compatibility but should be migrated.
 */

import { Command } from 'commander';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';

const SNOW_FLOW_DIR = join(homedir(), '.snow-flow');
const AUTH_FILE = join(SNOW_FLOW_DIR, 'auth.json');
const PORTAL_URL = 'https://portal.snow-flow.dev';
const MCP_SERVER_URL = 'https://enterprise.snow-flow.dev';

interface AuthData {
  jwt: string;
  expiresAt: string;
  customer: {
    id: string;
    name: string;
    tier: string;
    features: string[];
    // Seat information (v8.5.0+)
    developerSeats?: number;      // Number of developer seats (undefined = unlimited/legacy)
    stakeholderSeats?: number;    // Number of stakeholder seats (undefined = unlimited/legacy)
    activeDeveloperSeats?: number;    // Current active developer connections
    activeStakeholderSeats?: number;  // Current active stakeholder sessions
    // User role (for multi-role accounts)
    role?: 'developer' | 'stakeholder' | 'admin';
    theme?: string;
    customTheme?: {
      themeName: string;
      displayName: string;
      themeConfig: any;
      primaryColor: string;
      secondaryColor?: string;
      accentColor?: string;
    };
  };
}

// ensureSnowFlowDir removed - no longer used (enterprise auth in SnowCode)

/**
 * Load stored authentication data
 */
async function loadAuth(): Promise<AuthData | null> {
  try {
    const data = await fs.readFile(AUTH_FILE, 'utf-8');
    const auth: AuthData = JSON.parse(data);

    // Check if token is expired
    const expiresAt = new Date(auth.expiresAt);
    if (expiresAt < new Date()) {
      console.log(chalk.yellow('⚠️  Your authentication has expired. Please login again.'));
      return null;
    }

    return auth;
  } catch (err) {
    return null;
  }
}

// Legacy saveAuth, deleteAuth, loginCommand removed - use snow-code auth enterprise instead

/**
 * Show authentication status
 * Exported for use in main status command
 */
export async function showEnterpriseStatus(): Promise<void> {
  const auth = await loadAuth();

  if (!auth) {
    console.log(chalk.blue('🔐 Snow-Flow Enterprise'));
    console.log(chalk.yellow('   Status: Not logged in'));
    console.log('');
    console.log(chalk.gray('   To login: snow-flow login <license-key>'));
    console.log(chalk.gray('   Get key from:'), chalk.blue(PORTAL_URL));
    return;
  }

  console.log(chalk.blue('🔐 Snow-Flow Enterprise'));
  console.log(chalk.green('   Status: ✅ Authenticated'));
  console.log('');
  console.log(chalk.bold('   Customer:'), auth.customer.name);
  console.log(chalk.bold('   Customer ID:'), auth.customer.id);
  console.log(chalk.bold('   License Tier:'), chalk.cyan(auth.customer.tier.toUpperCase()));
  console.log('');
  console.log(chalk.bold('   Features:'));
  auth.customer.features.forEach(feature => {
    console.log(chalk.gray('      •'), feature);
  });

  // Show seat information if available (v8.5.0+)
  if (auth.customer.developerSeats !== undefined || auth.customer.stakeholderSeats !== undefined) {
    console.log('');
    console.log(chalk.bold('   License Seats:'));

    if (auth.customer.developerSeats !== undefined) {
      const devSeats = auth.customer.developerSeats === -1 ? 'Unlimited' : auth.customer.developerSeats;
      const activeDevSeats = auth.customer.activeDeveloperSeats || 0;
      const devUsagePercent = auth.customer.developerSeats > 0
        ? Math.round((activeDevSeats / auth.customer.developerSeats) * 100)
        : 0;

      let devColor = chalk.green;
      if (devUsagePercent >= 90) devColor = chalk.red;
      else if (devUsagePercent >= 75) devColor = chalk.yellow;

      console.log(
        chalk.gray('      Developer:'),
        devColor(`${activeDevSeats}/${devSeats}`),
        chalk.gray('(active/total)')
      );
    }

    if (auth.customer.stakeholderSeats !== undefined) {
      const stakeholderSeats = auth.customer.stakeholderSeats === -1 ? 'Unlimited' : auth.customer.stakeholderSeats;
      const activeStakeholderSeats = auth.customer.activeStakeholderSeats || 0;
      const stakeholderUsagePercent = auth.customer.stakeholderSeats > 0
        ? Math.round((activeStakeholderSeats / auth.customer.stakeholderSeats) * 100)
        : 0;

      let stakeholderColor = chalk.green;
      if (stakeholderUsagePercent >= 90) stakeholderColor = chalk.red;
      else if (stakeholderUsagePercent >= 75) stakeholderColor = chalk.yellow;

      console.log(
        chalk.gray('      Stakeholder:'),
        stakeholderColor(`${activeStakeholderSeats}/${stakeholderSeats}`),
        chalk.gray('(active/total)')
      );
    }
  }

  // Show theme information if available
  if (auth.customer.customTheme) {
    console.log('');
    console.log(chalk.bold('   Custom Theme:'), chalk.magenta(auth.customer.customTheme.displayName));
    console.log(chalk.gray('      Theme ID:'), auth.customer.customTheme.themeName);
    console.log(chalk.gray('      Primary:'), auth.customer.customTheme.primaryColor);
    if (auth.customer.customTheme.secondaryColor) {
      console.log(chalk.gray('      Secondary:'), auth.customer.customTheme.secondaryColor);
    }
    if (auth.customer.customTheme.accentColor) {
      console.log(chalk.gray('      Accent:'), auth.customer.customTheme.accentColor);
    }
  } else if (auth.customer.theme) {
    console.log('');
    console.log(chalk.bold('   Theme:'), chalk.magenta(auth.customer.theme));
  }

  console.log('');
  console.log(chalk.bold('   Token Expires:'), new Date(auth.expiresAt).toLocaleString());
}

/**
 * Open portal in browser
 */
async function portalCommand(): Promise<void> {
  console.log(chalk.blue('🌐 Opening Snow-Flow Enterprise Portal...'));

  try {
    // Dynamic import for ESM compatibility
    const { default: open } = await import('open');
    await open(PORTAL_URL);
    console.log(chalk.green('✅ Portal opened in your default browser'));
    console.log('');
    console.log(chalk.gray('Portal URL:'), chalk.blue(PORTAL_URL));
  } catch (err: any) {
    console.error(chalk.red('❌ Failed to open browser:'), err.message);
    console.log('');
    console.log(chalk.gray('Please open this URL manually:'), chalk.blue(PORTAL_URL));
  }
}

// Legacy logoutCommand removed - use snow-code auth logout instead

/**
 * Get JWT token for MCP server authentication
 * Called internally by MCP client
 */
export async function getEnterpriseToken(): Promise<string | null> {
  const auth = await loadAuth();
  return auth ? auth.jwt : null;
}

/**
 * Check if user has enterprise features enabled
 * Called internally by swarm command
 */
export async function hasEnterpriseFeatures(): Promise<boolean> {
  const auth = await loadAuth();
  return auth !== null && auth.customer !== undefined && auth.customer.features.length > 0;
}

/**
 * Get enterprise customer info
 */
export async function getEnterpriseInfo(): Promise<AuthData['customer'] | null> {
  const auth = await loadAuth();
  return (auth && auth.customer) ? auth.customer : null;
}

/**
 * Register enterprise commands with Commander
 * Note: login/logout commands moved to auth subcommands (snow-flow auth enterprise)
 */
export function registerEnterpriseCommands(program: Command): void {
  // Portal command - open Snow-Flow Enterprise portal in browser
  program
    .command('portal')
    .description('Open Snow-Flow Enterprise Portal (portal.snow-flow.dev)')
    .action(async () => {
      await portalCommand();
    });
}

export const ENTERPRISE_MCP_SERVER_URL = MCP_SERVER_URL;
