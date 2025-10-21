"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthCommands = registerAuthCommands;
const chalk_1 = __importDefault(require("chalk"));
const snow_oauth_js_1 = require("../utils/snow-oauth.js");
const servicenow_client_js_1 = require("../utils/servicenow-client.js");
const logger_js_1 = require("../utils/logger.js");
const authLogger = new logger_js_1.Logger('auth');
function registerAuthCommands(program) {
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
            console.log(chalk_1.default.blue('🤖 Select your LLM provider'));
            console.log(chalk_1.default.dim('   (75+ providers supported via OpenCode)\n'));
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
                console.log(chalk_1.default.yellow('\n💡 Please set DEFAULT_LLM_PROVIDER in your .env file'));
                console.log(chalk_1.default.dim('   See .env.example for all 75+ available providers'));
                return;
            }
            provider = selectedProvider;
            // Save provider to .env file
            const envPath = path.join(process.cwd(), '.env');
            let envContent = '';
            try {
                envContent = fs.readFileSync(envPath, 'utf8');
            }
            catch {
                // .env doesn't exist yet, use .env.example as template
                const examplePath = path.join(process.cwd(), '.env.example');
                if (fs.existsSync(examplePath)) {
                    envContent = fs.readFileSync(examplePath, 'utf8');
                }
            }
            // Update DEFAULT_LLM_PROVIDER in .env content
            if (envContent.includes('DEFAULT_LLM_PROVIDER=')) {
                envContent = envContent.replace(/DEFAULT_LLM_PROVIDER=.*/g, `DEFAULT_LLM_PROVIDER=${provider}`);
            }
            else {
                envContent += `\nDEFAULT_LLM_PROVIDER=${provider}\n`;
            }
            fs.writeFileSync(envPath, envContent);
            console.log(chalk_1.default.green(`✅ Provider set to: ${provider}\n`));
            // Reload environment variables
            process.env.DEFAULT_LLM_PROVIDER = provider;
        }
        // Step 1: Check if Anthropic (Claude Pro/Max) authentication is needed
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        if (provider === 'anthropic' && (!anthropicKey || anthropicKey.trim() === '')) {
            // Check if opencode is installed
            try {
                execSync('which opencode', { stdio: 'ignore' });
            }
            catch {
                console.error(chalk_1.default.red('❌ OpenCode is not installed'));
                console.log(chalk_1.default.yellow('Please install OpenCode first: ') + chalk_1.default.cyan('npm install -g opencode-ai'));
                console.log(chalk_1.default.blue('Or configure an API key in .env: ') + chalk_1.default.cyan('ANTHROPIC_API_KEY=your-key'));
                return;
            }
            console.log(chalk_1.default.blue('🔐 Authenticating with Anthropic...'));
            // Fix common OpenCode directory issue (agents vs agent) in BOTH global and project directories
            try {
                const fs = require('fs');
                const path = require('path');
                // Fix 1: Global ~/.opencode directory
                const globalOpencodeDir = process.env.HOME + '/.opencode';
                const globalAgentsDir = globalOpencodeDir + '/agents';
                const globalAgentDir = globalOpencodeDir + '/agent';
                if (fs.existsSync(globalAgentsDir) && !fs.existsSync(globalAgentDir)) {
                    console.log(chalk_1.default.dim('   Fixing global OpenCode directory structure...'));
                    fs.renameSync(globalAgentsDir, globalAgentDir);
                }
                // Fix 2: Project .opencode directory (in current working directory)
                const projectOpencodeDir = path.join(process.cwd(), '.opencode');
                const projectAgentsDir = path.join(projectOpencodeDir, 'agents');
                const projectAgentDir = path.join(projectOpencodeDir, 'agent');
                if (fs.existsSync(projectAgentsDir) && !fs.existsSync(projectAgentDir)) {
                    console.log(chalk_1.default.dim('   Fixing project OpenCode directory structure...'));
                    fs.renameSync(projectAgentsDir, projectAgentDir);
                }
            }
            catch (dirError) {
                // Ignore directory fix errors - OpenCode will handle it
                console.log(chalk_1.default.dim('   (Directory fix skipped - will auto-correct)'));
            }
            try {
                // Run opencode auth login interactively
                execSync('opencode auth login', { stdio: 'inherit' });
                console.log(chalk_1.default.green('✅ Anthropic authentication completed\n'));
            }
            catch (error) {
                console.error(chalk_1.default.red('\n❌ Anthropic authentication failed'));
                // Check if it's the known OpenCode directory bug
                const errorMsg = error?.message || error?.toString() || '';
                if (errorMsg.includes('agents') && errorMsg.includes('agent')) {
                    console.log(chalk_1.default.yellow('\n⚠️  OpenCode directory issue detected'));
                    console.log(chalk_1.default.blue('   Run this fix: ') + chalk_1.default.cyan('mv ~/.opencode/agents ~/.opencode/agent'));
                    console.log(chalk_1.default.blue('   Then try: ') + chalk_1.default.cyan('snow-flow auth login'));
                }
                else {
                    console.log(chalk_1.default.yellow('💡 You can try again later or use an API key instead'));
                    console.log(chalk_1.default.blue('   Add to .env: ') + chalk_1.default.cyan('ANTHROPIC_API_KEY=your-api-key'));
                }
                return;
            }
        }
        // Step 2: ServiceNow OAuth authentication
        console.log(chalk_1.default.blue('🔐 Authenticating with ServiceNow...'));
        const oauth = new snow_oauth_js_1.ServiceNowOAuth();
        // Read credentials from .env file
        let instance = process.env.SNOW_INSTANCE;
        let clientId = process.env.SNOW_CLIENT_ID;
        let clientSecret = process.env.SNOW_CLIENT_SECRET;
        // If credentials are missing, ask user interactively
        if (!instance || !clientId || !clientSecret) {
            console.log(chalk_1.default.yellow('\n⚠️  ServiceNow OAuth credentials not found in .env'));
            console.log(chalk_1.default.dim('   You need to set up OAuth in ServiceNow first\n'));
            const { setupNow } = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'setupNow',
                    message: 'Do you want to enter your ServiceNow OAuth credentials now?',
                    default: true
                }]);
            if (!setupNow) {
                console.log(chalk_1.default.yellow('\n💡 To set up OAuth credentials manually:'));
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
            console.log(chalk_1.default.blue('\n📋 ServiceNow OAuth Setup'));
            console.log(chalk_1.default.dim('   Need help? See: https://docs.servicenow.com/oauth\n'));
            const credentials = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'instance',
                    message: 'ServiceNow instance (e.g., dev12345.service-now.com):',
                    default: instance,
                    validate: (input) => {
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
                    filter: (input) => input.replace(/^https?:\/\//, '').replace(/\/$/, '')
                },
                {
                    type: 'input',
                    name: 'clientId',
                    message: 'OAuth Client ID:',
                    default: clientId,
                    validate: (input) => {
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
                    validate: (input) => {
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
            }
            catch {
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
                }
                else {
                    envContent += `\n${key}=${value}\n`;
                }
            }
            fs.writeFileSync(envPath, envContent);
            console.log(chalk_1.default.green('\n✅ Credentials saved to .env file\n'));
            // Reload environment variables
            process.env.SNOW_INSTANCE = instance;
            process.env.SNOW_CLIENT_ID = clientId;
            process.env.SNOW_CLIENT_SECRET = clientSecret;
        }
        // Start OAuth flow (this opens browser automatically)
        const result = await oauth.authenticate(instance, clientId, clientSecret);
        if (result.success) {
            console.log(chalk_1.default.green('✅ ServiceNow authentication successful!'));
            // Test connection
            const client = new servicenow_client_js_1.ServiceNowClient();
            const testResult = await client.testConnection();
            if (testResult.success) {
                console.log(chalk_1.default.green(`✅ Logged in as: ${testResult.data.name} (${testResult.data.user_name})`));
            }
            console.log(chalk_1.default.blue('\n🎉 Ready to start developing!'));
            console.log(chalk_1.default.cyan('   snow-flow swarm "create incident dashboard"'));
            console.log(chalk_1.default.dim('   or: ') + chalk_1.default.cyan('opencode\n'));
        }
        else {
            console.error(chalk_1.default.red(`\n❌ ServiceNow authentication failed: ${result.error}`));
            process.exit(1);
        }
    });
    auth
        .command('logout')
        .description('Logout from ServiceNow')
        .action(async () => {
        const oauth = new snow_oauth_js_1.ServiceNowOAuth();
        await oauth.logout();
        console.log(chalk_1.default.green('✅ Logged out successfully'));
    });
    auth
        .command('status')
        .description('Show ServiceNow authentication status')
        .action(async () => {
        const oauth = new snow_oauth_js_1.ServiceNowOAuth();
        console.log(chalk_1.default.blue('\n📊 ServiceNow Authentication Status:'));
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
            const client = new servicenow_client_js_1.ServiceNowClient();
            const testResult = await client.testConnection();
            if (testResult.success) {
                console.log(`\n🔍 Connection test: ✅ Success`);
                if (testResult.data.message) {
                    console.log(`   ${testResult.data.message}`);
                }
                console.log(`🌐 Instance: ${testResult.data.email || credentials.instance}`);
            }
            else {
                console.log(`\n🔍 Connection test: ❌ Failed`);
                console.log(`   Error: ${testResult.error}`);
            }
        }
        else {
            console.log('   ├── Status: ❌ Not authenticated');
            console.log('   ├── Instance: Not configured');
            console.log('   └── Method: Not set');
            console.log('\n💡 Create .env file and run "snow-flow auth login"');
        }
    });
}
//# sourceMappingURL=auth.js.map