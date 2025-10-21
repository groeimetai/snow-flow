import { Command } from 'commander';
import chalk from 'chalk';
import { ServiceNowOAuth } from '../utils/snow-oauth.js';
import { ServiceNowClient } from '../utils/servicenow-client.js';
import { Logger } from '../utils/logger.js';

const authLogger = new Logger('auth');

export function registerAuthCommands(program: Command) {
  const auth = program.command('auth').description('ServiceNow authentication management');

  auth
    .command('login')
    .description('Authenticate with LLM provider (Claude Pro/Max) and ServiceNow')
    .action(async () => {
      const { execSync } = require('child_process');

      authLogger.info('🔑 Starting Snow-Flow authentication...\n');

      // Step 1: Check if Anthropic (Claude Pro/Max) authentication is needed
      const provider = process.env.DEFAULT_LLM_PROVIDER;
      const anthropicKey = process.env.ANTHROPIC_API_KEY;

      if (provider === 'anthropic' && (!anthropicKey || anthropicKey.trim() === '')) {
        authLogger.info('🤖 Detected Claude Pro/Max configuration (no API key set)');
        authLogger.info('📋 Step 1: Authenticate with Anthropic\n');

        // Check if opencode is installed
        try {
          execSync('which opencode', { stdio: 'ignore' });
        } catch {
          console.error(chalk.red('❌ OpenCode is not installed'));
          console.log(chalk.yellow('Please install OpenCode first: ') + chalk.cyan('npm install -g opencode-ai'));
          console.log(chalk.blue('Or configure an API key in .env: ') + chalk.cyan('ANTHROPIC_API_KEY=your-key'));
          return;
        }

        authLogger.info('🔐 Launching Anthropic authentication...');
        authLogger.info(chalk.dim('   This will open your browser to login with your Anthropic account\n'));

        try {
          // Run opencode auth login interactively
          execSync('opencode auth login', { stdio: 'inherit' });
          authLogger.info(chalk.green('\n✅ Anthropic authentication completed!\n'));
        } catch (error) {
          console.error(chalk.red('\n❌ Anthropic authentication failed'));
          console.log(chalk.yellow('💡 You can try again later or use an API key instead'));
          console.log(chalk.blue('   Add to .env: ') + chalk.cyan('ANTHROPIC_API_KEY=your-api-key'));
          return;
        }
      } else if (provider === 'anthropic' && anthropicKey && anthropicKey.trim() !== '') {
        authLogger.info(chalk.green('✅ Using Anthropic API key from .env'));
      } else if (provider !== 'anthropic') {
        authLogger.info(chalk.blue(`ℹ️  Using ${provider || 'default'} LLM provider`));
      }

      // Step 2: ServiceNow OAuth authentication
      authLogger.info('📋 Step 2: Authenticate with ServiceNow\n');

      const oauth = new ServiceNowOAuth();

      // Read credentials from .env file automatically
      const instance = process.env.SNOW_INSTANCE;
      const clientId = process.env.SNOW_CLIENT_ID;
      const clientSecret = process.env.SNOW_CLIENT_SECRET;

      if (!instance || !clientId || !clientSecret) {
        console.error(chalk.red('❌ Missing required ServiceNow OAuth credentials in .env file'));
        authLogger.info('\n📝 Please add these to your .env file:');
        authLogger.info('   SNOW_INSTANCE=your-instance.service-now.com');
        authLogger.info('   SNOW_CLIENT_ID=your-client-id');
        authLogger.info('   SNOW_CLIENT_SECRET=your-client-secret');
        authLogger.info('\n💡 Then run: snow-flow auth login');
        return;
      }

      authLogger.info(`🌐 Instance: ${instance}`);
      authLogger.info('🚀 Opening ServiceNow OAuth page in browser...\n');

      // Start OAuth flow (this opens browser automatically)
      const result = await oauth.authenticate(instance, clientId, clientSecret);

      if (result.success) {
        authLogger.info(chalk.green('\n✅ ServiceNow authentication successful!'));
        authLogger.info(chalk.green('🎉 Snow-Flow is now fully configured!\n'));

        // Test connection
        const client = new ServiceNowClient();
        const testResult = await client.testConnection();
        if (testResult.success) {
          authLogger.info(`🔍 Connection verified!`);
          authLogger.info(`👤 Logged in as: ${testResult.data.name} (${testResult.data.user_name})\n`);
        }

        authLogger.info(chalk.blue.bold('📋 You\'re ready to start developing!'));
        authLogger.info(chalk.cyan('   snow-flow swarm "create incident dashboard widget"'));
        authLogger.info(chalk.dim('   or launch OpenCode directly: ') + chalk.cyan('opencode'));
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
      authLogger.info('🔓 Logging out from ServiceNow...');
      await oauth.logout();
      authLogger.info('✅ Logged out successfully');
    });

  auth
    .command('status')
    .description('Show ServiceNow authentication status')
    .action(async () => {
      const oauth = new ServiceNowOAuth();
      authLogger.info('📊 ServiceNow Authentication Status:');
      
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