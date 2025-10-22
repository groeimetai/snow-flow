"use strict";
/**
 * snow_create_transform_map
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_transform_map',
    description: 'Create transform map for import sets',
    // Metadata for tool discovery (not sent to LLM)
    category: 'integration',
    subcategory: 'import-export',
    use_cases: ['transform-maps', 'data-transformation', 'import'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Transform map name' },
            source_table: { type: 'string', description: 'Source import table' },
            target_table: { type: 'string', description: 'Target table' },
            run_business_rules: { type: 'boolean', default: true }
        },
        required: ['name', 'source_table', 'target_table']
    }
};
async function execute(args, context) {
    const { name, source_table, target_table, run_business_rules = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const transformData = {
            name,
            source: source_table,
            target: target_table,
            run_business_rules
        };
        const response = await client.post('/api/now/table/sys_transform_map', transformData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, transform_map: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_transform_map.js.map