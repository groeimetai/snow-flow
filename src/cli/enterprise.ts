/**
 * Enterprise authentication commands for Snow-Flow
 * Handles license key authentication with portal.snow-flow.dev
 */

import { Command } from 'commander';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import open from 'open';

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

/**
 * Ensure .snow-flow directory exists
 */
async function ensureSnowFlowDir(): Promise<void> {
  try {
    await fs.mkdir(SNOW_FLOW_DIR, { recursive: true });
  } catch (err) {
    // Directory already exists, ignore
  }
}

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

/**
 * Save authentication data
 */
async function saveAuth(auth: AuthData): Promise<void> {
  await ensureSnowFlowDir();
  await fs.writeFile(AUTH_FILE, JSON.stringify(auth, null, 2), 'utf-8');
}

/**
 * Delete authentication data
 */
async function deleteAuth(): Promise<void> {
  try {
    await fs.unlink(AUTH_FILE);
  } catch (err) {
    // File doesn't exist, ignore
  }
}

/**
 * Login with license key
 */
async function loginCommand(licenseKey: string): Promise<void> {
  console.log(chalk.blue('🔑 Authenticating with Snow-Flow Enterprise...'));

  try {
    const response = await fetch(`${PORTAL_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ licenseKey })
    });

    if (!response.ok) {
      const error = await response.json() as { message?: string };
      console.error(chalk.red(`❌ Authentication failed: ${error.message || 'Invalid license key'}`));
      process.exit(1);
    }

    const data = await response.json() as { token: string; expiresAt?: string; customer: AuthData['customer'] };

    const authData: AuthData = {
      jwt: data.token,
      expiresAt: data.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      customer: data.customer
    };

    await saveAuth(authData);

    console.log(chalk.green('✅ Successfully authenticated!'));
    console.log('');
    console.log(chalk.bold('Customer:'), authData.customer.name);
    console.log(chalk.bold('License Tier:'), chalk.cyan(authData.customer.tier.toUpperCase()));
    console.log(chalk.bold('Features:'), authData.customer.features.join(', '));

    // Show theme information if available
    if (authData.customer.customTheme) {
      console.log(chalk.bold('Custom Theme:'), chalk.magenta(authData.customer.customTheme.displayName));
      console.log(chalk.gray('  Theme has been synced for your SnowCode CLI'));
    } else if (authData.customer.theme) {
      console.log(chalk.bold('Theme:'), chalk.magenta(authData.customer.theme));
    }

    console.log('');
    console.log(chalk.gray('Your credentials have been saved to:'), chalk.gray(AUTH_FILE));
    console.log('');
    console.log(chalk.blue('💡 Enterprise tools are now available!'));
    console.log(chalk.gray('   Run'), chalk.cyan('snow-flow swarm "<task>"'), chalk.gray('to use them.'));
    console.log(chalk.gray('   Run'), chalk.cyan('snow-flow portal'), chalk.gray('to configure integrations.'));
    console.log(chalk.gray('   Run'), chalk.cyan('snow-flow status'), chalk.gray('to view your account details.'));
  } catch (err: any) {
    console.error(chalk.red('❌ Network error:'), err.message);
    console.error(chalk.gray('Please check your internet connection and try again.'));
    process.exit(1);
  }
}

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

/**
 * Logout and remove credentials
 */
async function logoutCommand(): Promise<void> {
  const auth = await loadAuth();

  if (!auth) {
    console.log(chalk.yellow('⚠️  You are not logged in.'));
    return;
  }

  await deleteAuth();

  console.log(chalk.green('✅ Successfully logged out'));
  console.log('');
  console.log(chalk.gray('Your authentication credentials have been removed.'));
  console.log(chalk.gray('Enterprise tools will no longer be available until you login again.'));
}

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
 */
export function registerEnterpriseCommands(program: Command): void {
  // Login command
  program
    .command('login <license-key>')
    .description('Authenticate with Snow-Flow Enterprise using your license key')
    .action(async (licenseKey: string) => {
      await loginCommand(licenseKey);
    });

  // Status command removed - enterprise status is now shown via getEnterpriseInfo() in main status command

  // Portal command
  program
    .command('portal')
    .description('Open Snow-Flow Enterprise Portal in browser')
    .action(async () => {
      await portalCommand();
    });

  // Logout command
  program
    .command('logout')
    .description('Logout from Snow-Flow Enterprise and remove credentials')
    .action(async () => {
      await logoutCommand();
    });
}

export const ENTERPRISE_MCP_SERVER_URL = MCP_SERVER_URL;
