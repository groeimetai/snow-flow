"use strict";
/**
 * snow_get_script_output - Retrieve script output from previous execution
 *
 * Retrieves the output from a previously executed script using its execution ID.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_script_output',
    description: 'Retrieve output from previously executed script using execution ID',
    inputSchema: {
        type: 'object',
        properties: {
            execution_id: {
                type: 'string',
                description: 'Execution ID from previous script run'
            },
            cleanup: {
                type: 'boolean',
                description: 'Clean up temporary output after retrieval',
                default: true
            }
        },
        required: ['execution_id']
    }
};
async function execute(args, context) {
    const { execution_id, cleanup = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Try to find the output in sys_properties
        const outputResponse = await client.get(`/api/now/table/sys_properties?sysparm_query=nameLIKEsnow_flow.script_output.${execution_id}&sysparm_limit=1`);
        if (outputResponse.data.result && outputResponse.data.result.length > 0) {
            const property = outputResponse.data.result[0];
            const scriptOutput = JSON.parse(property.value);
            // Clean up old property if requested
            if (cleanup) {
                await client.delete(`/api/now/table/sys_properties/${property.sys_id}`);
            }
            return (0, error_handler_js_1.createSuccessResult)({
                execution_id: scriptOutput.executionId,
                executed_at: scriptOutput.executedAt,
                success: scriptOutput.success,
                output: scriptOutput.output || [],
                errors: scriptOutput.errors || [],
                exception: scriptOutput.exception || null
            }, {
                operation: 'retrieve_script_output',
                cleanup_performed: cleanup
            });
        }
        // Try to find in script execution history
        const historyResponse = await client.get(`/api/now/table/sys_script_execution_history?sysparm_query=script_nameLIKE${execution_id}&sysparm_limit=5`);
        if (historyResponse.data.result && historyResponse.data.result.length > 0) {
            const history = historyResponse.data.result[0];
            return (0, error_handler_js_1.createSuccessResult)({
                execution_id,
                executed_at: history.sys_created_on,
                executed_by: history.sys_created_by,
                output: history.output || 'No output captured',
                errors: history.error_message || null,
                source: 'execution_history'
            }, {
                operation: 'retrieve_script_output',
                source: 'execution_history'
            });
        }
        // No output found
        throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.NOT_FOUND, `No output found for execution ID: ${execution_id}`, {
            retryable: false,
            details: {
                possible_reasons: [
                    'The script is still executing',
                    'The execution ID is incorrect',
                    'The output has been cleaned up'
                ]
            }
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
//# sourceMappingURL=snow_get_script_output.js.map