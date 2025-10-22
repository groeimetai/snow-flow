"use strict";
/**
 * snow_activate_plugin
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_activate_plugin',
    description: 'Activate ServiceNow plugin',
    // Metadata for tool discovery (not sent to LLM)
    category: 'advanced',
    subcategory: 'administration',
    use_cases: ['plugin-management', 'activation', 'configuration'],
    complexity: 'intermediate',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            plugin_id: { type: 'string', description: 'Plugin ID' }
        },
        required: ['plugin_id']
    }
};
async function execute(args, context) {
    const { plugin_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.post('/api/now/table/v_plugin', {
            id: plugin_id,
            active: true
        });
        return (0, error_handler_js_1.createSuccessResult)({ activated: true, plugin: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_activate_plugin.js.map