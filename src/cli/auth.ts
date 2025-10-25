import { Command } from 'commander';
import * as prompts from '@clack/prompts';
import { ServiceNowOAuth } from '../utils/snow-oauth.js';
import { ServiceNowClient } from '../utils/servicenow-client.js';
import { Logger } from '../utils/logger.js';

const authLogger = new Logger('auth');

export function registerAuthCommands(program: Command) {
  const auth = program.command('auth').description('ServiceNow authentication management');

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
            console.log();
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
              console.log();
            });
          } else {
            prompts.log.warn('  No models available');
          }
        }
      }

      prompts.log.message('Tip: Use --provider to see models for a specific provider');
      prompts.log.message('Example: snow-flow auth models --provider anthropic');
    });

  auth
    .command('login')
    .description('Authenticate with LLM provider (Claude Pro/Max) and ServiceNow')
    .action(async () => {
      const { execSync } = require('child_process');
      const fs = require('fs');
      const path = require('path');
      const inquirer = require('inquirer');

      console.log(); // Empty line for spacing

      // Step 0: Check if we need LLM authentication
      let provider = process.env.DEFAULT_LLM_PROVIDER;

      // Check if ANY provider API key is configured
      const hasApiKey =
        (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim() !== '') ||
        (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') ||
        (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.trim() !== '') ||
        (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '') ||
        (process.env.MISTRAL_API_KEY && process.env.MISTRAL_API_KEY.trim() !== '');

      // Only do SnowCode auth if no API key is configured
      if (!hasApiKey) {
        // Check if snowcode is installed
        try {
          execSync('which snowcode', { stdio: 'ignore' });
        } catch {
          prompts.log.error('SnowCode is not installed');
          prompts.log.warn('Please install SnowCode first: npm install -g @groeimetai/snowcode');
          prompts.log.info('Or configure an API key in .env: ANTHROPIC_API_KEY=your-key');
          return;
        }

        prompts.intro('Starting authentication');

        // Fix common SnowCode directory issue (agents vs agent) in ALL possible directories
        try {
          const fs = require('fs');
          const path = require('path');

          const directoriesToFix = [
            // Fix 1: Global ~/.snowcode directory
            process.env.HOME + '/.snowcode',
            // Fix 2: Current working directory
            path.join(process.cwd(), '.snowcode'),
            // Fix 3: Parent directory (in case we're in a subdirectory)
            path.join(process.cwd(), '..', '.snowcode'),
            // Fix 4: Snow-flow package directory (for development)
            path.join(__dirname, '..', '..', '.snowcode')
          ];

          for (const snowcodeDir of directoriesToFix) {
            const agentsDir = path.join(snowcodeDir, 'agents');
            const agentDir = path.join(snowcodeDir, 'agent');

            if (fs.existsSync(agentsDir) && !fs.existsSync(agentDir)) {
              prompts.log.message(`   Fixing SnowCode directory structure in ${snowcodeDir}...`);
              try {
                fs.renameSync(agentsDir, agentDir);
              } catch (e) {
                // Ignore individual rename errors
              }
            }
          }
        } catch (dirError) {
          // Ignore directory fix errors - SnowCode will handle it
          prompts.log.message('   (Directory fix skipped - will auto-correct)');
        }

        try {
          // Run SnowCode auth login - prefer local installation (has platform binaries)
          const localSnowCode = path.join(process.cwd(), 'node_modules', '@groeimetai', 'snowcode', 'bin', 'snowcode');
          let snowcodeCommand = 'snowcode'; // fallback to global

          if (fs.existsSync(localSnowCode)) {
            prompts.log.message('   Using local SnowCode installation (with platform binaries)');
            snowcodeCommand = `"${localSnowCode}"`;
          } else {
            prompts.log.message('   Using global SnowCode installation');
          }

          execSync(`${snowcodeCommand} auth login`, { stdio: 'inherit' });
        } catch (error: any) {
          prompts.log.error('Authentication failed');

          // Check if it's the bun dependency error
          const errorMsg = error?.message || error?.toString() || '';
          if (errorMsg.includes('Cannot find package \'bun\'') || errorMsg.includes('ERR_MODULE_NOT_FOUND')) {
            prompts.log.warn('SnowCode dependency issue detected');
            prompts.log.message('   This is a known issue with SnowCode versions 0.15.18 and earlier');
            prompts.log.message('   Please update SnowCode to the latest version:');
            prompts.log.message('   npm update -g @groeimetai/snowcode');
            prompts.log.message('   Alternatively, use an API key instead:');
            prompts.log.message('   1. Add to .env: ANTHROPIC_API_KEY=your-api-key');
            prompts.log.message('   2. Then run: snow-flow auth login');
          } else if (errorMsg.includes('agents') && errorMsg.includes('agent')) {
            prompts.log.warn('SnowCode directory issue detected');
            prompts.log.message('   Run this fix: mv ~/.snowcode/agents ~/.snowcode/agent');
            prompts.log.message('   Then try: snow-flow auth login');
          } else {
            prompts.log.warn('You can try again later or use an API key instead');
            prompts.log.message('   Add to .env: ANTHROPIC_API_KEY=your-api-key');
          }
          return;
        }
      }

      // ServiceNow setup - continue the flow (maintain @clack/prompts styling)

      // Read credentials from .env file
      let instance = process.env.SNOW_INSTANCE;
      let authMethod = process.env.SNOW_AUTH_METHOD;

      // Check if we have complete credentials for either method
      const hasOAuthCreds = process.env.SNOW_CLIENT_ID && process.env.SNOW_CLIENT_SECRET;
      const hasBasicCreds = process.env.SNOW_USERNAME && process.env.SNOW_PASSWORD;
      const hasCompleteCredentials =
        instance && instance.includes('.service-now.com') &&
        ((authMethod === 'oauth' && hasOAuthCreds) || (authMethod === 'basic' && hasBasicCreds));

      // If no complete credentials, ask for auth method FIRST
      if (!hasCompleteCredentials) {
        const method = await prompts.select({
          message: 'Choose authentication method',
          options: [
            { value: 'oauth', label: 'OAuth 2.0', hint: 'recommended' },
            { value: 'basic', label: 'Basic Auth', hint: 'username/password' }
          ]
        });

        if (prompts.isCancel(method)) {
          prompts.cancel('Setup cancelled');
          process.exit(0);
        }

        authMethod = method as string;

        // Ask for ServiceNow instance (common for both methods)
        instance = await prompts.text({
          message: 'ServiceNow instance',
          placeholder: 'dev12345.service-now.com',
          defaultValue: instance || '',
          validate: (value) => {
            if (!value || value.trim() === '') return 'Instance URL is required';
            const cleaned = value.replace(/^https?:\/\//, '').replace(/\/$/, '');
            if (!cleaned.includes('.service-now.com')) {
              return 'Must be a ServiceNow domain (e.g., dev12345.service-now.com)';
            }
          }
        }) as string;

        if (prompts.isCancel(instance)) {
          prompts.cancel('Setup cancelled');
          process.exit(0);
        }

        instance = instance.replace(/^https?:\/\//, '').replace(/\/$/, '');
      }

      // OAuth 2.0 Flow
      if (authMethod === 'oauth') {
        const oauth = new ServiceNowOAuth();
        let clientId = process.env.SNOW_CLIENT_ID;
        let clientSecret = process.env.SNOW_CLIENT_SECRET;

        // Check if OAuth credentials need to be collected
        const needsCredentials = !clientId || !clientSecret || clientId.length < 32 || clientSecret.length < 32;

        // If credentials are missing, prompt for them
        if (needsCredentials) {
        // OAuth Client ID
        clientId = await prompts.text({
          message: 'OAuth Client ID',
          placeholder: '32-character hex string from ServiceNow',
          defaultValue: clientId || '',
          validate: (value) => {
            if (!value || value.trim() === '') return 'Client ID is required';
            if (value.length < 32) return 'Client ID too short (expected 32+ characters)';
          }
        }) as string;

        if (prompts.isCancel(clientId)) {
          prompts.cancel('Setup cancelled');
          process.exit(0);
        }

        // OAuth Client Secret
        clientSecret = await prompts.password({
          message: 'OAuth Client Secret',
          validate: (value) => {
            if (!value || value.trim() === '') return 'Client Secret is required';
            if (value.length < 32) return 'Client Secret too short (expected 32+ characters)';
          }
        }) as string;

        if (prompts.isCancel(clientSecret)) {
          prompts.cancel('Setup cancelled');
          process.exit(0);
        }

        // Save to .env file
        const envPath = path.join(process.cwd(), '.env');
        let envContent = '';

        try {
          envContent = fs.readFileSync(envPath, 'utf8');
        } catch {
          const examplePath = path.join(process.cwd(), '.env.example');
          if (fs.existsSync(examplePath)) {
            envContent = fs.readFileSync(examplePath, 'utf8');
          }
        }

          // Update credentials
          const updates = [
            { key: 'SNOW_INSTANCE', value: instance },
            { key: 'SNOW_AUTH_METHOD', value: 'oauth' },
            { key: 'SNOW_CLIENT_ID', value: clientId },
            { key: 'SNOW_CLIENT_SECRET', value: clientSecret }
          ];

          for (const { key, value } of updates) {
            if (envContent.includes(`${key}=`)) {
              envContent = envContent.replace(new RegExp(`${key}=.*`, 'g'), `${key}=${value}`);
            } else {
              envContent += `\n${key}=${value}\n`;
            }
          }

          fs.writeFileSync(envPath, envContent);

          process.env.SNOW_INSTANCE = instance;
          process.env.SNOW_AUTH_METHOD = 'oauth';
          process.env.SNOW_CLIENT_ID = clientId;
          process.env.SNOW_CLIENT_SECRET = clientSecret;
        }

        // Start OAuth flow with simplified code paste flow (Claude-style)
        const result = await oauth.authenticateWithCodePaste(instance, clientId, clientSecret);

        if (result.success) {
          prompts.log.success('ServiceNow authentication successful');

          // Test connection
          const client = new ServiceNowClient();
          const testResult = await client.testConnection();
          if (testResult.success) {
            prompts.log.success(`Logged in as: ${testResult.data.name} (${testResult.data.user_name})`);
          }

          // 🔧 Auto-refresh MCP configuration with new credentials
          try {
            const { setupMCPConfig } = await import('../cli.js');
            const spinner2 = prompts.spinner();
            spinner2.start('Updating MCP configuration');
            await setupMCPConfig(process.cwd(), instance, clientId, clientSecret, true);
            spinner2.stop('MCP servers ready for SnowCode/Claude Code');
          } catch (error) {
            prompts.log.warn('Could not update MCP config - run "snow-flow init" to set up');
          }

          prompts.outro('Setup complete!');
        } else {
          prompts.cancel(result.error || 'Unknown error');
          process.exit(1);
        }
      }
      // Basic Auth Flow
      else if (authMethod === 'basic') {
        let username = process.env.SNOW_USERNAME;
        let password = process.env.SNOW_PASSWORD;

        // Check if Basic Auth credentials need to be collected
        const needsCredentials = !username || !password || username.trim() === '' || password.trim() === '';

        if (needsCredentials) {
          // Username
          username = await prompts.text({
            message: 'ServiceNow username',
            placeholder: 'admin',
            defaultValue: username || '',
            validate: (value) => {
              if (!value || value.trim() === '') return 'Username is required';
            }
          }) as string;

          if (prompts.isCancel(username)) {
            prompts.cancel('Setup cancelled');
            process.exit(0);
          }

          // Password
          password = await prompts.password({
            message: 'ServiceNow password',
            validate: (value) => {
              if (!value || value.trim() === '') return 'Password is required';
            }
          }) as string;

          if (prompts.isCancel(password)) {
            prompts.cancel('Setup cancelled');
            process.exit(0);
          }

          // Save to .env file
          const envPath = path.join(process.cwd(), '.env');
          let envContent = '';

          try {
            envContent = fs.readFileSync(envPath, 'utf8');
          } catch {
            const examplePath = path.join(process.cwd(), '.env.example');
            if (fs.existsSync(examplePath)) {
              envContent = fs.readFileSync(examplePath, 'utf8');
            }
          }

          // Update credentials
          const updates = [
            { key: 'SNOW_INSTANCE', value: instance },
            { key: 'SNOW_AUTH_METHOD', value: 'basic' },
            { key: 'SNOW_USERNAME', value: username },
            { key: 'SNOW_PASSWORD', value: password }
          ];

          for (const { key, value } of updates) {
            if (envContent.includes(`${key}=`)) {
              envContent = envContent.replace(new RegExp(`${key}=.*`, 'g'), `${key}=${value}`);
            } else {
              envContent += `\n${key}=${value}\n`;
            }
          }

          fs.writeFileSync(envPath, envContent);

          process.env.SNOW_INSTANCE = instance;
          process.env.SNOW_AUTH_METHOD = 'basic';
          process.env.SNOW_USERNAME = username;
          process.env.SNOW_PASSWORD = password;
        }

        // Test Basic Auth connection
        const spinner = prompts.spinner();
        spinner.start('Authenticating with ServiceNow');

        const client = new ServiceNowClient();
        const testResult = await client.testConnection();

        if (testResult.success) {
          spinner.stop('ServiceNow authentication successful');
          prompts.log.success(`Logged in as: ${testResult.data.name} (${testResult.data.user_name})`);

          // 🔧 Auto-refresh MCP configuration with new credentials
          try {
            const { setupMCPConfig } = await import('../cli.js');
            const spinner2 = prompts.spinner();
            spinner2.start('Updating MCP configuration');
            await setupMCPConfig(process.cwd(), instance, username, password, true);
            spinner2.stop('MCP servers ready for SnowCode/Claude Code');
          } catch (error) {
            prompts.log.warn('Could not update MCP config - run "snow-flow init" to set up');
          }

          prompts.outro('Setup complete!');
        } else {
          spinner.stop('Authentication failed');
          prompts.cancel(testResult.error || 'Invalid credentials');
          process.exit(1);
        }
      }
    });

  auth
    .command('logout')
    .description('Logout from ServiceNow')
    .action(async () => {
      const oauth = new ServiceNowOAuth();
      await oauth.logout();
      prompts.log.success('Logged out successfully');
    });

  auth
    .command('status')
    .description('Show ServiceNow authentication status')
    .action(async () => {
      const oauth = new ServiceNowOAuth();
      prompts.log.step('ServiceNow Authentication Status');

      const isAuthenticated = await oauth.isAuthenticated();
      const credentials = await oauth.loadCredentials();

      if (isAuthenticated && credentials) {
        prompts.log.success('Status: Authenticated');
        prompts.log.info(`Instance: ${credentials.instance}`);
        prompts.log.info('Method: OAuth 2.0');
        prompts.log.info(`Client ID: ${credentials.clientId}`);

        if (credentials.expiresAt) {
          const expiresAt = new Date(credentials.expiresAt);
          prompts.log.info(`Token expires: ${expiresAt.toLocaleString()}`);
        }

        // Test connection
        const spinner = prompts.spinner();
        spinner.start('Testing connection');
        const client = new ServiceNowClient();
        const testResult = await client.testConnection();
        if (testResult.success) {
          spinner.stop('Connection test successful');
          if (testResult.data.message) {
            prompts.log.message(`   ${testResult.data.message}`);
          }
          prompts.log.info(`Instance: ${testResult.data.email || credentials.instance}`);
        } else {
          spinner.stop('Connection test failed');
          prompts.log.error(`Error: ${testResult.error}`);
        }
      } else {
        prompts.log.error('Status: Not authenticated');
        prompts.log.message('Instance: Not configured');
        prompts.log.message('Method: Not set');
        prompts.log.message('');
        prompts.log.info('Create .env file and run "snow-flow auth login"');
      }
    });
}