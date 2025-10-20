"use strict";
/**
 * snow_track_asset_lifecycle - Track complete asset lifecycle from procurement to disposal
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_track_asset_lifecycle',
    description: 'Track complete asset lifecycle from procurement to disposal',
    inputSchema: {
        type: 'object',
        properties: {
            asset_sys_id: { type: 'string', description: 'Asset sys_id to track' },
            action: {
                type: 'string',
                description: 'Lifecycle action',
                enum: ['procure', 'receive', 'deploy', 'transfer', 'retire', 'dispose']
            },
            reason: { type: 'string', description: 'Reason for lifecycle change' },
            user_sys_id: { type: 'string', description: 'User performing the action' },
            notes: { type: 'string', description: 'Additional notes' }
        },
        required: ['asset_sys_id', 'action']
    }
};
async function execute(args, context) {
    const { asset_sys_id, action, reason, user_sys_id, notes } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Get current asset state
        const assetResponse = await client.get(`/api/now/table/alm_asset/${asset_sys_id}`);
        if (!assetResponse.data.result) {
            return (0, error_handler_js_1.createErrorResult)(`Asset ${asset_sys_id} not found`);
        }
        const asset = assetResponse.data.result;
        // Update asset state based on action
        const stateMapping = {
            procure: 'on_order',
            receive: 'in_stock',
            deploy: 'deployed',
            transfer: 'deployed', // Stays deployed, just changes assignment
            retire: 'retired',
            dispose: 'disposed'
        };
        const newState = stateMapping[action];
        if (newState && newState !== asset.state) {
            await client.patch(`/api/now/table/alm_asset/${asset_sys_id}`, {
                state: newState
            });
        }
        // Create audit trail entry
        await client.post('/api/now/table/alm_audit', {
            asset: asset_sys_id,
            action,
            state: newState || asset.state,
            user: user_sys_id || 'system',
            reason: reason || `Asset ${action} via Snow-Flow automation`,
            notes: notes || '',
            timestamp: new Date().toISOString()
        });
        return (0, error_handler_js_1.createSuccessResult)({
            asset_tag: asset.asset_tag,
            display_name: asset.display_name,
            action,
            previous_state: asset.state,
            new_state: newState || asset.state,
            reason: reason || `Automated via Snow-Flow`,
            notes
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_track_asset_lifecycle.js.map