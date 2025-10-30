import { Command } from 'commander';
import * as prompts from '@clack/prompts';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Logger } from '../utils/logger.js';

const authLogger = new Logger('auth');

/**
 * Configure Snow-Flow Enterprise MCP server after authentication
 * Only adds enterprise server if user provides valid credentials
 */
async function configureEnterpriseIfNeeded(): Promise<void> {
  const snowcodeConfigPath = path.join(os.homedir(), '.snowcode', 'snowcode.json');

  if (!fs.existsSync(snowcodeConfigPath)) {
    authLogger.debug('No snowcode config found, skipping enterprise setup');
    return;
  }

  prompts.log.message('');
  prompts.log.step('🔧 Configuring Snow-Flow MCP servers...');

  try {
    const config = JSON.parse(fs.readFileSync(snowcodeConfigPath, 'utf8'));

    // Ensure MCP section exists
    if (!config.mcp) {
      config.mcp = {};
    }

    // Remove enterprise server if it exists (we'll re-add only if user has credentials)
    if (config.mcp['snow-flow-enterprise']) {
      delete config.mcp['snow-flow-enterprise'];
      authLogger.debug('Removed default enterprise server placeholder');
    }

    // Ask user about enterprise credentials
    const hasEnterprise = await prompts.confirm({
      message: 'Do you have Snow-Flow Enterprise credentials?',
      initialValue: false
    });

    if (prompts.isCancel(hasEnterprise)) {
      authLogger.debug('User cancelled enterprise setup');
      // Save config without enterprise
      fs.writeFileSync(snowcodeConfigPath, JSON.stringify(config, null, 2));
      return;
    }

    if (hasEnterprise) {
      // User has enterprise - ask for JWT token
      const jwtToken = await prompts.text({
        message: 'Enter your Snow-Flow Enterprise JWT token:',
        placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        validate: (value) => {
          if (!value || value.trim().length === 0) {
            return 'JWT token is required';
          }
          if (!value.startsWith('eyJ')) {
            return 'Invalid JWT token format (should start with "eyJ")';
          }
          return;
        }
      });

      if (prompts.isCancel(jwtToken)) {
        authLogger.debug('User cancelled JWT token entry');
        fs.writeFileSync(snowcodeConfigPath, JSON.stringify(config, null, 2));
        return;
      }

      // Add enterprise server with real credentials
      config.mcp['snow-flow-enterprise'] = {
        type: 'remote',
        url: 'https://enterprise.snow-flow.dev/mcp/sse',
        headers: {
          Authorization: `Bearer ${jwtToken}`
        },
        enabled: true
      };

      authLogger.info('Enterprise server configured with provided credentials');
      prompts.log.success('✅ Snow-Flow Enterprise enabled!');
      prompts.log.info('   You now have access to 26+ integration tools (Jira, Azure DevOps, Confluence)');
    } else {
      // User doesn't have enterprise - ensure it's not in config
      authLogger.debug('User does not have enterprise credentials, keeping config clean');
      prompts.log.info('📦 Configured 2 MCP servers:');
      prompts.log.message('   • servicenow-unified (235+ ServiceNow tools)');
      prompts.log.message('   • snow-flow-orchestration (Swarm coordination)');
      prompts.log.message('');
      prompts.log.info('💡 Want enterprise features? Visit: https://snow-flow.dev/pricing');
    }

    // Save updated config
    fs.writeFileSync(snowcodeConfigPath, JSON.stringify(config, null, 2));
    authLogger.debug('SnowCode config updated successfully');

  } catch (error: any) {
    authLogger.error('Failed to configure enterprise:', error.message);
    prompts.log.warn('⚠️  Could not configure enterprise server. You can add it manually later.');
    prompts.log.info('   See: ENTERPRISE-SETUP.md for instructions');
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
          execSync('which snowcode', { stdio: 'ignore' });
        } catch {
          prompts.log.error('SnowCode is not installed');
          prompts.log.warn('Please run: npm install -g snow-flow');
          prompts.log.info('This will install both snow-flow and snowcode');
          return;
        }

        // Determine which SnowCode to use: prefer local, fallback to global
        const localSnowCode = path.join(process.cwd(), 'node_modules', '@groeimetai', 'snowcode', 'bin', 'snowcode');
        let snowcodeCommand = 'snowcode'; // fallback to global

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

        // Call SnowCode auth login - it handles everything now!
        execSync(`${snowcodeCommand} auth login`, { stdio: 'inherit' });

        prompts.log.message('');
        prompts.log.success('✅ Authentication complete!');

        // Post-auth: Configure Snow-Flow Enterprise (optional)
        await configureEnterpriseIfNeeded();

        prompts.log.message('');
        prompts.log.info('Next steps:');
        prompts.log.message('  • Run: snow-flow swarm "<objective>" to start developing');
        prompts.log.message('  • Run: snow-flow auth list to see configured credentials');
        prompts.log.message('');
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          prompts.log.error(`Authentication failed: ${error.message}`);
        }
      }
    });

  // List credentials
  auth
    .command('list')
    .alias('ls')
    .description('List configured credentials (via SnowCode)')
    .action(async () => {
      try {
        execSync('snowcode auth list', { stdio: 'inherit' });
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
        execSync('snowcode auth logout', { stdio: 'inherit' });
      } catch (error: any) {
        prompts.log.error('SnowCode is not installed. Run: npm install -g snow-flow');
      }
    });
}
