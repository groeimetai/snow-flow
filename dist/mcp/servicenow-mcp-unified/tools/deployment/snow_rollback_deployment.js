"use strict";
/**
 * snow_rollback_deployment - Safe deployment rollback
 *
 * Rollback failed deployments by reverting to previous version
 * or deleting newly created artifacts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_rollback_deployment',
    description: 'Rollback failed deployment by reverting to previous version or deleting artifact',
    inputSchema: {
        type: 'object',
        properties: {
            sys_id: {
                type: 'string',
                description: 'sys_id of artifact to rollback'
            },
            table: {
                type: 'string',
                description: 'Table name (sp_widget, sys_ux_page, etc.)',
                enum: ['sp_widget', 'sys_ux_page', 'sys_hub_flow', 'sys_script_include']
            },
            action: {
                type: 'string',
                enum: ['revert', 'delete'],
                description: 'Rollback action: revert to previous version or delete artifact',
                default: 'revert'
            },
            update_set_id: {
                type: 'string',
                description: 'Update Set sys_id to rollback (optional)'
            },
            reason: {
                type: 'string',
                description: 'Reason for rollback (for audit trail)'
            }
        },
        required: ['sys_id', 'table']
    }
};
async function execute(args, context) {
    const { sys_id, table, action = 'revert', update_set_id, reason } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Step 1: Get current artifact
        const currentResponse = await client.get(`/api/now/table/${table}/${sys_id}`);
        if (!currentResponse.data || !currentResponse.data.result) {
            throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.RESOURCE_NOT_FOUND, `Artifact not found: ${table}/${sys_id}`, { retryable: false });
        }
        const currentArtifact = currentResponse.data.result;
        // Step 2: Execute rollback action
        let rollbackResult;
        if (action === 'delete') {
            // Delete artifact
            await client.delete(`/api/now/table/${table}/${sys_id}`);
            rollbackResult = {
                action: 'deleted',
                artifact: {
                    sys_id,
                    table,
                    name: currentArtifact.name || currentArtifact.id
                }
            };
        }
        else {
            // Revert to previous version
            const previousVersion = await getPreviousVersion(client, table, sys_id);
            if (!previousVersion) {
                throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.RESOURCE_NOT_FOUND, 'No previous version found to revert to', {
                    retryable: false,
                    details: { artifact: sys_id, table }
                });
            }
            // Restore previous version data
            const updateResponse = await client.put(`/api/now/table/${table}/${sys_id}`, previousVersion);
            rollbackResult = {
                action: 'reverted',
                artifact: {
                    sys_id,
                    table,
                    name: currentArtifact.name || currentArtifact.id
                },
                previous_version: previousVersion.sys_updated_on
            };
        }
        // Step 3: Rollback Update Set if provided
        if (update_set_id) {
            try {
                // Delete or revert Update Set
                await client.delete(`/api/now/table/sys_update_set/${update_set_id}`);
                rollbackResult.update_set_rolled_back = true;
            }
            catch (error) {
                rollbackResult.update_set_rollback_failed = true;
                rollbackResult.update_set_error = error.message;
            }
        }
        // Step 4: Create audit log entry
        if (reason) {
            await createAuditLog(client, {
                artifact_sys_id: sys_id,
                table,
                action,
                reason,
                rollback_result: rollbackResult
            });
        }
        return (0, error_handler_js_1.createSuccessResult)(rollbackResult, {
            timestamp: new Date().toISOString(),
            reason: reason || 'No reason provided'
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError
            ? error
            : new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.ROLLBACK_FAILED, `Rollback failed: ${error.message}`, { originalError: error }));
    }
}
/**
 * Get previous version of artifact from sys_update_version table
 */
async function getPreviousVersion(client, table, sys_id) {
    try {
        // Query sys_update_version for previous versions
        const response = await client.get('/api/now/table/sys_update_version', {
            params: {
                sysparm_query: `name=${table}_${sys_id}^ORDERBYDESCsys_created_on`,
                sysparm_limit: 2 // Get current + previous
            }
        });
        const versions = response.data.result;
        if (versions.length < 2) {
            return null; // No previous version
        }
        // Parse XML payload from previous version
        const previousPayload = versions[1].payload;
        const parsedData = parseUpdateSetXML(previousPayload);
        return parsedData;
    }
    catch (error) {
        console.error('[Rollback] Failed to get previous version:', error);
        return null;
    }
}
/**
 * Parse Update Set XML to extract field values
 */
function parseUpdateSetXML(xml) {
    // Simplified XML parsing - in production use a proper XML parser
    const data = {};
    const fieldPattern = /<(\w+)>([^<]*)<\/\1>/g;
    let match;
    while ((match = fieldPattern.exec(xml)) !== null) {
        data[match[1]] = match[2];
    }
    return data;
}
/**
 * Create audit log entry for rollback
 */
async function createAuditLog(client, entry) {
    try {
        await client.post('/api/now/table/sys_audit', {
            tablename: entry.table,
            documentkey: entry.artifact_sys_id,
            fieldname: 'rollback',
            oldvalue: JSON.stringify(entry.rollback_result),
            newvalue: entry.action,
            reason: entry.reason,
            user: 'snow-flow'
        });
    }
    catch (error) {
        console.warn('[Rollback] Failed to create audit log:', error);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_rollback_deployment.js.map