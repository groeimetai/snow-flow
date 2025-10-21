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
        console.log(); // Empty line for spacing
        // Step 1: Check if Anthropic (Claude Pro/Max) authentication is needed
        const provider = process.env.DEFAULT_LLM_PROVIDER;
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
            // Fix common OpenCode directory issue (agents vs agent)
            const opencodeDir = process.env.HOME + '/.opencode';
            const agentsDir = opencodeDir + '/agents';
            const agentDir = opencodeDir + '/agent';
            try {
                const fs = require('fs');
                const path = require('path');
                // Check if problematic 'agents' directory exists
                if (fs.existsSync(agentsDir) && !fs.existsSync(agentDir)) {
                    console.log(chalk_1.default.dim('   Fixing OpenCode directory structure...'));
                    fs.renameSync(agentsDir, agentDir);
                }
            }
            catch (dirError) {
                // Ignore directory fix errors - OpenCode will handle it
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
        // Read credentials from .env file automatically
        const instance = process.env.SNOW_INSTANCE;
        const clientId = process.env.SNOW_CLIENT_ID;
        const clientSecret = process.env.SNOW_CLIENT_SECRET;
        if (!instance || !clientId || !clientSecret) {
            console.error(chalk_1.default.red('❌ Missing required ServiceNow OAuth credentials in .env file'));
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