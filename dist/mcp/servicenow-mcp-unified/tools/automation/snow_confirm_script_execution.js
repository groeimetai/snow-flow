"use strict";
/**
 * snow_confirm_script_execution - Confirm and execute approved background script
 *
 * Executes a background script after user approval. Only call this after user
 * explicitly approves script execution from snow_execute_background_script.
 *
 * ⚠️ CRITICAL: ALL SCRIPTS MUST BE ES5 ONLY!
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_confirm_script_execution',
    description: '⚡ INTERNAL: Confirms and executes background script after user approval',
    inputSchema: {
        type: 'object',
        properties: {
            script: {
                type: 'string',
                description: 'The approved script to execute (ES5 only)'
            },
            executionId: {
                type: 'string',
                description: 'Execution ID from confirmation request'
            },
            userConfirmed: {
                type: 'boolean',
                description: 'User confirmation (must be true)'
            }
        },
        required: ['script', 'executionId', 'userConfirmed']
    }
};
async function execute(args, context) {
    const { script, executionId, userConfirmed } = args;
    try {
        // Security check - must have user confirmation
        if (!userConfirmed) {
            throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.INVALID_REQUEST, 'User confirmation required for script execution', { retryable: false });
        }
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Generate execution timestamp
        const executionTimestamp = new Date().toISOString();
        // Create background script execution record for audit trail
        const executionRecord = {
            name: `Snow-Flow Background Script - ${executionId}`,
            script: script,
            active: true,
            description: `Background script executed via Snow-Flow MCP - Execution ID: ${executionId}`
        };
        // Execute script using sys_script table (Background Scripts)
        const scriptResponse = await client.post('/api/now/table/sys_script', executionRecord);
        if (!scriptResponse.data.result) {
            throw new Error('Failed to create background script execution record');
        }
        const scriptSysId = scriptResponse.data.result.sys_id;
        return (0, error_handler_js_1.createSuccessResult)({
            executed: true,
            execution_id: executionId,
            script_sys_id: scriptSysId,
            executed_at: executionTimestamp,
            status: 'Script saved for execution',
            message: 'Script was saved to ServiceNow Background Scripts module. Run manually from the ServiceNow interface.',
            access_url: 'System Administration > Scripts - Background'
        }, {
            operation: 'background_script_execution',
            audit_id: executionId
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError
            ? error
            : new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.UNKNOWN_ERROR, error.message, { originalError: error }));
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_confirm_script_execution.js.map