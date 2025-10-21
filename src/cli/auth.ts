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

      console.log(); // Empty line for spacing

      // Step 1: Check if Anthropic (Claude Pro/Max) authentication is needed
      const provider = process.env.DEFAULT_LLM_PROVIDER;
      const anthropicKey = process.env.ANTHROPIC_API_KEY;

      if (provider === 'anthropic' && (!anthropicKey || anthropicKey.trim() === '')) {
        // Check if opencode is installed
        try {
          execSync('which opencode', { stdio: 'ignore' });
        } catch {
          console.error(chalk.red('❌ OpenCode is not installed'));
          console.log(chalk.yellow('Please install OpenCode first: ') + chalk.cyan('npm install -g opencode-ai'));
          console.log(chalk.blue('Or configure an API key in .env: ') + chalk.cyan('ANTHROPIC_API_KEY=your-key'));
          return;
        }

        console.log(chalk.blue('🔐 Authenticating with Anthropic...'));

        // Fix common OpenCode directory issue (agents vs agent) in BOTH global and project directories
        try {
          const fs = require('fs');
          const path = require('path');

          // Fix 1: Global ~/.opencode directory
          const globalOpencodeDir = process.env.HOME + '/.opencode';
          const globalAgentsDir = globalOpencodeDir + '/agents';
          const globalAgentDir = globalOpencodeDir + '/agent';

          if (fs.existsSync(globalAgentsDir) && !fs.existsSync(globalAgentDir)) {
            console.log(chalk.dim('   Fixing global OpenCode directory structure...'));
            fs.renameSync(globalAgentsDir, globalAgentDir);
          }

          // Fix 2: Project .opencode directory (in current working directory)
          const projectOpencodeDir = path.join(process.cwd(), '.opencode');
          const projectAgentsDir = path.join(projectOpencodeDir, 'agents');
          const projectAgentDir = path.join(projectOpencodeDir, 'agent');

          if (fs.existsSync(projectAgentsDir) && !fs.existsSync(projectAgentDir)) {
            console.log(chalk.dim('   Fixing project OpenCode directory structure...'));
            fs.renameSync(projectAgentsDir, projectAgentDir);
          }
        } catch (dirError) {
          // Ignore directory fix errors - OpenCode will handle it
          console.log(chalk.dim('   (Directory fix skipped - will auto-correct)'));
        }

        try {
          // Run opencode auth login interactively
          execSync('opencode auth login', { stdio: 'inherit' });
          console.log(chalk.green('✅ Anthropic authentication completed\n'));
        } catch (error: any) {
          console.error(chalk.red('\n❌ Anthropic authentication failed'));

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

      // Read credentials from .env file automatically
      const instance = process.env.SNOW_INSTANCE;
      const clientId = process.env.SNOW_CLIENT_ID;
      const clientSecret = process.env.SNOW_CLIENT_SECRET;

      if (!instance || !clientId || !clientSecret) {
        console.error(chalk.red('❌ Missing required ServiceNow OAuth credentials in .env file'));
        console.log('\n📝 Please add these to your .env file:');
        console.log('   SNOW_INSTANCE=your-instance.service-now.com');
        console.log('   SNOW_CLIENT_ID=your-client-id');
        console.log('   SNOW_CLIENT_SECRET=your-client-secret');
        console.log('\n💡 Then run: snow-flow auth login');
        return;
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