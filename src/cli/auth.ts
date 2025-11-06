import { Command } from 'commander';
import * as prompts from '@clack/prompts';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { Logger } from '../utils/logger.js';
import { existsSync, chmodSync } from 'fs';

const authLogger = new Logger('auth');

// Helper function to fix binary permissions (critical for containers/codespaces)
function fixSnowCodeBinaryPermissions(): void {
  try {
    const platforms = [
      'snow-code-darwin-arm64',
      'snow-code-darwin-x64',
      'snow-code-linux-arm64',
      'snow-code-linux-x64',
      'snow-code-windows-x64'
    ];

    platforms.forEach(platform => {
      // Try both global and local node_modules
      const paths = [
        path.join(process.cwd(), 'node_modules', '@groeimetai', platform, 'bin', 'snow-code'),
        path.join(os.homedir(), '.npm', '_npx', 'node_modules', '@groeimetai', platform, 'bin', 'snow-code'),
        path.join(__dirname, '..', '..', 'node_modules', '@groeimetai', platform, 'bin', 'snow-code')
      ];

      paths.forEach(binaryPath => {
        if (existsSync(binaryPath)) {
          try {
            chmodSync(binaryPath, 0o755);
            authLogger.debug(`Fixed permissions for ${platform}`);
          } catch (err) {
            // Silently continue if chmod fails
          }
        }
      });
    });
  } catch (error) {
    // Silently continue if permission fixing fails
  }
}

/**
 * Prompt for optional partner license key
 */
async function promptPartnerLicense(): Promise<string | null> {
  try {
    prompts.log.message('');
    prompts.log.step('🤝 Partner License (Optional)');
    prompts.log.info('If you have a Snow-Flow Partner license, enter it here.');
    prompts.log.info('Partner types: RESELLER (wholesale) or SOLUTION (commission-based)');
    prompts.log.message('');

    const hasPartnerLicense = await prompts.confirm({
      message: 'Do you have a partner license key?',
      initialValue: false
    });

    if (prompts.isCancel(hasPartnerLicense) || !hasPartnerLicense) {
      return null;
    }

    const licenseKey = await prompts.text({
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

    if (prompts.isCancel(licenseKey)) {
      return null;
    }

    return licenseKey as string;
  } catch (error) {
    authLogger.warn('Failed to prompt for partner license:', error);
    return null;
  }
}

/**
 * Validate and store partner license key
 */
async function validateAndStorePartnerLicense(licenseKey: string): Promise<boolean> {
  try {
    // Dynamic import to avoid circular dependencies
    const { parsePartnerLicenseKey, validatePartnerLicense } = await import('../partners/license-parser.js');

    // Parse license
    const parsedLicense = parsePartnerLicenseKey(licenseKey);

    // Validate license
    const validation = validatePartnerLicense(parsedLicense);
    if (!validation.isValid) {
      prompts.log.error('❌ Invalid partner license:');
      validation.errors.forEach(err => prompts.log.error(`  - ${err}`));
      return false;
    }

    // Display license info
    prompts.log.success('✅ Partner license validated successfully!');
    prompts.log.info(`  Organization: ${parsedLicense.organization}`);
    prompts.log.info(`  Type: ${parsedLicense.partnerType.toUpperCase()}`);

    if (parsedLicense.partnerType === 'reseller') {
      prompts.log.info(`  Purchased seats: ${parsedLicense.purchasedSeats}`);
    } else if (parsedLicense.partnerType === 'solution') {
      prompts.log.info(`  Referral code: ${parsedLicense.referralCode}`);
    }

    const daysUntilExpiry = Math.floor(
      (parsedLicense.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    prompts.log.info(`  Expires: ${parsedLicense.expiresAt.toLocaleDateString()} (${daysUntilExpiry} days)`);

    // Store in Snow-Flow partner auth
    const partnerAuthDir = path.join(os.homedir(), '.snow-flow');
    try {
      await fs.mkdir(partnerAuthDir, { recursive: true });
    } catch (err) {
      // Directory might already exist
    }

    const partnerAuthFile = path.join(partnerAuthDir, 'partner-auth.json');
    await fs.writeFile(partnerAuthFile, JSON.stringify({
      licenseKey,
      parsedLicense: {
        ...parsedLicense,
        expiresAt: parsedLicense.expiresAt.toISOString()
      },
      authenticatedAt: new Date().toISOString()
    }, null, 2));

    return true;
  } catch (error: any) {
    prompts.log.error(`❌ Failed to validate partner license: ${error.message}`);
    return false;
  }
}

/**
 * Update MCP server config with ServiceNow credentials from auth.json
 */
async function updateMCPServerConfig() {
  try {
    // Read SnowCode auth.json
    const authPath = path.join(os.homedir(), '.local', 'share', 'snow-code', 'auth.json');
    const authJson = JSON.parse(await fs.readFile(authPath, 'utf-8'));

    // Check if ServiceNow credentials exist
    const servicenowCreds = authJson['servicenow'];
    if (!servicenowCreds || servicenowCreds.type !== 'servicenow-oauth') {
      authLogger.debug('No ServiceNow OAuth credentials found in auth.json');
      return;
    }

    // Read SnowCode config.json
    const configPath = path.join(os.homedir(), '.config', 'snowcode', 'config.json');
    let config: any = {};
    try {
      config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    } catch (err) {
      authLogger.debug('No existing config.json found, will create new one');
    }

    // Ensure mcp section exists
    if (!config.mcp) config.mcp = {};

    // Update servicenow-unified MCP server environment variables
    if (config.mcp['servicenow-unified']) {
      if (!config.mcp['servicenow-unified'].environment) {
        config.mcp['servicenow-unified'].environment = {};
      }

      config.mcp['servicenow-unified'].environment['SERVICENOW_INSTANCE_URL'] = servicenowCreds.instance;
      config.mcp['servicenow-unified'].environment['SERVICENOW_CLIENT_ID'] = servicenowCreds.clientId;
      config.mcp['servicenow-unified'].environment['SERVICENOW_CLIENT_SECRET'] = servicenowCreds.clientSecret;

      // Check if partner license exists and add to env
      try {
        const partnerAuthFile = path.join(os.homedir(), '.snow-flow', 'partner-auth.json');
        const partnerAuth = JSON.parse(await fs.readFile(partnerAuthFile, 'utf-8'));
        if (partnerAuth.licenseKey) {
          config.mcp['servicenow-unified'].environment['PARTNER_LICENSE_KEY'] = partnerAuth.licenseKey;
          authLogger.info('Added partner license to MCP server config');
        }
      } catch (err) {
        // No partner license - that's fine
      }

      // Write updated config
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

      prompts.log.success('✅ Updated MCP server config with ServiceNow credentials');
      authLogger.info('MCP server config updated successfully');
    } else {
      authLogger.debug('No servicenow-unified MCP server found in config');
    }
  } catch (error: any) {
    authLogger.warn(`Failed to update MCP server config: ${error.message}`);
    // Don't throw - this is not critical
  }
}

export function registerAuthCommands(program: Command) {
  const auth = program.command('auth').description('Authentication management (powered by SnowCode)');

  // List available models for a provider
  auth
    .command('models')
    .description('List available models for LLM providers')
    .option('-p, --provider <provider>', 'Provider to list models for (anthropic, openai, google, ollama)')
    .action(async (options) => {
      const { getAllProviderModels, getProviderModels } = await import('../utils/dynamic-models.js');

      prompts.log.step('Available LLM Models');

      if (options.provider) {
        // List models for specific provider
        prompts.log.info(`${options.provider.toUpperCase()}:`);
        const models = await getProviderModels(options.provider);

        if (models.length > 0) {
          models.forEach((model, i) => {
            prompts.log.message(`  ${i + 1}. ${model.name}`);
            prompts.log.message(`     ID: ${model.value}`);
            if (model.contextWindow) {
              prompts.log.message(`     Context: ${model.contextWindow.toLocaleString()} tokens`);
            }
            prompts.log.message('');
          });
        } else {
          prompts.log.warn('  No models available for this provider');
        }
      } else {
        // List all providers
        const allModels = await getAllProviderModels();

        for (const [provider, models] of Object.entries(allModels)) {
          prompts.log.info(`${provider.toUpperCase()}:`);

          if (models.length > 0) {
            models.forEach((model, i) => {
              prompts.log.message(`  ${i + 1}. ${model.name}`);
              prompts.log.message(`     ID: ${model.value}`);
              prompts.log.message('');
            });
          } else {
            prompts.log.warn('  No models available');
          }
        }
      }

      prompts.log.message('Tip: Use --provider to see models for a specific provider');
      prompts.log.message('Example: snow-flow auth models --provider anthropic');
    });

  // Login - delegate to SnowCode
  auth
    .command('login')
    .description('Authenticate with LLM providers, ServiceNow, and Enterprise (via SnowCode)')
    .action(async () => {
      try {
        // Check if snowcode is installed
        try {
          execSync('which snow-code', { stdio: 'ignore' });
        } catch {
          prompts.log.error('SnowCode is not installed');
          prompts.log.warn('Please run: npm install -g snow-flow');
          prompts.log.info('This will install both snow-flow and snow-code');
          return;
        }

        // Determine which SnowCode to use: prefer local, fallback to global
        const localSnowCode = path.join(process.cwd(), 'node_modules', '@groeimetai', 'snow-code', 'bin', 'snow-code');
        let snowcodeCommand = 'snow-code'; // fallback to global

        try {
          const fs = require('fs');
          if (fs.existsSync(localSnowCode)) {
            snowcodeCommand = localSnowCode;
            authLogger.debug('Using local SnowCode installation');
          }
        } catch {
          authLogger.debug('Using global SnowCode installation');
        }

        prompts.log.message('');
        prompts.log.step('🚀 Starting authentication flow (powered by SnowCode)');
        prompts.log.message('');

        // Fix binary permissions before calling snow-code (critical for containers/codespaces)
        fixSnowCodeBinaryPermissions();

        // Call SnowCode auth login - it handles everything now!
        // SnowCode will handle enterprise setup during its auth flow
        execSync(`${snowcodeCommand} auth login`, { stdio: 'inherit' });

        // After successful auth, prompt for optional partner license
        const partnerLicenseKey = await promptPartnerLicense();
        if (partnerLicenseKey) {
          const validated = await validateAndStorePartnerLicense(partnerLicenseKey);
          if (validated) {
            prompts.log.success('🤝 Partner license configured successfully!');
          }
        }

        // After successful auth, update MCP server config with ServiceNow credentials
        await updateMCPServerConfig();
      } catch (error: any) {
        // Error details are already shown via stdio: 'inherit'
        // Only provide helpful context here
        prompts.log.message('');

        if (error.code === 'ENOENT') {
          prompts.log.error('SnowCode command not found');
          prompts.log.info('Please ensure snow-code is properly installed');
        } else {
          prompts.log.error('Authentication process was interrupted or failed');

          if (error.status) {
            prompts.log.info(`Exit code: ${error.status}`);
          }

          prompts.log.message('');
          prompts.log.info('💡 Troubleshooting tips:');
          prompts.log.message('  • Check your license key format (SNOW-ENT-* or SNOW-SI-*)');
          prompts.log.message('  • Verify enterprise server is accessible');
          prompts.log.message('  • Try running: snow-code auth login (for detailed errors)');
          prompts.log.message('  • Check logs in ~/.local/share/snow-code/');
        }

        prompts.log.message('');
      }
    });

  // List credentials
  auth
    .command('list')
    .alias('ls')
    .description('List configured credentials (via SnowCode)')
    .action(async () => {
      try {
        fixSnowCodeBinaryPermissions();
        execSync('snow-code auth list', { stdio: 'inherit' });
      } catch (error: any) {
        prompts.log.error('SnowCode is not installed. Run: npm install -g snow-flow');
      }
    });

  // Logout
  auth
    .command('logout')
    .description('Log out from a configured provider (via SnowCode)')
    .action(async () => {
      try {
        fixSnowCodeBinaryPermissions();
        execSync('snow-code auth logout', { stdio: 'inherit' });
      } catch (error: any) {
        prompts.log.error('SnowCode is not installed. Run: npm install -g snow-flow');
      }
    });
}
