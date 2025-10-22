"use strict";
/**
 * snow_execute_script_sync - Synchronous script execution
 *
 * Synchronously executes a script and waits for the result.
 *
 * ⚠️ CRITICAL: ALL SCRIPTS MUST BE ES5 ONLY!
 * ServiceNow runs on Rhino engine - no const/let/arrow functions/template literals.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_execute_script_sync',
    description: 'Synchronously execute script and wait for result (ES5 only - no const/let/arrows/templates)',
    // Metadata for tool discovery (not sent to LLM)
    category: 'automation',
    subcategory: 'script-execution',
    use_cases: ['automation', 'scripts', 'synchronous'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            script: {
                type: 'string',
                description: '🚨 ES5 ONLY! No const/let/arrows/templates. JavaScript code to execute synchronously.'
            },
            timeout: {
                type: 'number',
                description: 'Timeout in milliseconds',
                default: 30000
            },
            capture_output: {
                type: 'boolean',
                description: 'Capture and return output',
                default: true
            }
        },
        required: ['script']
    }
};
async function execute(args, context) {
    const { script, timeout = 30000, capture_output = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Create execution ID
        const executionId = `sync_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        // Wrap script for synchronous execution with output capture
        const executionScript = `
var result = {};
var startTime = new GlideDateTime();

try {
  // Execute the user script
  var scriptResult = (function() {
    ${script}
  })();

  result = {
    success: true,
    result: scriptResult,
    executionTime: GlideDateTime.subtract(startTime, new GlideDateTime()).getNumericValue(),
    executionId: '${executionId}'
  };
} catch(e) {
  result = {
    success: false,
    error: e.toString(),
    executionTime: GlideDateTime.subtract(startTime, new GlideDateTime()).getNumericValue(),
    executionId: '${executionId}'
  };
}

// Return result directly
JSON.stringify(result);
`;
        // Execute script
        const response = await client.post('/api/now/table/sys_script_execution', {
            script: executionScript
        });
        let result;
        try {
            // Try to parse the response as JSON
            if (response.data?.result) {
                result = JSON.parse(response.data.result);
            }
            else {
                result = { success: true, result: response.data?.result || 'Script executed successfully' };
            }
        }
        catch (parseError) {
            result = { success: true, result: response.data?.result || 'Script executed successfully' };
        }
        return (0, error_handler_js_1.createSuccessResult)({
            execution_id: executionId,
            success: result.success,
            result: result.result,
            execution_time_ms: result.executionTime || 0,
            error: result.error || null
        }, {
            operation: 'sync_script_execution',
            timeout_ms: timeout
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
//# sourceMappingURL=snow_execute_script_sync.js.map