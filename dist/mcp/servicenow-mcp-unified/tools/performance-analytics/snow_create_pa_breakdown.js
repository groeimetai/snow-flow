"use strict";
/**
 * snow_create_pa_breakdown - Create PA breakdowns
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_pa_breakdown',
    description: 'Creates a breakdown source for Performance Analytics to segment data by dimensions',
    // Metadata for tool discovery (not sent to LLM)
    category: 'performance-analytics',
    subcategory: 'indicators',
    use_cases: ['performance-analytics', 'breakdown', 'segmentation'],
    complexity: 'intermediate',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Breakdown name' },
            table: { type: 'string', description: 'Table to breakdown' },
            field: { type: 'string', description: 'Field to group by' },
            related_field: { type: 'string', description: 'Related field path (for reference fields)' },
            matrix_source: { type: 'boolean', description: 'Is matrix breakdown', default: false }
        },
        required: ['name', 'table', 'field']
    }
};
async function execute(args, context) {
    const { name, table, field, related_field, matrix_source } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const breakdownData = {
            name,
            table,
            field,
            matrix_source: matrix_source || false
        };
        if (related_field)
            breakdownData.related_field = related_field;
        const response = await client.post('/api/now/table/pa_breakdowns', breakdownData);
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            breakdown: response.data.result,
            message: `PA breakdown ${name} created successfully`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_pa_breakdown.js.map