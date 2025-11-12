import { Command } from 'commander';
import * as prompts from '@clack/prompts';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { Logger } from '../utils/logger.js';
import { existsSync, chmodSync } from 'fs';
import {
  addEnterpriseMcpServer,
  isEnterpriseMcpConfigured,
  type EnterpriseMcpConfig,
} from '../config/snowcode-config.js';
import { validateLicenseKey } from '../mcp/enterprise-proxy/proxy.js';

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
 * Enterprise License Flow
 * Prompts user for enterprise license and configures enterprise MCP server
 */
async function enterpriseLicenseFlow(): Promise<void> {
  try {
    // Check if already configured
    const alreadyConfigured = await isEnterpriseMcpConfigured();

    if (alreadyConfigured) {
      const reconfigure = await prompts.confirm({
        message: 'Enterprise MCP server is already configured. Reconfigure?',
        initialValue: false,
      });

      if (prompts.isCancel(reconfigure) || !reconfigure) {
        authLogger.debug('Skipping enterprise configuration (already configured)');
        return;
      }
    }

    // Ask if user has enterprise license
    const hasEnterprise = await prompts.confirm({
      message: 'Do you have a Snow-Flow Enterprise license?',
      initialValue: false,
    });

    if (prompts.isCancel(hasEnterprise) || !hasEnterprise) {
      authLogger.debug('Skipping enterprise configuration (user does not have license)');
      return;
    }

    // Prompt for license key
    const licenseKey = await prompts.text({
      message: 'Enter your Enterprise License Key:',
      placeholder: 'SNOW-ENT-CUST-ABC123',
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'License key is required';
        }
        if (!value.startsWith('SNOW-ENT-') && !value.startsWith('SNOW-SI-')) {
          return 'License key must start with SNOW-ENT- or SNOW-SI-';
        }
        return undefined;
      },
    });

    if (prompts.isCancel(licenseKey)) {
      authLogger.debug('Enterprise configuration cancelled by user');
      return;
    }

    // Validate license key with enterprise server
    prompts.log.step('Validating enterprise license...');

    // Set license key temporarily for validation
    const originalLicenseKey = process.env.SNOW_LICENSE_KEY;
    process.env.SNOW_LICENSE_KEY = licenseKey;

    let validation: { valid: boolean; error?: string; features?: string[]; serverUrl?: string };

    try {
      validation = await validateLicenseKey(licenseKey);

      if (!validation.valid) {
        prompts.log.error(`License validation failed: ${validation.error || 'Unknown error'}`);
        authLogger.error(`License validation failed: ${validation.error}`);

        // Restore original license key
        if (originalLicenseKey) {
          process.env.SNOW_LICENSE_KEY = originalLicenseKey;
        } else {
          delete process.env.SNOW_LICENSE_KEY;
        }

        return;
      }

      prompts.log.success('✅ License validated successfully');
      authLogger.info('Enterprise license validated successfully');

      // Show available features
      if (validation.features && validation.features.length > 0) {
        prompts.log.info(`Available enterprise features: ${validation.features.join(', ')}`);
      }
    } catch (error: any) {
      prompts.log.error(`Failed to validate license: ${error.message}`);
      authLogger.error(`License validation error: ${error.message}`);

      // Restore original license key
      if (originalLicenseKey) {
        process.env.SNOW_LICENSE_KEY = originalLicenseKey;
      } else {
        delete process.env.SNOW_LICENSE_KEY;
      }

      return;
    }

    // Ask about credential mode
    const credentialMode = await prompts.select({
      message: 'How would you like to provide enterprise credentials?',
      options: [
        {
          value: 'server',
          label: 'Server-side (credentials stored encrypted on enterprise server)',
          hint: 'Most secure, requires SSO configuration',
        },
        {
          value: 'local',
          label: 'Local (credentials from environment variables)',
          hint: 'Simple setup, credentials stored locally',
        },
        {
          value: 'skip',
          label: 'Skip for now (configure later)',
        },
      ],
      initialValue: 'server',
    });

    if (prompts.isCancel(credentialMode)) {
      authLogger.debug('Enterprise configuration cancelled by user');

      // Restore original license key
      if (originalLicenseKey) {
        process.env.SNOW_LICENSE_KEY = originalLicenseKey;
      } else {
        delete process.env.SNOW_LICENSE_KEY;
      }

      return;
    }

    const enterpriseConfig: EnterpriseMcpConfig = {
      licenseKey,
      serverUrl: validation.serverUrl,
    };

    // If local mode, prompt for credentials
    if (credentialMode === 'local') {
      prompts.log.step('Configuring local credentials...');

      // Jira credentials
      const configureJira = await prompts.confirm({
        message: 'Configure Jira integration?',
        initialValue: false,
      });

      if (!prompts.isCancel(configureJira) && configureJira) {
        const jiraHost = await prompts.text({
          message: 'Jira Host:',
          placeholder: 'https://company.atlassian.net',
          validate: (value) => (value.startsWith('https://') ? undefined : 'Must start with https://'),
        });

        const jiraEmail = await prompts.text({
          message: 'Jira Email:',
          placeholder: 'user@company.com',
        });

        const jiraApiToken = await prompts.password({
          message: 'Jira API Token:',
        });

        if (!prompts.isCancel(jiraHost) && !prompts.isCancel(jiraEmail) && !prompts.isCancel(jiraApiToken)) {
          enterpriseConfig.credentials = {
            ...enterpriseConfig.credentials,
            jira: {
              host: jiraHost,
              email: jiraEmail,
              apiToken: jiraApiToken,
            },
          };
        }
      }

      // Azure DevOps credentials
      const configureAzure = await prompts.confirm({
        message: 'Configure Azure DevOps integration?',
        initialValue: false,
      });

      if (!prompts.isCancel(configureAzure) && configureAzure) {
        const azureOrg = await prompts.text({
          message: 'Azure DevOps Organization:',
          placeholder: 'mycompany',
        });

        const azurePat = await prompts.password({
          message: 'Azure DevOps PAT:',
        });

        if (!prompts.isCancel(azureOrg) && !prompts.isCancel(azurePat)) {
          enterpriseConfig.credentials = {
            ...enterpriseConfig.credentials,
            azure: {
              organization: azureOrg,
              pat: azurePat,
            },
          };
        }
      }

      // Confluence credentials
      const configureConfluence = await prompts.confirm({
        message: 'Configure Confluence integration?',
        initialValue: false,
      });

      if (!prompts.isCancel(configureConfluence) && configureConfluence) {
        const confluenceHost = await prompts.text({
          message: 'Confluence Host:',
          placeholder: 'https://company.atlassian.net',
          validate: (value) => (value.startsWith('https://') ? undefined : 'Must start with https://'),
        });

        const confluenceEmail = await prompts.text({
          message: 'Confluence Email:',
          placeholder: 'user@company.com',
        });

        const confluenceApiToken = await prompts.password({
          message: 'Confluence API Token:',
        });

        if (
          !prompts.isCancel(confluenceHost) &&
          !prompts.isCancel(confluenceEmail) &&
          !prompts.isCancel(confluenceApiToken)
        ) {
          enterpriseConfig.credentials = {
            ...enterpriseConfig.credentials,
            confluence: {
              host: confluenceHost,
              email: confluenceEmail,
              apiToken: confluenceApiToken,
            },
          };
        }
      }
    }

    // Add enterprise MCP server to SnowCode config
    prompts.log.step('Configuring enterprise MCP server...');

    await addEnterpriseMcpServer(enterpriseConfig);

    prompts.log.success('✅ Enterprise MCP server configured');
    prompts.log.info('Enterprise tools are now available in SnowCode CLI');

    authLogger.info('Enterprise MCP server configuration completed');
  } catch (error: any) {
    prompts.log.error(`Enterprise configuration failed: ${error.message}`);
    authLogger.error(`Enterprise configuration error: ${error.message}`);
  }
}

/**
 * Update PROJECT-LEVEL MCP server config with ServiceNow credentials from auth.json
 *
 * IMPORTANT: This function ONLY updates project-level .mcp.json, NOT global config!
 * Each snow-flow project maintains its own isolated MCP configuration.
 */
async function updateMCPServerConfig() {
  try {
    // Read SnowCode auth.json
    const authPath = path.join(os.homedir(), '.local', 'share', 'snow-code', 'auth.json');

    // Check if auth.json exists
    try {
      await fs.access(authPath);
    } catch {
      authLogger.debug('auth.json does not exist yet, skipping MCP config update');
      return;
    }

    const authJson = JSON.parse(await fs.readFile(authPath, 'utf-8'));

    // Check if ServiceNow credentials exist
    const servicenowCreds = authJson['servicenow'];
    if (!servicenowCreds || servicenowCreds.type !== 'servicenow-oauth') {
      authLogger.debug('No ServiceNow OAuth credentials found in auth.json');
      return;
    }

    // Update PROJECT-LEVEL .mcp.json ONLY (no global config!)
    const projectMcpPath = path.join(process.cwd(), '.mcp.json');
    try {
      await fs.access(projectMcpPath);

      const projectMcp = JSON.parse(await fs.readFile(projectMcpPath, 'utf-8'));

      // Support both .mcpServers and .servers key formats (OpenCode vs Claude Desktop)
      const serversKey = projectMcp.mcpServers ? 'mcpServers' : 'servers';

      if (projectMcp[serversKey] && projectMcp[serversKey]['servicenow-unified']) {
        const server = projectMcp[serversKey]['servicenow-unified'];

        // Support both "environment" (OpenCode) and "env" (Claude Desktop) keys
        const envKey = server.environment !== undefined ? 'environment' : 'env';

        if (!server[envKey]) {
          server[envKey] = {};
        }

        // Update credentials in the environment object
        server[envKey]['SERVICENOW_INSTANCE_URL'] = servicenowCreds.instance;
        server[envKey]['SERVICENOW_CLIENT_ID'] = servicenowCreds.clientId;
        server[envKey]['SERVICENOW_CLIENT_SECRET'] = servicenowCreds.clientSecret;

        await fs.writeFile(projectMcpPath, JSON.stringify(projectMcp, null, 2), 'utf-8');

        prompts.log.success('✅ Updated project .mcp.json with ServiceNow credentials');
        authLogger.info('Project .mcp.json updated successfully');
      } else {
        authLogger.debug('No servicenow-unified MCP server found in project .mcp.json');
      }
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        authLogger.warn('Project .mcp.json not found. Run "snow-flow init" to create one.');
        prompts.log.warn('⚠️  No .mcp.json found in current directory');
        prompts.log.info('💡 Run: snow-flow init');
      } else {
        authLogger.debug(`Could not update project .mcp.json: ${err.message}`);
      }
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

        // Call SnowCode auth login for LLM providers and ServiceNow OAuth
        // (Enterprise configuration is now handled within snow-code auth login)
        execSync(`${snowcodeCommand} auth login`, { stdio: 'inherit' });

        // Update MCP server config with ServiceNow credentials
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
