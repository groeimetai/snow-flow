"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthCommands = registerAuthCommands;
const snow_oauth_js_1 = require("../utils/snow-oauth.js");
const servicenow_client_js_1 = require("../utils/servicenow-client.js");
const logger_js_1 = require("../utils/logger.js");
const authLogger = new logger_js_1.Logger('auth');
function registerAuthCommands(program) {
    const auth = program.command('auth').description('ServiceNow authentication management');
    auth
        .command('login')
        .description('Login to ServiceNow using OAuth 2.0 (opens browser automatically)')
        .action(async () => {
        const oauth = new snow_oauth_js_1.ServiceNowOAuth();
        authLogger.info('🔑 Starting ServiceNow OAuth authentication...');
        // Read credentials from .env file automatically
        const instance = process.env.SNOW_INSTANCE;
        const clientId = process.env.SNOW_CLIENT_ID;
        const clientSecret = process.env.SNOW_CLIENT_SECRET;
        if (!instance || !clientId || !clientSecret) {
            console.error('❌ Missing required OAuth credentials in .env file');
            authLogger.info('\n📝 Please add these to your .env file:');
            authLogger.info('   SNOW_INSTANCE=your-instance.service-now.com');
            authLogger.info('   SNOW_CLIENT_ID=your-client-id');
            authLogger.info('   SNOW_CLIENT_SECRET=your-client-secret');
            authLogger.info('\n💡 Then run: snow-flow auth login');
            return;
        }
        authLogger.info(`🌐 Instance: ${instance}`);
        authLogger.info('🚀 Opening ServiceNow OAuth page in browser...');
        // Start OAuth flow (this opens browser automatically)
        const result = await oauth.authenticate(instance, clientId, clientSecret);
        if (result.success) {
            authLogger.info('\n✅ Authentication successful!');
            authLogger.info('🎉 Snow-Flow is now connected to ServiceNow!');
            authLogger.info('\n📋 Ready for ServiceNow development!');
            authLogger.info('   Next: snow-flow swarm "your task here"');
            // Test connection
            const client = new servicenow_client_js_1.ServiceNowClient();
            const testResult = await client.testConnection();
            if (testResult.success) {
                authLogger.info(`\n🔍 Connection verified!`);
                authLogger.info(`👤 Logged in as: ${testResult.data.name} (${testResult.data.user_name})`);
            }
        }
        else {
            console.error(`\n❌ Authentication failed: ${result.error}`);
            process.exit(1);
        }
    });
    auth
        .command('logout')
        .description('Logout from ServiceNow')
        .action(async () => {
        const oauth = new snow_oauth_js_1.ServiceNowOAuth();
        authLogger.info('🔓 Logging out from ServiceNow...');
        await oauth.logout();
        authLogger.info('✅ Logged out successfully');
    });
    auth
        .command('status')
        .description('Show ServiceNow authentication status')
        .action(async () => {
        const oauth = new snow_oauth_js_1.ServiceNowOAuth();
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