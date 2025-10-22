"use strict";
/**
 * snow_catalog_item_manager - Manage catalog items
 *
 * Create, update, or manage service catalog items.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_catalog_item_manager',
    description: 'Create, update, or manage service catalog items',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'catalog',
    use_cases: ['catalog-management', 'service-catalog', 'crud'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                description: 'Action to perform',
                enum: ['create', 'update', 'activate', 'deactivate', 'delete']
            },
            sys_id: {
                type: 'string',
                description: 'Catalog item sys_id (required for update/activate/deactivate/delete)'
            },
            name: {
                type: 'string',
                description: 'Catalog item name (required for create)'
            },
            short_description: {
                type: 'string',
                description: 'Short description'
            },
            category: {
                type: 'string',
                description: 'Category sys_id'
            },
            price: {
                type: 'string',
                description: 'Item price'
            }
        },
        required: ['action']
    }
};
async function execute(args, context) {
    const { action, sys_id, name, short_description, category, price } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        switch (action) {
            case 'create':
                if (!name) {
                    return (0, error_handler_js_1.createErrorResult)('name is required for create action');
                }
                const createData = {
                    name,
                    short_description: short_description || '',
                    active: true
                };
                if (category)
                    createData.category = category;
                if (price)
                    createData.price = price;
                const createResponse = await client.post('/api/now/table/sc_cat_item', createData);
                const createdItem = createResponse.data.result;
                return (0, error_handler_js_1.createSuccessResult)({
                    message: `Catalog item "${name}" created successfully`,
                    catalog_item: {
                        sys_id: createdItem.sys_id,
                        name: createdItem.name,
                        short_description: createdItem.short_description,
                        active: createdItem.active
                    }
                }, { action, sys_id: createdItem.sys_id });
            case 'update':
                if (!sys_id) {
                    return (0, error_handler_js_1.createErrorResult)('sys_id is required for update action');
                }
                const updateData = {};
                if (name)
                    updateData.name = name;
                if (short_description)
                    updateData.short_description = short_description;
                if (category)
                    updateData.category = category;
                if (price)
                    updateData.price = price;
                const updateResponse = await client.put(`/api/now/table/sc_cat_item/${sys_id}`, updateData);
                const updatedItem = updateResponse.data.result;
                return (0, error_handler_js_1.createSuccessResult)({
                    message: 'Catalog item updated successfully',
                    catalog_item: updatedItem
                }, { action, sys_id });
            case 'activate':
            case 'deactivate':
                if (!sys_id) {
                    return (0, error_handler_js_1.createErrorResult)(`sys_id is required for ${action} action`);
                }
                const activeValue = action === 'activate';
                const statusResponse = await client.put(`/api/now/table/sc_cat_item/${sys_id}`, {
                    active: activeValue
                });
                return (0, error_handler_js_1.createSuccessResult)({
                    message: `Catalog item ${action}d successfully`,
                    sys_id,
                    active: activeValue
                }, { action, sys_id });
            case 'delete':
                if (!sys_id) {
                    return (0, error_handler_js_1.createErrorResult)('sys_id is required for delete action');
                }
                await client.delete(`/api/now/table/sc_cat_item/${sys_id}`);
                return (0, error_handler_js_1.createSuccessResult)({
                    message: 'Catalog item deleted successfully',
                    sys_id
                }, { action, sys_id });
            default:
                return (0, error_handler_js_1.createErrorResult)(`Unknown action: ${action}`);
        }
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_catalog_item_manager.js.map