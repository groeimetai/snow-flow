"use strict";
/**
 * snow_update_ci - Update Configuration Item
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_update_ci',
    description: 'Update Configuration Item attributes',
    // Metadata for tool discovery (not sent to LLM)
    category: 'cmdb',
    subcategory: 'crud',
    use_cases: ['cmdb', 'update', 'configuration-item'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            sys_id: { type: 'string', description: 'CI sys_id' },
            ci_class: { type: 'string', description: 'CI class table' },
            attributes: { type: 'object', description: 'Attributes to update' }
        },
        required: ['sys_id', 'ci_class', 'attributes']
    }
};
async function execute(args, context) {
    const { sys_id, ci_class, attributes } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.put(`/api/now/table/${ci_class}/${sys_id}`, attributes);
        return (0, error_handler_js_1.createSuccessResult)({ updated: true, ci: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_update_ci.js.map