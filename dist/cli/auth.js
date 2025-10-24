"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthCommands = registerAuthCommands;
const chalk_1 = __importDefault(require("chalk"));
const prompts = __importStar(require("@clack/prompts"));
const snow_oauth_js_1 = require("../utils/snow-oauth.js");
const servicenow_client_js_1 = require("../utils/servicenow-client.js");
const logger_js_1 = require("../utils/logger.js");
const authLogger = new logger_js_1.Logger('auth');
function registerAuthCommands(program) {
    const auth = program.command('auth').description('ServiceNow authentication management');
    // List available models for a provider
    auth
        .command('models')
        .description('List available models for LLM providers')
        .option('-p, --provider <provider>', 'Provider to list models for (anthropic, openai, google, ollama)')
        .action(async (options) => {
        const { getAllProviderModels, getProviderModels } = await Promise.resolve().then(() => __importStar(require('../utils/dynamic-models.js')));
        console.log(chalk_1.default.blue('\n🤖 Available LLM Models\n'));
        if (options.provider) {
            // List models for specific provider
            console.log(chalk_1.default.cyan(`${options.provider.toUpperCase()}:\n`));
            const models = await getProviderModels(options.provider);
            if (models.length > 0) {
                models.forEach((model, i) => {
                    console.log(`  ${i + 1}. ${chalk_1.default.white(model.name)}`);
                    console.log(`     ${chalk_1.default.dim('ID:')} ${chalk_1.default.yellow(model.value)}`);
                    if (model.contextWindow) {
                        console.log(`     ${chalk_1.default.dim('Context:')} ${chalk_1.default.green(model.contextWindow.toLocaleString() + ' tokens')}`);
                    }
                    console.log();
                });
            }
            else {
                console.log(chalk_1.default.yellow('  No models available for this provider\n'));
            }
        }
        else {
            // List all providers
            const allModels = await getAllProviderModels();
            for (const [provider, models] of Object.entries(allModels)) {
                console.log(chalk_1.default.cyan(`${provider.toUpperCase()}:\n`));
                if (models.length > 0) {
                    models.forEach((model, i) => {
                        console.log(`  ${i + 1}. ${chalk_1.default.white(model.name)}`);
                        console.log(`     ${chalk_1.default.dim('ID:')} ${chalk_1.default.yellow(model.value)}`);
                        console.log();
                    });
                }
                else {
                    console.log(chalk_1.default.yellow('  No models available\n'));
                }
            }
        }
        console.log(chalk_1.default.dim('💡 Tip: Use --provider to see models for a specific provider'));
        console.log(chalk_1.default.dim('Example: snow-flow auth models --provider anthropic\n'));
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
        const hasApiKey = (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim() !== '') ||
            (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') ||
            (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.trim() !== '') ||
            (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '') ||
            (process.env.MISTRAL_API_KEY && process.env.MISTRAL_API_KEY.trim() !== '');
        // Only do SnowCode auth if no API key is configured
        if (!hasApiKey) {
            // Check if snowcode is installed
            try {
                execSync('which snowcode', { stdio: 'ignore' });
            }
            catch {
                console.error(chalk_1.default.red('❌ SnowCode is not installed'));
                console.log(chalk_1.default.yellow('Please install SnowCode first: ') + chalk_1.default.cyan('npm install -g @groeimetai/snowcode'));
                console.log(chalk_1.default.blue('Or configure an API key in .env: ') + chalk_1.default.cyan('ANTHROPIC_API_KEY=your-key'));
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
                        console.log(chalk_1.default.dim(`   Fixing SnowCode directory structure in ${snowcodeDir}...`));
                        try {
                            fs.renameSync(agentsDir, agentDir);
                        }
                        catch (e) {
                            // Ignore individual rename errors
                        }
                    }
                }
            }
            catch (dirError) {
                // Ignore directory fix errors - SnowCode will handle it
                console.log(chalk_1.default.dim('   (Directory fix skipped - will auto-correct)'));
            }
            try {
                // Run SnowCode auth login - prefer local installation (has platform binaries)
                const localSnowCode = path.join(process.cwd(), 'node_modules', '@groeimetai', 'snowcode', 'bin', 'snowcode');
                let snowcodeCommand = 'snowcode'; // fallback to global
                if (fs.existsSync(localSnowCode)) {
                    console.log(chalk_1.default.dim('   Using local SnowCode installation (with platform binaries)'));
                    snowcodeCommand = `"${localSnowCode}"`;
                }
                else {
                    console.log(chalk_1.default.dim('   Using global SnowCode installation'));
                }
                execSync(`${snowcodeCommand} auth login`, { stdio: 'inherit' });
            }
            catch (error) {
                console.error(chalk_1.default.red('\n❌ Authentication failed'));
                // Check if it's the bun dependency error
                const errorMsg = error?.message || error?.toString() || '';
                if (errorMsg.includes('Cannot find package \'bun\'') || errorMsg.includes('ERR_MODULE_NOT_FOUND')) {
                    console.log(chalk_1.default.yellow('\n⚠️  SnowCode dependency issue detected'));
                    console.log(chalk_1.default.blue('   This is a known issue with SnowCode versions 0.15.18 and earlier'));
                    console.log(chalk_1.default.blue('   Please update SnowCode to the latest version:'));
                    console.log(chalk_1.default.cyan('   npm update -g @groeimetai/snowcode'));
                    console.log(chalk_1.default.blue('\n   Alternatively, use an API key instead:'));
                    console.log(chalk_1.default.cyan('   1. Add to .env: ANTHROPIC_API_KEY=your-api-key'));
                    console.log(chalk_1.default.cyan('   2. Then run: snow-flow auth login'));
                }
                else if (errorMsg.includes('agents') && errorMsg.includes('agent')) {
                    console.log(chalk_1.default.yellow('\n⚠️  SnowCode directory issue detected'));
                    console.log(chalk_1.default.blue('   Run this fix: ') + chalk_1.default.cyan('mv ~/.snowcode/agents ~/.snowcode/agent'));
                    console.log(chalk_1.default.blue('   Then try: ') + chalk_1.default.cyan('snow-flow auth login'));
                }
                else {
                    console.log(chalk_1.default.yellow('💡 You can try again later or use an API key instead'));
                    console.log(chalk_1.default.blue('   Add to .env: ') + chalk_1.default.cyan('ANTHROPIC_API_KEY=your-api-key'));
                }
                return;
            }
        }
        // ServiceNow setup - continue the flow
        console.log(chalk_1.default.blue('\n📦 ServiceNow Configuration'));
        console.log(chalk_1.default.dim('Connect Snow-Flow to your ServiceNow instance\n'));
        // Read credentials from .env file
        let instance = process.env.SNOW_INSTANCE;
        let authMethod = process.env.SNOW_AUTH_METHOD;
        // Check if we have complete credentials for either method
        const hasOAuthCreds = process.env.SNOW_CLIENT_ID && process.env.SNOW_CLIENT_SECRET;
        const hasBasicCreds = process.env.SNOW_USERNAME && process.env.SNOW_PASSWORD;
        const hasCompleteCredentials = instance && instance.includes('.service-now.com') &&
            ((authMethod === 'oauth' && hasOAuthCreds) || (authMethod === 'basic' && hasBasicCreds));
        // If no complete credentials, ask for auth method FIRST
        if (!hasCompleteCredentials) {
            const method = await prompts.select({
                message: 'Choose authentication method',
                options: [
                    { value: 'oauth', label: 'OAuth 2.0', hint: 'recommended for security' },
                    { value: 'basic', label: 'Basic Auth', hint: 'username/password' }
                ]
            });
            if (prompts.isCancel(method)) {
                prompts.cancel('Setup cancelled');
                process.exit(0);
            }
            authMethod = method;
            // Ask for ServiceNow instance (common for both methods)
            instance = await prompts.text({
                message: 'ServiceNow instance URL',
                placeholder: 'dev12345.service-now.com',
                defaultValue: instance || '',
                validate: (value) => {
                    if (!value || value.trim() === '')
                        return 'Instance URL is required';
                    const cleaned = value.replace(/^https?:\/\//, '').replace(/\/$/, '');
                    if (!cleaned.includes('.service-now.com')) {
                        return 'Must be a ServiceNow domain (e.g., dev12345.service-now.com)';
                    }
                }
            });
            if (prompts.isCancel(instance)) {
                prompts.cancel('Setup cancelled');
                process.exit(0);
            }
            instance = instance.replace(/^https?:\/\//, '').replace(/\/$/, '');
        }
        // OAuth 2.0 Flow
        if (authMethod === 'oauth') {
            const oauth = new snow_oauth_js_1.ServiceNowOAuth();
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
                        if (!value || value.trim() === '')
                            return 'Client ID is required';
                        if (value.length < 32)
                            return 'Client ID too short (expected 32+ characters)';
                    }
                });
                if (prompts.isCancel(clientId)) {
                    prompts.cancel('Setup cancelled');
                    process.exit(0);
                }
                // OAuth Client Secret
                clientSecret = await prompts.password({
                    message: 'OAuth Client Secret',
                    validate: (value) => {
                        if (!value || value.trim() === '')
                            return 'Client Secret is required';
                        if (value.length < 32)
                            return 'Client Secret too short (expected 32+ characters)';
                    }
                });
                if (prompts.isCancel(clientSecret)) {
                    prompts.cancel('Setup cancelled');
                    process.exit(0);
                }
                // Save to .env file
                const envPath = path.join(process.cwd(), '.env');
                let envContent = '';
                try {
                    envContent = fs.readFileSync(envPath, 'utf8');
                }
                catch {
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
                    }
                    else {
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
                const client = new servicenow_client_js_1.ServiceNowClient();
                const testResult = await client.testConnection();
                if (testResult.success) {
                    prompts.log.success(`Logged in as: ${testResult.data.name} (${testResult.data.user_name})`);
                }
                prompts.outro('Setup complete!');
            }
            else {
                spinner.stop('Authentication failed');
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
                        if (!value || value.trim() === '')
                            return 'Username is required';
                    }
                });
                if (prompts.isCancel(username)) {
                    prompts.cancel('Setup cancelled');
                    process.exit(0);
                }
                // Password
                password = await prompts.password({
                    message: 'ServiceNow password',
                    validate: (value) => {
                        if (!value || value.trim() === '')
                            return 'Password is required';
                    }
                });
                if (prompts.isCancel(password)) {
                    prompts.cancel('Setup cancelled');
                    process.exit(0);
                }
                // Save to .env file
                const envPath = path.join(process.cwd(), '.env');
                let envContent = '';
                try {
                    envContent = fs.readFileSync(envPath, 'utf8');
                }
                catch {
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
                    }
                    else {
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
            const client = new servicenow_client_js_1.ServiceNowClient();
            const testResult = await client.testConnection();
            if (testResult.success) {
                spinner.stop('ServiceNow authentication successful');
                prompts.log.success(`Logged in as: ${testResult.data.name} (${testResult.data.user_name})`);
                prompts.outro('Setup complete!');
            }
            else {
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