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
      const fs = require('fs');
      const path = require('path');
      const inquirer = require('inquirer');

      console.log(); // Empty line for spacing

      // Step 0: Provider selection if not configured
      let provider = process.env.DEFAULT_LLM_PROVIDER;

      if (!provider || provider.trim() === '') {
        console.log(chalk.blue('🤖 Select your LLM provider'));
        console.log(chalk.dim('   (75+ providers supported via OpenCode)\n'));

        const { selectedProvider } = await inquirer.prompt([{
          type: 'list',
          name: 'selectedProvider',
          message: 'Which LLM provider do you want to use?',
          choices: [
            { name: 'Anthropic (Claude Pro/Max subscription)', value: 'anthropic' },
            { name: 'OpenAI (ChatGPT API)', value: 'openai' },
            { name: 'Google (Gemini API)', value: 'google' },
            { name: 'Ollama (Free, runs locally)', value: 'ollama' },
            { name: 'Groq (Ultra-fast inference)', value: 'groq' },
            { name: 'DeepSeek (Specialized for coding)', value: 'deepseek' },
            { name: 'Mistral AI', value: 'mistral' },
            new inquirer.Separator(),
            { name: 'Other (configure manually in .env)', value: 'other' }
          ]
        }]);

        if (selectedProvider === 'other') {
          console.log(chalk.yellow('\n💡 Please set DEFAULT_LLM_PROVIDER in your .env file'));
          console.log(chalk.dim('   See .env.example for all 75+ available providers'));
          return;
        }

        provider = selectedProvider;

        // Save provider to .env file
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
          envContent = envContent.replace(/DEFAULT_LLM_PROVIDER=.*/g, `DEFAULT_LLM_PROVIDER=${provider}`);
        } else {
          envContent += `\nDEFAULT_LLM_PROVIDER=${provider}\n`;
        }

        fs.writeFileSync(envPath, envContent);
        console.log(chalk.green(`✅ Provider set to: ${provider}\n`));

        // Reload environment variables
        process.env.DEFAULT_LLM_PROVIDER = provider;
      }

      // Step 1: Check if Anthropic (Claude Pro/Max) authentication is needed
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

      // Read credentials from .env file
      let instance = process.env.SNOW_INSTANCE;
      let clientId = process.env.SNOW_CLIENT_ID;
      let clientSecret = process.env.SNOW_CLIENT_SECRET;

      // If credentials are missing, ask user interactively
      if (!instance || !clientId || !clientSecret) {
        console.log(chalk.yellow('\n⚠️  ServiceNow OAuth credentials not found in .env'));
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