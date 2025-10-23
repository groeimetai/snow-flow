import { Command } from 'commander';
import chalk from 'chalk';
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

      // Only do OpenCode auth if no API key is configured
      if (!hasApiKey) {
        // Check if opencode is installed
        try {
          execSync('which opencode', { stdio: 'ignore' });
        } catch {
          console.error(chalk.red('❌ OpenCode is not installed'));
          console.log(chalk.yellow('Please install OpenCode first: ') + chalk.cyan('npm install -g opencode-ai'));
          console.log(chalk.blue('Or configure an API key in .env: ') + chalk.cyan('ANTHROPIC_API_KEY=your-key'));
          return;
        }

        console.log(chalk.blue('🔐 Starting authentication flow...\n'));

        // Fix common OpenCode directory issue (agents vs agent) in ALL possible directories
        try {
          const fs = require('fs');
          const path = require('path');

          const directoriesToFix = [
            // Fix 1: Global ~/.opencode directory
            process.env.HOME + '/.opencode',
            // Fix 2: Current working directory
            path.join(process.cwd(), '.opencode'),
            // Fix 3: Parent directory (in case we're in a subdirectory)
            path.join(process.cwd(), '..', '.opencode'),
            // Fix 4: Snow-flow package directory (for development)
            path.join(__dirname, '..', '..', '.opencode')
          ];

          for (const opencodeDir of directoriesToFix) {
            const agentsDir = path.join(opencodeDir, 'agents');
            const agentDir = path.join(opencodeDir, 'agent');

            if (fs.existsSync(agentsDir) && !fs.existsSync(agentDir)) {
              console.log(chalk.dim(`   Fixing OpenCode directory structure in ${opencodeDir}...`));
              try {
                fs.renameSync(agentsDir, agentDir);
              } catch (e) {
                // Ignore individual rename errors
              }
            }
          }
        } catch (dirError) {
          // Ignore directory fix errors - OpenCode will handle it
          console.log(chalk.dim('   (Directory fix skipped - will auto-correct)'));
        }

        try {
          // Run opencode auth login interactively
          execSync('opencode auth login', { stdio: 'inherit' });
          console.log(chalk.green('✅ LLM authentication completed\n'));

          // Ask which provider they used and save it
          if (!provider || provider.trim() === '') {
            const { selectedProvider } = await inquirer.prompt([{
              type: 'list',
              name: 'selectedProvider',
              message: 'Which provider did you just authenticate with?',
              choices: [
                { name: 'Anthropic (Claude)', value: 'anthropic' },
                { name: 'OpenAI (GPT)', value: 'openai' },
                { name: 'Google (Gemini)', value: 'google' },
                { name: 'Ollama (Local)', value: 'ollama' },
                { name: 'Other', value: 'other' }
              ]
            }]);

            if (selectedProvider !== 'other') {
              // Dynamically fetch latest models from provider APIs
              const { getProviderModels } = await import('../utils/dynamic-models.js');

              console.log(chalk.dim(`   Fetching latest ${selectedProvider} models...`));

              const models = await getProviderModels(selectedProvider);

              // Ask for preferred model
              let selectedModel = '';
              if (models && models.length > 0) {
                const choices = models.map(m => ({
                  name: m.name,
                  value: m.value
                }));

                const { chosenModel } = await inquirer.prompt([{
                  type: 'list',
                  name: 'chosenModel',
                  message: `Which ${selectedProvider} model do you want to use by default?`,
                  choices: choices
                }]);
                selectedModel = chosenModel;
              } else {
                console.log(chalk.yellow(`   ⚠️  Could not fetch models for ${selectedProvider}, skipping model selection`));
              }

              // Save provider AND model to .env file
              const envPath = path.join(process.cwd(), '.env');
              let envContent = '';

              try {
                envContent = fs.readFileSync(envPath, 'utf8');
              } catch {
                // .env doesn't exist yet, use .env.example as template
                const examplePath = path.join(process.cwd(), '.env.example');
                if (fs.existsSync(examplePath)) {
                  envContent = fs.readFileSync(examplePath, 'utf8');
                }
              }

              // Update DEFAULT_LLM_PROVIDER in .env content
              if (envContent.includes('DEFAULT_LLM_PROVIDER=')) {
                envContent = envContent.replace(/DEFAULT_LLM_PROVIDER=.*/g, `DEFAULT_LLM_PROVIDER=${selectedProvider}`);
              } else {
                envContent += `\nDEFAULT_LLM_PROVIDER=${selectedProvider}\n`;
              }

              // Update DEFAULT_MODEL in .env content
              if (selectedModel) {
                if (envContent.includes('DEFAULT_MODEL=')) {
                  envContent = envContent.replace(/DEFAULT_MODEL=.*/g, `DEFAULT_MODEL=${selectedModel}`);
                } else {
                  envContent += `DEFAULT_MODEL=${selectedModel}\n`;
                }
              }

              fs.writeFileSync(envPath, envContent);
              console.log(chalk.green(`✅ Provider saved: ${selectedProvider}`));
              if (selectedModel) {
                console.log(chalk.green(`✅ Default model saved: ${selectedModel}\n`));
              } else {
                console.log();
              }
              provider = selectedProvider;
              process.env.DEFAULT_LLM_PROVIDER = provider;
              if (selectedModel) {
                process.env.DEFAULT_MODEL = selectedModel;
              }
            }
          }
        } catch (error: any) {
          console.error(chalk.red('\n❌ LLM authentication failed'));

          // Check if it's the known OpenCode directory bug
          const errorMsg = error?.message || error?.toString() || '';
          if (errorMsg.includes('agents') && errorMsg.includes('agent')) {
            console.log(chalk.yellow('\n⚠️  OpenCode directory issue detected'));
            console.log(chalk.blue('   Run this fix: ') + chalk.cyan('mv ~/.opencode/agents ~/.opencode/agent'));
            console.log(chalk.blue('   Then try: ') + chalk.cyan('snow-flow auth login'));
          } else {
            console.log(chalk.yellow('💡 You can try again later or use an API key instead'));
            console.log(chalk.blue('   Add to .env: ') + chalk.cyan('ANTHROPIC_API_KEY=your-api-key'));
          }
          return;
        }
      }

      // Step 2: ServiceNow OAuth authentication
      console.log(chalk.blue('🔐 Authenticating with ServiceNow...'));

      const oauth = new ServiceNowOAuth();

      // Read credentials from .env file
      let instance = process.env.SNOW_INSTANCE;
      let clientId = process.env.SNOW_CLIENT_ID;
      let clientSecret = process.env.SNOW_CLIENT_SECRET;

      // Validate credentials (check if they exist AND are valid)
      const credentialsValid =
        instance && instance.trim() !== '' && instance.includes('.service-now.com') &&
        clientId && clientId.trim() !== '' && clientId.length >= 32 &&
        clientSecret && clientSecret.trim() !== '' && clientSecret.length >= 32;

      // If credentials are missing or invalid, ask user interactively
      if (!credentialsValid) {
        if (instance || clientId || clientSecret) {
          console.log(chalk.yellow('\n⚠️  Invalid ServiceNow OAuth credentials detected in .env'));
          if (instance && !instance.includes('.service-now.com')) {
            console.log(chalk.red('   ❌ Instance URL must be a .service-now.com domain'));
          }
          if (clientId && clientId.length < 32) {
            console.log(chalk.red('   ❌ Client ID too short (expected 32+ characters)'));
          }
          if (clientSecret && clientSecret.length < 32) {
            console.log(chalk.red('   ❌ Client Secret too short (expected 32+ characters)'));
          }
        } else {
          console.log(chalk.yellow('\n⚠️  ServiceNow OAuth credentials not found in .env'));
        }
        console.log(chalk.dim('   You need to set up OAuth in ServiceNow first\n'));

        const { setupNow } = await inquirer.prompt([{
          type: 'confirm',
          name: 'setupNow',
          message: 'Do you want to enter your ServiceNow OAuth credentials now?',
          default: true
        }]);

        if (!setupNow) {
          console.log(chalk.yellow('\n💡 To set up OAuth credentials manually:'));
          console.log('   1. Log into ServiceNow as admin');
          console.log('   2. Navigate to: System OAuth > Application Registry');
          console.log('   3. Create a new OAuth application');
          console.log('   4. Add these to your .env file:');
          console.log('      SNOW_INSTANCE=your-instance.service-now.com');
          console.log('      SNOW_CLIENT_ID=your-client-id');
          console.log('      SNOW_CLIENT_SECRET=your-client-secret');
          console.log('\n   Then run: snow-flow auth login');
          return;
        }

        console.log(chalk.blue('\n📋 ServiceNow OAuth Setup'));
        console.log(chalk.dim('   Need help? See: https://docs.servicenow.com/oauth\n'));

        const credentials = await inquirer.prompt([
          {
            type: 'input',
            name: 'instance',
            message: 'ServiceNow instance (e.g., dev12345.service-now.com):',
            default: instance,
            validate: (input: string) => {
              if (!input || input.trim() === '') {
                return 'Instance URL is required';
              }
              // Remove https:// and trailing slash if present
              const cleaned = input.replace(/^https?:\/\//, '').replace(/\/$/, '');
              if (!cleaned.includes('.service-now.com')) {
                return 'Instance must be a ServiceNow domain (e.g., dev12345.service-now.com)';
              }
              return true;
            },
            filter: (input: string) => input.replace(/^https?:\/\//, '').replace(/\/$/, '')
          },
          {
            type: 'input',
            name: 'clientId',
            message: 'OAuth Client ID:',
            default: clientId,
            validate: (input: string) => {
              if (!input || input.trim() === '') {
                return 'Client ID is required';
              }
              if (input.length < 32) {
                return 'Client ID seems too short. Expected a 32-character hex string from ServiceNow';
              }
              return true;
            }
          },
          {
            type: 'password',
            name: 'clientSecret',
            message: 'OAuth Client Secret:',
            mask: '*',
            validate: (input: string) => {
              if (!input || input.trim() === '') {
                return 'Client Secret is required';
              }
              if (input.length < 32) {
                return 'Client Secret too short. Expected 32+ character random string from ServiceNow';
              }
              return true;
            }
          }
        ]);

        instance = credentials.instance;
        clientId = credentials.clientId;
        clientSecret = credentials.clientSecret;

        // Save to .env file
        const envPath = path.join(process.cwd(), '.env');
        let envContent = '';

        try {
          envContent = fs.readFileSync(envPath, 'utf8');
        } catch {
          // .env doesn't exist yet, use .env.example as template
          const examplePath = path.join(process.cwd(), '.env.example');
          if (fs.existsSync(examplePath)) {
            envContent = fs.readFileSync(examplePath, 'utf8');
          }
        }

        // Update credentials in .env content
        const updates = [
          { key: 'SNOW_INSTANCE', value: instance },
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
        console.log(chalk.green('\n✅ Credentials saved to .env file\n'));

        // Reload environment variables
        process.env.SNOW_INSTANCE = instance;
        process.env.SNOW_CLIENT_ID = clientId;
        process.env.SNOW_CLIENT_SECRET = clientSecret;
      }

      // Start OAuth flow (this opens browser automatically)
      const result = await oauth.authenticate(instance, clientId, clientSecret);

      if (result.success) {
        console.log(chalk.green('✅ ServiceNow authentication successful!'));

        // Test connection
        const client = new ServiceNowClient();
        const testResult = await client.testConnection();
        if (testResult.success) {
          console.log(chalk.green(`✅ Logged in as: ${testResult.data.name} (${testResult.data.user_name})`));
        }

        console.log(chalk.blue('\n🎉 Ready to start developing!'));
        console.log(chalk.cyan('   snow-flow swarm "create incident dashboard"'));
        console.log(chalk.dim('   or: ') + chalk.cyan('opencode\n'));
      } else {
        console.error(chalk.red(`\n❌ ServiceNow authentication failed: ${result.error}`));
        process.exit(1);
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