"use strict";
/**
 * snow_create_ci_relationship - Create CI relationships
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_ci_relationship',
    description: 'Create relationship between Configuration Items',
    // Metadata for tool discovery (not sent to LLM)
    category: 'cmdb',
    subcategory: 'relationships',
    use_cases: ['cmdb', 'relationships', 'dependencies'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            parent_ci: { type: 'string', description: 'Parent CI sys_id' },
            child_ci: { type: 'string', description: 'Child CI sys_id' },
            relationship_type: { type: 'string', description: 'Relationship type sys_id' }
        },
        required: ['parent_ci', 'child_ci', 'relationship_type']
    }
};
async function execute(args, context) {
    const { parent_ci, child_ci, relationship_type } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const relData = { parent: parent_ci, child: child_ci, type: relationship_type };
        const response = await client.post('/api/now/table/cmdb_rel_ci', relData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, relationship: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_ci_relationship.js.map