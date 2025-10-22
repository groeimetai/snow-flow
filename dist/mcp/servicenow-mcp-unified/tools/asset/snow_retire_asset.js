"use strict";
/**
 * snow_retire_asset
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_retire_asset',
    description: 'Retire/dispose asset',
    // Metadata for tool discovery (not sent to LLM)
    category: 'asset-management',
    subcategory: 'asset-lifecycle',
    use_cases: ['asset-management', 'retirement', 'lifecycle'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            asset_sys_id: { type: 'string' },
            retirement_date: { type: 'string' },
            disposal_reason: { type: 'string' }
        },
        required: ['asset_sys_id']
    }
};
async function execute(args, context) {
    const { asset_sys_id, retirement_date, disposal_reason } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const retireData = { install_status: '7' }; // Retired
        if (retirement_date)
            retireData.retirement_date = retirement_date;
        if (disposal_reason)
            retireData.disposal_reason = disposal_reason;
        const response = await client.put(`/api/now/table/alm_asset/${asset_sys_id}`, retireData);
        return (0, error_handler_js_1.createSuccessResult)({ retired: true, asset: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_retire_asset.js.map