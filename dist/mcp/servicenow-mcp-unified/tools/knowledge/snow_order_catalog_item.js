"use strict";
/**
 * snow_order_catalog_item - Order catalog item
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_order_catalog_item',
    description: 'Order service catalog item',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'service-catalog',
    use_cases: ['catalog', 'order', 'request'],
    complexity: 'intermediate',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            catalog_item_sys_id: { type: 'string' },
            requested_for: { type: 'string' },
            variables: { type: 'object' }
        },
        required: ['catalog_item_sys_id']
    }
};
async function execute(args, context) {
    const { catalog_item_sys_id, requested_for, variables = {} } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const orderData = { sysparm_item_guid: catalog_item_sys_id, variables };
        if (requested_for)
            orderData.sysparm_requested_for = requested_for;
        const response = await client.post('/api/sn_sc/servicecatalog/items/' + catalog_item_sys_id + '/order_now', orderData);
        return (0, error_handler_js_1.createSuccessResult)({ ordered: true, request: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_order_catalog_item.js.map