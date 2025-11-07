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
 * Update MCP server config with ServiceNow credentials from auth.json
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

    // Update servicenow-unified MCP server environment variables in GLOBAL config
    if (config.mcp['servicenow-unified']) {
      if (!config.mcp['servicenow-unified'].environment) {
        config.mcp['servicenow-unified'].environment = {};
      }

      config.mcp['servicenow-unified'].environment['SERVICENOW_INSTANCE_URL'] = servicenowCreds.instance;
      config.mcp['servicenow-unified'].environment['SERVICENOW_CLIENT_ID'] = servicenowCreds.clientId;
      config.mcp['servicenow-unified'].environment['SERVICENOW_CLIENT_SECRET'] = servicenowCreds.clientSecret;

      // Write updated config
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

      prompts.log.success('✅ Updated global MCP server config');
      authLogger.info('Global MCP server config updated successfully');
    } else {
      authLogger.debug('No servicenow-unified MCP server found in global config');
    }

    // ALSO update PROJECT-LEVEL .mcp.json if it exists
    const projectMcpPath = path.join(process.cwd(), '.mcp.json');
    try {
      await fs.access(projectMcpPath);

      const projectMcp = JSON.parse(await fs.readFile(projectMcpPath, 'utf-8'));

      if (projectMcp.mcpServers && projectMcp.mcpServers['servicenow-unified']) {
        if (!projectMcp.mcpServers['servicenow-unified'].env) {
          projectMcp.mcpServers['servicenow-unified'].env = {};
        }

        projectMcp.mcpServers['servicenow-unified'].env['SERVICENOW_INSTANCE_URL'] = servicenowCreds.instance;
        projectMcp.mcpServers['servicenow-unified'].env['SERVICENOW_CLIENT_ID'] = servicenowCreds.clientId;
        projectMcp.mcpServers['servicenow-unified'].env['SERVICENOW_CLIENT_SECRET'] = servicenowCreds.clientSecret;

        await fs.writeFile(projectMcpPath, JSON.stringify(projectMcp, null, 2), 'utf-8');

        prompts.log.success('✅ Updated project .mcp.json with ServiceNow credentials');
        authLogger.info('Project .mcp.json updated successfully');
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        authLogger.debug(`Could not update project .mcp.json: ${err.message}`);
      }
      // File doesn't exist or couldn't be updated - not critical
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
