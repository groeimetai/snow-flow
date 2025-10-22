"use strict";
/**
 * snow_list_flows - List Flow Designer flows
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_list_flows',
    description: 'List Flow Designer flows',
    // Metadata for tool discovery (not sent to LLM)
    category: 'automation',
    subcategory: 'flow-designer',
    use_cases: ['discovery', 'listing', 'flow-management'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            active_only: { type: 'boolean', default: true },
            limit: { type: 'number', default: 50 }
        }
    }
};
async function execute(args, context) {
    const { active_only = true, limit = 50 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        let query = active_only ? 'active=true' : '';
        const response = await client.get('/api/now/table/sys_hub_flow', {
            params: { sysparm_query: query, sysparm_limit: limit }
        });
        return (0, error_handler_js_1.createSuccessResult)({ flows: response.data.result, count: response.data.result.length });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_list_flows.js.map