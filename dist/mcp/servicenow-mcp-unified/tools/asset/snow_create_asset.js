"use strict";
/**
 * snow_create_asset - Create asset
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_asset',
    description: 'Create hardware/software asset',
    inputSchema: {
        type: 'object',
        properties: {
            asset_tag: { type: 'string' },
            ci: { type: 'string' },
            model_category: { type: 'string' },
            assigned_to: { type: 'string' }
        },
        required: ['asset_tag']
    }
};
async function execute(args, context) {
    const { asset_tag, ci, model_category, assigned_to } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const assetData = { asset_tag };
        if (ci)
            assetData.ci = ci;
        if (model_category)
            assetData.model_category = model_category;
        if (assigned_to)
            assetData.assigned_to = assigned_to;
        const response = await client.post('/api/now/table/alm_asset', assetData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, asset: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_asset.js.map