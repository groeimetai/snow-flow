/**
 * Partner CLI Commands for Snow-Flow
 *
 * Handles partner authentication, license validation, and partner-specific operations
 *
 * Two partner tracks:
 * - RESELLER: Wholesale pricing, buy seats and resell
 * - SOLUTION: Referral model, earn commission on referrals
 */

import { intro, outro, spinner, log, isCancel, cancel, text, confirm } from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { parsePartnerLicenseKey, validatePartnerLicense, formatPartnerLicenseInfo, type ParsedPartnerLicense } from '../partners/license-parser.js';
import { PartnerType } from '../partners/types.js';

const AUTH_FILE = path.join(os.homedir(), '.snow-flow', 'partner-auth.json');

interface PartnerAuthData {
  licenseKey: string;
  parsedLicense: ParsedPartnerLicense;
  authenticatedAt: string;
  partnerId: string;
  partnerName: string;
}

/**
 * Partner login command
 * Validates partner license key and stores authentication
 */
export async function partnerLogin(): Promise<void> {
  intro(chalk.cyan('Snow-Flow Partner Login'));

  const s = spinner();

  try {
    // Prompt for license key
    const licenseKey = await text({
      message: 'Enter your partner license key',
      placeholder: 'SNOW-RESELLER-ACME-100-20261231-ABC123 or SNOW-SOLUTION-ACME-20261231-ABC123',
      validate: (value) => {
        if (!value || value.length === 0) {
          return 'License key is required';
        }
        if (!value.startsWith('SNOW-RESELLER-') && !value.startsWith('SNOW-SOLUTION-')) {
          return 'Invalid partner license key format (must start with SNOW-RESELLER- or SNOW-SOLUTION-)';
        }
        return undefined;
      }
    });

    if (isCancel(licenseKey)) {
      cancel('Partner login cancelled');
      process.exit(0);
    }

    // Parse and validate license
    s.start('Validating partner license');

    let parsedLicense: ParsedPartnerLicense;
    try {
      parsedLicense = parsePartnerLicenseKey(licenseKey as string);
    } catch (error) {
      s.stop('License validation failed');
      log.error(`Invalid license key: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }

    // Validate license
    const validation = validatePartnerLicense(parsedLicense);
    if (!validation.isValid) {
      s.stop('License validation failed');
      log.error('License validation errors:');
      validation.errors.forEach(err => log.error(`  - ${err}`));
      process.exit(1);
    }

    s.stop('License validated successfully');

    // Show license info
    log.info('\n' + chalk.cyan('Partner License Information:'));
    const info = formatPartnerLicenseInfo(parsedLicense);
    info.split('\n').forEach(line => log.info(`  ${line}`));

    // Confirm login
    const shouldLogin = await confirm({
      message: 'Authenticate with this partner license?',
      initialValue: true
    });

    if (isCancel(shouldLogin) || !shouldLogin) {
      cancel('Partner login cancelled');
      process.exit(0);
    }

    // Generate partner ID from organization name
    const partnerId = `${parsedLicense.partnerType}_${parsedLicense.organization.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    // Store authentication
    const authData: PartnerAuthData = {
      licenseKey: licenseKey as string,
      parsedLicense,
      authenticatedAt: new Date().toISOString(),
      partnerId,
      partnerName: parsedLicense.organization
    };

    // Ensure directory exists
    const authDir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    // Write auth file
    fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2));

    log.success(`\nAuthenticated as partner: ${chalk.cyan(parsedLicense.organization)}`);
    log.info(`Partner type: ${chalk.cyan(parsedLicense.partnerType.toUpperCase())}`);

    // Type-specific info
    if (parsedLicense.partnerType === PartnerType.RESELLER) {
      log.info(`Purchased seats: ${chalk.cyan(parsedLicense.purchasedSeats?.toString() || '0')}`);

      // Calculate wholesale cost with volume discount
      const seats = parsedLicense.purchasedSeats || 0;
      let pricePerSeat = 69;
      if (seats >= 500) pricePerSeat = 49;
      else if (seats >= 100) pricePerSeat = 59;

      log.info(`Wholesale cost: ${chalk.cyan('$' + (pricePerSeat * seats) + '/year')}`);
    } else if (parsedLicense.partnerType === PartnerType.SOLUTION) {
      log.info(`Referral code: ${chalk.cyan(parsedLicense.referralCode || 'N/A')}`);
      log.info(`Commission: ${chalk.cyan('15% Year 1, 10% Year 2+')}`);
    }

    outro(chalk.green('Partner authentication successful!'));
  } catch (error) {
    log.error(`Login error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

/**
 * Partner logout command
 * Removes partner authentication
 */
export async function partnerLogout(): Promise<void> {
  intro(chalk.cyan('Snow-Flow Partner Logout'));

  try {
    if (!fs.existsSync(AUTH_FILE)) {
      log.warning('Not authenticated as a partner');
      outro(chalk.yellow('No partner session to logout'));
      return;
    }

    // Read current auth
    const authData: PartnerAuthData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));

    // Confirm logout
    const shouldLogout = await confirm({
      message: `Logout from partner account: ${authData.partnerName}?`,
      initialValue: true
    });

    if (isCancel(shouldLogout) || !shouldLogout) {
      cancel('Logout cancelled');
      return;
    }

    // Remove auth file
    fs.unlinkSync(AUTH_FILE);

    log.success(`Logged out from partner: ${chalk.cyan(authData.partnerName)}`);
    outro(chalk.green('Partner logout successful'));
  } catch (error) {
    log.error(`Logout error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

/**
 * Partner status command
 * Shows current partner authentication status
 */
export async function partnerStatus(): Promise<void> {
  intro(chalk.cyan('Snow-Flow Partner Status'));

  try {
    if (!fs.existsSync(AUTH_FILE)) {
      log.warning('Not authenticated as a partner');
      log.info('\nTo authenticate:');
      log.info(`  ${chalk.cyan('snow-flow partner login')}`);
      outro(chalk.yellow('No active partner session'));
      return;
    }

    // Read auth data
    const authData: PartnerAuthData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));

    // Re-validate license (check expiry)
    const validation = validatePartnerLicense(authData.parsedLicense);

    log.info('\n' + chalk.cyan('Partner Authentication Status:'));
    log.info(`  Partner: ${chalk.green(authData.partnerName)}`);
    log.info(`  Partner ID: ${chalk.gray(authData.partnerId)}`);
    log.info(`  Type: ${chalk.cyan(authData.parsedLicense.partnerType.toUpperCase())}`);
    log.info(`  Authenticated: ${chalk.gray(new Date(authData.authenticatedAt).toLocaleString())}`);

    // Type-specific info
    if (authData.parsedLicense.partnerType === PartnerType.RESELLER) {
      log.info(`  Purchased Seats: ${chalk.cyan(authData.parsedLicense.purchasedSeats?.toString() || '0')}`);

      // Calculate wholesale cost with volume discount
      const seats = authData.parsedLicense.purchasedSeats || 0;
      let pricePerSeat = 69;
      if (seats >= 500) pricePerSeat = 49;
      else if (seats >= 100) pricePerSeat = 59;

      log.info(`  Wholesale Price: ${chalk.cyan('$' + pricePerSeat + '/seat')}`);
      log.info(`  Total Cost: ${chalk.cyan('$' + (pricePerSeat * seats) + '/year')}`);
      log.info(`  Suggested Retail: ${chalk.cyan('$99/seat')}`);

      const margin = 99 - pricePerSeat;
      const marginPercent = Math.round((margin / 99) * 100);
      log.info(`  Potential Margin: ${chalk.green('$' + (margin * seats) + '/year (' + marginPercent + '%)')}`);
    } else if (authData.parsedLicense.partnerType === PartnerType.SOLUTION) {
      log.info(`  Referral Code: ${chalk.cyan(authData.parsedLicense.referralCode || 'N/A')}`);
      log.info(`  Commission Rates:`);
      log.info(`    Year 1: ${chalk.green('15%')}`);
      log.info(`    Year 2+: ${chalk.green('10%')}`);
    }

    // Expiry status
    const daysUntilExpiry = Math.floor(
      (authData.parsedLicense.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry < 0) {
      log.error(`  Status: ${chalk.red('EXPIRED')} (${Math.abs(daysUntilExpiry)} days ago)`);
    } else if (daysUntilExpiry < 30) {
      log.warning(`  Status: ${chalk.yellow('ACTIVE')} (expires in ${daysUntilExpiry} days)`);
    } else {
      log.success(`  Status: ${chalk.green('ACTIVE')} (${daysUntilExpiry} days remaining)`);
    }

    log.info(`  Expires: ${chalk.gray(authData.parsedLicense.expiresAt.toLocaleDateString())}`);

    // Validation errors
    if (!validation.isValid) {
      log.warning('\n' + chalk.yellow('License Validation Issues:'));
      validation.errors.forEach(err => log.warning(`  - ${err}`));
    }

    outro(validation.isValid ? chalk.green('Partner license is valid') : chalk.yellow('Please renew your partner license'));
  } catch (error) {
    log.error(`Status error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

/**
 * Get current partner authentication data
 * Used by other commands to access partner context
 */
export function getPartnerAuth(): PartnerAuthData | null {
  try {
    if (!fs.existsSync(AUTH_FILE)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
  } catch (error) {
    return null;
  }
}

/**
 * Check if user is authenticated as a partner
 */
export function isPartnerAuthenticated(): boolean {
  return getPartnerAuth() !== null;
}

/**
 * Register partner commands with Commander
 */
export function registerPartnerCommands(program: any): void {
  const partnerCommand = program
    .command('partner')
    .description('Snow-Flow Partner Program commands');

  // Partner login
  partnerCommand
    .command('login')
    .description('Authenticate with a Snow-Flow Partner license key (RESELLER or SOLUTION)')
    .action(async () => {
      await partnerLogin();
    });

  // Partner status
  partnerCommand
    .command('status')
    .description('Show current partner authentication status')
    .action(async () => {
      await partnerStatus();
    });

  // Partner logout
  partnerCommand
    .command('logout')
    .description('Logout from partner account')
    .action(async () => {
      await partnerLogout();
    });
}
