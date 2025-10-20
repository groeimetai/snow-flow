"use strict";
/**
 * snow_transfer_asset
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_transfer_asset',
    description: 'Transfer asset to user/location',
    inputSchema: {
        type: 'object',
        properties: {
            asset_sys_id: { type: 'string' },
            to_user: { type: 'string' },
            to_location: { type: 'string' }
        },
        required: ['asset_sys_id']
    }
};
async function execute(args, context) {
    const { asset_sys_id, to_user, to_location } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const transferData = {};
        if (to_user)
            transferData.assigned_to = to_user;
        if (to_location)
            transferData.location = to_location;
        const response = await client.put(`/api/now/table/alm_asset/${asset_sys_id}`, transferData);
        return (0, error_handler_js_1.createSuccessResult)({ transferred: true, asset: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_transfer_asset.js.map