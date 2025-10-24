import { Command } from 'commander';
import chalk from 'chalk';
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

      console.log(chalk.blue('\n🤖 Available LLM Models\n'));

      if (options.provider) {
        // List models for specific provider
        console.log(chalk.cyan(`${options.provider.toUpperCase()}:\n`));
        const models = await getProviderModels(options.provider);

        if (models.length > 0) {
          models.forEach((model, i) => {
            console.log(`  ${i + 1}. ${chalk.white(model.name)}`);
            console.log(`     ${chalk.dim('ID:')} ${chalk.yellow(model.value)}`);
            if (model.contextWindow) {
              console.log(`     ${chalk.dim('Context:')} ${chalk.green(model.contextWindow.toLocaleString() + ' tokens')}`);
            }
            console.log();
          });
        } else {
          console.log(chalk.yellow('  No models available for this provider\n'));
        }
      } else {
        // List all providers
        const allModels = await getAllProviderModels();

        for (const [provider, models] of Object.entries(allModels)) {
          console.log(chalk.cyan(`${provider.toUpperCase()}:\n`));

          if (models.length > 0) {
            models.forEach((model, i) => {
              console.log(`  ${i + 1}. ${chalk.white(model.name)}`);
              console.log(`     ${chalk.dim('ID:')} ${chalk.yellow(model.value)}`);
              console.log();
            });
          } else {
            console.log(chalk.yellow('  No models available\n'));
          }
        }
      }

      console.log(chalk.dim('💡 Tip: Use --provider to see models for a specific provider'));
      console.log(chalk.dim('Example: snow-flow auth models --provider anthropic\n'));
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
          console.error(chalk.red('❌ SnowCode is not installed'));
          console.log(chalk.yellow('Please install SnowCode first: ') + chalk.cyan('npm install -g @groeimetai/snowcode'));
          console.log(chalk.blue('Or configure an API key in .env: ') + chalk.cyan('ANTHROPIC_API_KEY=your-key'));
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
              console.log(chalk.dim(`   Fixing SnowCode directory structure in ${snowcodeDir}...`));
              try {
                fs.renameSync(agentsDir, agentDir);
              } catch (e) {
                // Ignore individual rename errors
              }
            }
          }
        } catch (dirError) {
          // Ignore directory fix errors - SnowCode will handle it
          console.log(chalk.dim('   (Directory fix skipped - will auto-correct)'));
        }

        try {
          // Run SnowCode auth login - it will handle provider and model selection
          execSync('snowcode auth login', { stdio: 'inherit' });
        } catch (error: any) {
          console.error(chalk.red('\n❌ Authentication failed'));

          // Check if it's the bun dependency error
          const errorMsg = error?.message || error?.toString() || '';
          if (errorMsg.includes('Cannot find package \'bun\'') || errorMsg.includes('ERR_MODULE_NOT_FOUND')) {
            console.log(chalk.yellow('\n⚠️  SnowCode dependency issue detected'));
            console.log(chalk.blue('   This is a known issue with SnowCode versions 0.15.18 and earlier'));
            console.log(chalk.blue('   Please update SnowCode to the latest version:'));
            console.log(chalk.cyan('   npm update -g @groeimetai/snowcode'));
            console.log(chalk.blue('\n   Alternatively, use an API key instead:'));
            console.log(chalk.cyan('   1. Add to .env: ANTHROPIC_API_KEY=your-api-key'));
            console.log(chalk.cyan('   2. Then run: snow-flow auth login'));
          } else if (errorMsg.includes('agents') && errorMsg.includes('agent')) {
            console.log(chalk.yellow('\n⚠️  SnowCode directory issue detected'));
            console.log(chalk.blue('   Run this fix: ') + chalk.cyan('mv ~/.snowcode/agents ~/.snowcode/agent'));
            console.log(chalk.blue('   Then try: ') + chalk.cyan('snow-flow auth login'));
          } else {
            console.log(chalk.yellow('💡 You can try again later or use an API key instead'));
            console.log(chalk.blue('   Add to .env: ') + chalk.cyan('ANTHROPIC_API_KEY=your-api-key'));
          }
          return;
        }
      }

      // ServiceNow setup - continue the flow

      // Read credentials from .env file
      let instance = process.env.SNOW_INSTANCE;
      let authMethod = process.env.SNOW_AUTH_METHOD || 'oauth';

      // Check if we need to ask for auth method
      const hasOAuthCreds = process.env.SNOW_CLIENT_ID && process.env.SNOW_CLIENT_SECRET;
      const hasBasicCreds = process.env.SNOW_USERNAME && process.env.SNOW_PASSWORD;

      // If no credentials at all, ask for auth method
      if (!hasOAuthCreds && !hasBasicCreds) {
        const method = await prompts.select({
          message: 'ServiceNow authentication method',
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
      }

      // OAuth 2.0 Flow
      if (authMethod === 'oauth') {
        const oauth = new ServiceNowOAuth();
        let clientId = process.env.SNOW_CLIENT_ID;
        let clientSecret = process.env.SNOW_CLIENT_SECRET;

        // Validate OAuth credentials
        const credentialsValid =
          instance && instance.trim() !== '' && instance.includes('.service-now.com') &&
          clientId && clientId.trim() !== '' && clientId.length >= 32 &&
          clientSecret && clientSecret.trim() !== '' && clientSecret.length >= 32;

        // If credentials are missing or invalid, prompt with @clack
        if (!credentialsValid) {
        // ServiceNow instance
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

        // Start OAuth flow
        const spinner = prompts.spinner();
        spinner.start('Authenticating with ServiceNow');

        const result = await oauth.authenticate(instance, clientId, clientSecret);

        if (result.success) {
          spinner.stop('ServiceNow authentication successful');

          // Test connection
          const client = new ServiceNowClient();
          const testResult = await client.testConnection();
          if (testResult.success) {
            prompts.log.success(`Logged in as: ${testResult.data.name} (${testResult.data.user_name})`);
          }

          prompts.outro('Setup complete!');
        } else {
          spinner.stop('Authentication failed');
          prompts.cancel(result.error || 'Unknown error');
          process.exit(1);
        }
      }
      // Basic Auth Flow
      else if (authMethod === 'basic') {
        let username = process.env.SNOW_USERNAME;
        let password = process.env.SNOW_PASSWORD;

        // Validate Basic Auth credentials
        const credentialsValid =
          instance && instance.trim() !== '' && instance.includes('.service-now.com') &&
          username && username.trim() !== '' &&
          password && password.trim() !== '';

        if (!credentialsValid) {
          // ServiceNow instance
          if (!instance || !instance.includes('.service-now.com')) {
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
      console.log(chalk.green('✅ Logged out successfully'));
    });

  auth
    .command('status')
    .description('Show ServiceNow authentication status')
    .action(async () => {
      const oauth = new ServiceNowOAuth();
      console.log(chalk.blue('\n📊 ServiceNow Authentication Status:'));

      const isAuthenticated = await oauth.isAuthenticated();
      const credentials = await oauth.loadCredentials();
      
      if (isAuthenticated && credentials) {
        console.log('   ├── Status: ✅ Authenticated');
        console.log(`   ├── Instance: ${credentials.instance}`);
        console.log('   ├── Method: OAuth 2.0');
        console.log(`   ├── Client ID: ${credentials.clientId}`);
        
        if (credentials.expiresAt) {
          const expiresAt = new Date(credentials.expiresAt);
          console.log(`   └── Token expires: ${expiresAt.toLocaleString()}`);
        }
        
        // Test connection
        const client = new ServiceNowClient();
        const testResult = await client.testConnection();
        if (testResult.success) {
          console.log(`\n🔍 Connection test: ✅ Success`);
          if (testResult.data.message) {
            console.log(`   ${testResult.data.message}`);
          }
          console.log(`🌐 Instance: ${testResult.data.email || credentials.instance}`);
        } else {
          console.log(`\n🔍 Connection test: ❌ Failed`);
          console.log(`   Error: ${testResult.error}`);
        }
      } else {
        console.log('   ├── Status: ❌ Not authenticated');
        console.log('   ├── Instance: Not configured');
        console.log('   └── Method: Not set');
        console.log('\n💡 Create .env file and run "snow-flow auth login"');
      }
    });
}