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

  auth
    .command('login')
    .description('Authenticate with LLM provider (Claude Pro/Max) and ServiceNow')
    .action(async () => {
      const { execSync } = require('child_process');
      const fs = require('fs');
      const path = require('path');
      const inquirer = require('inquirer');

      prompts.log.message(''); // Empty line for spacing

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

        // Determine which SnowCode to use: prefer local, fallback to global
        const localSnowCode = path.join(process.cwd(), 'node_modules', '@groeimetai', 'snowcode', 'bin', 'snowcode');
        let snowcodeCommand = 'snowcode'; // fallback to global

        if (fs.existsSync(localSnowCode)) {
          snowcodeCommand = `"${localSnowCode}"`;
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
          // Run SnowCode auth login - reuse snowcodeCommand from version check
          if (fs.existsSync(localSnowCode)) {
            prompts.log.message('   Using local SnowCode installation (with platform binaries)');
          } else {
            prompts.log.message('   Using global SnowCode installation');
          }

          // Run SnowCode auth (use inherit for interactive prompt)
          try {
            execSync(`${snowcodeCommand} auth login`, { stdio: 'inherit' });

            // Success - reload environment variables from .env if it exists
            const envPath = path.join(process.cwd(), '.env');
            if (fs.existsSync(envPath)) {
              const envContent = fs.readFileSync(envPath, 'utf-8');
              envContent.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                  const [key, ...valueParts] = trimmed.split('=');
                  if (key && valueParts.length > 0) {
                    process.env[key.trim()] = valueParts.join('=').trim();
                  }
                }
              });
            }

            // Success - now continue to ServiceNow setup
            prompts.log.message(''); // Empty line
            prompts.log.step('Continuing to ServiceNow authentication...');
            prompts.log.message(''); // Empty line
          } catch (authError: any) {
            // Auth failed (user cancelled or other error)
            prompts.log.message(''); // Empty line
            prompts.log.warn('SnowCode authentication was not completed');
            prompts.log.message(''); // Empty line
            prompts.log.message('You can continue with API keys instead:');
            prompts.log.message('   1. Get an Anthropic API key from https://console.anthropic.com');
            prompts.log.message('   2. Add to .env: ANTHROPIC_API_KEY=your-api-key');
            prompts.log.message('   3. Run: snow-flow auth login');
            prompts.log.message(''); // Empty line
            return;
          }
        } catch (error: any) {
          // Unexpected error (not from execSync)
          prompts.log.error('Unexpected error during authentication');
          prompts.log.message(error?.message || String(error));
          return;
        }
      }

      // ServiceNow setup - continue the flow (maintain @clack/prompts styling)
      prompts.intro('ServiceNow Authentication');

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

        // Start OAuth flow with localhost callback server
        const result = await oauth.authenticate(instance, clientId, clientSecret);

        if (result.success) {
          prompts.log.success('ServiceNow authentication successful');

          // Test connection
          const client = new ServiceNowClient();
          const testResult = await client.testConnection();
          if (testResult.success) {
            prompts.log.success(`Logged in as: ${testResult.data.name} (${testResult.data.user_name})`);
          }

          // 🔧 Auto-refresh MCP configuration with new credentials
          const spinner2 = prompts.spinner();
          try {
            const { setupMCPConfig } = await import('../cli.js');
            spinner2.start('Updating MCP configuration');
            await setupMCPConfig(process.cwd(), instance, clientId, clientSecret, true);
            spinner2.stop('MCP servers ready for SnowCode/Claude Code');
          } catch (error) {
            spinner2.stop('MCP configuration update failed');
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
          const spinner2 = prompts.spinner();
          try {
            const { setupMCPConfig } = await import('../cli.js');
            spinner2.start('Updating MCP configuration');
            await setupMCPConfig(process.cwd(), instance, username, password, true);
            spinner2.stop('MCP servers ready for SnowCode/Claude Code');
          } catch (error) {
            spinner2.stop('MCP configuration update failed');
            prompts.log.warn('Could not update MCP config - run "snow-flow init" to set up');
          }

          prompts.outro('Setup complete!');
        } else {
          spinner.stop('Authentication failed');
          prompts.cancel(testResult.error || 'Invalid credentials');
          process.exit(1);
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      // 🚀 ENTERPRISE FEATURES SETUP (Optional)
      // ═══════════════════════════════════════════════════════════════════

      prompts.log.message(''); // Spacing
      prompts.log.step('Enterprise Features (Optional)');

      const hasEnterprise = await prompts.confirm({
        message: 'Do you have a Snow-Flow Enterprise license?',
        initialValue: false
      });

      if (prompts.isCancel(hasEnterprise) || !hasEnterprise) {
        prompts.log.info('Skipping enterprise setup - you can add it later with "snow-flow auth login"');
        prompts.outro('Setup complete!');
        return;
      }

      // Enterprise license key
      const licenseKey = await prompts.text({
        message: 'Enterprise license key',
        placeholder: 'SNOW-ENT-1-ABC123 or SNOW-ENT-SI-ABC123',
        validate: (value) => {
          if (!value || value.trim() === '') return 'License key is required';
          if (!value.startsWith('SNOW-')) return 'Invalid format (should start with SNOW-)';
          const parts = value.split('-');
          // Accept both formats:
          // Old: SNOW-TIER-ORG-DATE-HASH (5 parts)
          // New: SNOW-ENT-CUST-HASH or SNOW-ENT-SI-HASH (4 parts)
          if (parts.length !== 4 && parts.length !== 5) {
            return 'Invalid format (expected: SNOW-ENT-1-HASH or SNOW-ENT-SI-HASH)';
          }
          // For 4-part format, ensure it's ENT type
          if (parts.length === 4 && parts[1] !== 'ENT') {
            return 'Invalid format (second part must be ENT)';
          }
        }
      }) as string;

      if (prompts.isCancel(licenseKey)) {
        prompts.log.info('Enterprise setup skipped');
        prompts.outro('Setup complete!');
        return;
      }

      // License server URL (with sensible default)
      let licenseServerUrl = await prompts.text({
        message: 'Enterprise license server URL',
        placeholder: 'https://license.snow-flow.dev (default)',
        defaultValue: 'https://license.snow-flow.dev',
        validate: (value) => {
          // Allow empty - will use default
          if (!value || value.trim() === '') return undefined;
          if (!value.startsWith('https://')) return 'Must be HTTPS URL';
        }
      }) as string;

      // Apply default if empty
      if (!licenseServerUrl || licenseServerUrl.trim() === '') {
        licenseServerUrl = 'https://license.snow-flow.dev';
      }

      if (prompts.isCancel(licenseServerUrl)) {
        prompts.log.info('Enterprise setup skipped');
        prompts.outro('Setup complete!');
        return;
      }

      // Ask which integrations to configure
      const integrations = await prompts.multiselect({
        message: 'Configure integrations (optional)',
        options: [
          { value: 'jira', label: 'Jira', hint: 'Atlassian Jira Cloud' },
          { value: 'azdo', label: 'Azure DevOps', hint: 'Microsoft Azure DevOps' },
          { value: 'confluence', label: 'Confluence', hint: 'Atlassian Confluence' }
        ],
        required: false
      }) as string[];

      const enterpriseEnv: Record<string, string> = {
        SNOW_LICENSE_KEY: licenseKey,
        SNOW_ENTERPRISE_URL: licenseServerUrl
      };

      // Jira credentials
      if (integrations && integrations.includes('jira')) {
        prompts.log.message('Jira Configuration');

        const jiraHost = await prompts.text({
          message: 'Jira host',
          placeholder: 'yourcompany.atlassian.net',
          validate: (v) => v && v.includes('.') ? undefined : 'Invalid host'
        }) as string;

        if (!prompts.isCancel(jiraHost)) {
          const jiraEmail = await prompts.text({
            message: 'Jira email',
            placeholder: 'you@company.com',
            validate: (v) => v && v.includes('@') ? undefined : 'Invalid email'
          }) as string;

          if (!prompts.isCancel(jiraEmail)) {
            const jiraToken = await prompts.password({
              message: 'Jira API token',
              validate: (v) => v && v.length > 10 ? undefined : 'Token required'
            }) as string;

            if (!prompts.isCancel(jiraToken)) {
              enterpriseEnv.JIRA_BASE_URL = `https://${jiraHost}`;
              enterpriseEnv.JIRA_EMAIL = jiraEmail;
              enterpriseEnv.JIRA_API_TOKEN = jiraToken;
              prompts.log.success('Jira configured');
            }
          }
        }
      }

      // Azure DevOps credentials
      if (integrations && integrations.includes('azdo')) {
        prompts.log.message('Azure DevOps Configuration');

        const azdoOrg = await prompts.text({
          message: 'Azure DevOps organization',
          placeholder: 'yourcompany',
          validate: (v) => v && v.length > 0 ? undefined : 'Organization required'
        }) as string;

        if (!prompts.isCancel(azdoOrg)) {
          const azdoPat = await prompts.password({
            message: 'Azure DevOps Personal Access Token (PAT)',
            validate: (v) => v && v.length > 20 ? undefined : 'PAT required'
          }) as string;

          if (!prompts.isCancel(azdoPat)) {
            enterpriseEnv.AZDO_ORG_URL = `https://dev.azure.com/${azdoOrg}`;
            enterpriseEnv.AZDO_PAT = azdoPat;
            prompts.log.success('Azure DevOps configured');
          }
        }
      }

      // Confluence credentials
      if (integrations && integrations.includes('confluence')) {
        prompts.log.message('Confluence Configuration');

        const confluenceHost = await prompts.text({
          message: 'Confluence host',
          placeholder: 'yourcompany.atlassian.net',
          validate: (v) => v && v.includes('.') ? undefined : 'Invalid host'
        }) as string;

        if (!prompts.isCancel(confluenceHost)) {
          const confluenceEmail = await prompts.text({
            message: 'Confluence email',
            placeholder: 'you@company.com',
            validate: (v) => v && v.includes('@') ? undefined : 'Invalid email'
          }) as string;

          if (!prompts.isCancel(confluenceEmail)) {
            const confluenceToken = await prompts.password({
              message: 'Confluence API token',
              validate: (v) => v && v.length > 10 ? undefined : 'Token required'
            }) as string;

            if (!prompts.isCancel(confluenceToken)) {
              enterpriseEnv.CONFLUENCE_BASE_URL = `https://${confluenceHost}`;
              enterpriseEnv.CONFLUENCE_EMAIL = confluenceEmail;
              enterpriseEnv.CONFLUENCE_API_TOKEN = confluenceToken;
              prompts.log.success('Confluence configured');
            }
          }
        }
      }

      // Save enterprise credentials to .env
      const envPath = path.join(process.cwd(), '.env');
      let envContent = '';

      try {
        envContent = fs.readFileSync(envPath, 'utf8');
      } catch {
        // File doesn't exist, will create
      }

      for (const [key, value] of Object.entries(enterpriseEnv)) {
        if (envContent.includes(`${key}=`)) {
          envContent = envContent.replace(new RegExp(`${key}=.*`, 'g'), `${key}=${value}`);
        } else {
          envContent += `\n${key}=${value}\n`;
        }
        process.env[key] = value;
      }

      fs.writeFileSync(envPath, envContent);
      prompts.log.success('Enterprise credentials saved to .env');

      // Configure enterprise MCP proxy (only for Service Integrators)
      const isServiceIntegrator = licenseKey.includes('-SI-');
      const isCustomer = !isServiceIntegrator;

      if (isCustomer) {
        // Customers use remote server only - no proxy needed
        prompts.log.success('Enterprise configuration complete');
        prompts.log.info('Using remote enterprise server: ' + licenseServerUrl);
      } else {
        // Service Integrators can use local proxy OR remote server
        const spinner3 = prompts.spinner();
        spinner3.start('Configuring enterprise MCP proxy');

        try {
          // Find the enterprise proxy path
          const enterpriseProxyPath = path.join(
            process.cwd(),
            '..',
            'snow-flow-enterprise',
            'mcp-proxy',
            'dist',
            'enterprise-proxy.js'
          );

          // Check if proxy exists
          if (!fs.existsSync(enterpriseProxyPath)) {
            spinner3.stop('Local proxy not found - will use remote server');
            prompts.log.message('   (Optional) To use local proxy: cd ../snow-flow-enterprise/mcp-proxy && npm run build');
          } else {
          // Configure for SnowCode (prioritize SnowCode config)
          const snowcodeConfigPath = path.join(process.env.HOME || '', '.snowcode', 'config.json');
          const snowcodeConfigDirPath = path.join(process.env.HOME || '', '.snowcode');

          if (!fs.existsSync(snowcodeConfigDirPath)) {
            fs.mkdirSync(snowcodeConfigDirPath, { recursive: true });
          }

          let snowcodeConfig: any = { mcpServers: {} };

          if (fs.existsSync(snowcodeConfigPath)) {
            try {
              snowcodeConfig = JSON.parse(fs.readFileSync(snowcodeConfigPath, 'utf8'));
            } catch {
              snowcodeConfig = { mcpServers: {} };
            }
          }

          if (!snowcodeConfig.mcpServers) {
            snowcodeConfig.mcpServers = {};
          }

          // Add enterprise MCP server
          snowcodeConfig.mcpServers['snow-flow-enterprise'] = {
            command: 'node',
            args: [enterpriseProxyPath],
            env: enterpriseEnv
          };

          fs.writeFileSync(snowcodeConfigPath, JSON.stringify(snowcodeConfig, null, 2));
          spinner3.stop('Enterprise MCP proxy configured for SnowCode');
          prompts.log.success(`Config saved: ${snowcodeConfigPath}`);

          // Also try Claude Code config
          const claudeConfigPath = path.join(process.env.HOME || '', '.claude', 'settings.json');
          if (fs.existsSync(path.dirname(claudeConfigPath))) {
            try {
              let claudeConfig: any = { mcpServers: {} };
              if (fs.existsSync(claudeConfigPath)) {
                claudeConfig = JSON.parse(fs.readFileSync(claudeConfigPath, 'utf8'));
              }

              if (!claudeConfig.mcpServers) {
                claudeConfig.mcpServers = {};
              }

              claudeConfig.mcpServers['snow-flow-enterprise'] = {
                command: 'node',
                args: [enterpriseProxyPath],
                env: enterpriseEnv
              };

              fs.writeFileSync(claudeConfigPath, JSON.stringify(claudeConfig, null, 2));
              prompts.log.success('Also configured for Claude Code');
            } catch {
              // Claude Code config optional
            }
          }
        }
      } catch (error: any) {
        spinner3.stop('Enterprise proxy configuration failed');
        prompts.log.warn(`Error: ${error.message}`);
        prompts.log.message('You can configure manually later');
      }
    } // Close Service Integrator else block

    prompts.outro('🎉 Enterprise setup complete! Restart your AI coding assistant to use enterprise features.');
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