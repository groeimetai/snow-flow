"use strict";
/**
 * snow_create_purchase_order
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_purchase_order',
    description: 'Create purchase order',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'procurement',
    use_cases: ['purchase-orders', 'procurement', 'vendor-management'],
    complexity: 'intermediate',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            vendor: { type: 'string' },
            requested_by: { type: 'string' },
            items: { type: 'array', items: { type: 'object' } },
            total_cost: { type: 'number' }
        },
        required: ['vendor']
    }
};
async function execute(args, context) {
    const { vendor, requested_by, items, total_cost } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const poData = { vendor };
        if (requested_by)
            poData.requested_by = requested_by;
        if (total_cost)
            poData.total_cost = total_cost;
        const response = await client.post('/api/now/table/proc_po', poData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, purchase_order: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_purchase_order.js.map