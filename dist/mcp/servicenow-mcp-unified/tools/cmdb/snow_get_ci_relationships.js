"use strict";
/**
 * snow_get_ci_relationships - Get CI relationship map
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_ci_relationships',
    description: 'Get all relationships for a Configuration Item',
    // Metadata for tool discovery (not sent to LLM)
    category: 'cmdb',
    subcategory: 'relationships',
    use_cases: ['cmdb', 'relationships', 'mapping'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            ci_sys_id: { type: 'string', description: 'CI sys_id' },
            depth: { type: 'number', description: 'Relationship depth', default: 1 }
        },
        required: ['ci_sys_id']
    }
};
async function execute(args, context) {
    const { ci_sys_id, depth = 1 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.get('/api/now/table/cmdb_rel_ci', {
            params: {
                sysparm_query: `parent=${ci_sys_id}^ORchild=${ci_sys_id}`,
                sysparm_display_value: 'all',
                sysparm_limit: 1000
            }
        });
        return (0, error_handler_js_1.createSuccessResult)({ relationships: response.data.result, depth });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_get_ci_relationships.js.map