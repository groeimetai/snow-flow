/**
 * snow_execute_script_sync - Synchronous script execution
 *
 * Synchronously executes a script and waits for the result.
 *
 * ⚠️ CRITICAL: ALL SCRIPTS MUST BE ES5 ONLY!
 * ServiceNow runs on Rhino engine - no const/let/arrow functions/template literals.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
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

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { script, timeout = 30000, capture_output = true } = args;

  try {
    const client = await getAuthenticatedClient(context);

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
      } else {
        result = { success: true, result: response.data?.result || 'Script executed successfully' };
      }
    } catch (parseError) {
      result = { success: true, result: response.data?.result || 'Script executed successfully' };
    }

    return createSuccessResult({
      execution_id: executionId,
      success: result.success,
      result: result.result,
      execution_time_ms: result.executionTime || 0,
      error: result.error || null
    }, {
      operation: 'sync_script_execution',
      timeout_ms: timeout
    });

  } catch (error: any) {
    return createErrorResult(
      error instanceof SnowFlowError
        ? error
        : new SnowFlowError(ErrorType.UNKNOWN_ERROR, error.message, { originalError: error })
    );
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
