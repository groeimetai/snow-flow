"use strict";
/**
 * snow_oauth_provider
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_oauth_provider',
    description: 'Create OAuth provider configuration',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Provider name' },
            client_id: { type: 'string', description: 'OAuth client ID' },
            auth_url: { type: 'string', description: 'Authorization URL' },
            token_url: { type: 'string', description: 'Token URL' }
        },
        required: ['name', 'client_id', 'auth_url', 'token_url']
    }
};
async function execute(args, context) {
    const { name, client_id, auth_url, token_url } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const oauthData = {
            name,
            client_id,
            authorization_url: auth_url,
            token_url,
            active: true
        };
        const response = await client.post('/api/now/table/oauth_entity', oauthData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, oauth_provider: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_oauth_provider.js.map