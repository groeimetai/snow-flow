"use strict";
/**
 * snow_create_catalog_item - Create service catalog item
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_catalog_item',
    description: 'Create service catalog item',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'service-catalog',
    use_cases: ['catalog', 'create', 'service-catalog'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string' },
            short_description: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            price: { type: 'string' }
        },
        required: ['name']
    }
};
async function execute(args, context) {
    const { name, short_description, description, category, price } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const itemData = { name, short_description, description };
        if (category)
            itemData.category = category;
        if (price)
            itemData.price = price;
        const response = await client.post('/api/now/table/sc_cat_item', itemData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, catalog_item: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_catalog_item.js.map