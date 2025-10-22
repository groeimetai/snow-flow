"use strict";
/**
 * snow_jira_integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_jira_integration',
    description: 'Configure JIRA integration',
    // Metadata for tool discovery (not sent to LLM)
    category: 'integration',
    subcategory: 'adapters',
    use_cases: ['jira-integration', 'third-party-integration', 'issue-tracking'],
    complexity: 'intermediate',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            jira_url: { type: 'string', description: 'JIRA instance URL' },
            username: { type: 'string', description: 'JIRA username' },
            api_token: { type: 'string', description: 'JIRA API token' }
        },
        required: ['jira_url', 'username', 'api_token']
    }
};
async function execute(args, context) {
    const { jira_url, username, api_token } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const integrationData = {
            name: 'JIRA Integration',
            url: jira_url,
            username,
            password: api_token,
            active: true
        };
        const response = await client.post('/api/now/table/sys_integration', integrationData);
        return (0, error_handler_js_1.createSuccessResult)({ configured: true, integration: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_jira_integration.js.map