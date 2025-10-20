"use strict";
/**
 * snow_update_set_add_artifact - Add artifact to Update Set
 *
 * Registers an artifact (widget, flow, script) in the active Update Set
 * for tracking. Maintains comprehensive change history for deployments.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_update_set_add_artifact',
    description: 'Register an artifact in the active Update Set for tracking',
    inputSchema: {
        type: 'object',
        properties: {
            type: {
                type: 'string',
                description: 'Artifact type (widget, flow, script, etc.)'
            },
            sys_id: {
                type: 'string',
                description: 'ServiceNow sys_id of the artifact'
            },
            name: {
                type: 'string',
                description: 'Artifact name for tracking'
            },
            update_set_id: {
                type: 'string',
                description: 'Update Set sys_id (uses current if not specified)'
            }
        },
        required: ['type', 'sys_id', 'name']
    }
};
async function execute(args, context) {
    const { type, sys_id, name, update_set_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        let targetId = update_set_id;
        // If no ID specified, use current Update Set
        if (!targetId) {
            const currentResponse = await client.get('/api/now/table/sys_update_set', {
                params: {
                    sysparm_query: 'is_current=true',
                    sysparm_fields: 'sys_id,name',
                    sysparm_limit: 1
                }
            });
            if (!currentResponse.data.result || currentResponse.data.result.length === 0) {
                return (0, error_handler_js_1.createErrorResult)('No Update Set specified and no active Update Set found');
            }
            targetId = currentResponse.data.result[0].sys_id;
        }
        // Create sys_update_xml record to track artifact
        // Note: In reality, ServiceNow automatically creates these records
        // when changes are made. This is a manual tracking mechanism.
        const trackingResponse = await client.post('/api/now/table/sys_update_xml', {
            update_set: targetId,
            type: type,
            name: name,
            target_name: sys_id,
            action: 'INSERT_OR_UPDATE',
            payload: `<!-- Artifact tracked: ${type} - ${name} -->`
        });
        const trackingRecord = trackingResponse.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            tracked: true,
            update_set_id: targetId,
            artifact: {
                type,
                sys_id,
                name,
                tracking_record: trackingRecord.sys_id
            },
            message: `Artifact '${name}' (${type}) added to Update Set`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_update_set_add_artifact.js.map