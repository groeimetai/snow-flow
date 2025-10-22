/**
 * snow_get_script_output - Retrieve script output from previous execution
 *
 * Retrieves the output from a previously executed script using its execution ID.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_get_script_output',
  description: 'Retrieve output from previously executed script using execution ID',
  // Metadata for tool discovery (not sent to LLM)
  category: 'automation',
  subcategory: 'script-execution',
  use_cases: ['automation', 'scripts', 'output-retrieval'],
  complexity: 'intermediate',
  frequency: 'medium',
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

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { execution_id, cleanup = true } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Try to find the output in sys_properties
    const outputResponse = await client.get(
      `/api/now/table/sys_properties?sysparm_query=nameLIKEsnow_flow.script_output.${execution_id}&sysparm_limit=1`
    );

    if (outputResponse.data.result && outputResponse.data.result.length > 0) {
      const property = outputResponse.data.result[0];
      const scriptOutput = JSON.parse(property.value);

      // Clean up old property if requested
      if (cleanup) {
        await client.delete(`/api/now/table/sys_properties/${property.sys_id}`);
      }

      return createSuccessResult({
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
    const historyResponse = await client.get(
      `/api/now/table/sys_script_execution_history?sysparm_query=script_nameLIKE${execution_id}&sysparm_limit=5`
    );

    if (historyResponse.data.result && historyResponse.data.result.length > 0) {
      const history = historyResponse.data.result[0];
      return createSuccessResult({
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
    throw new SnowFlowError(
      ErrorType.NOT_FOUND,
      `No output found for execution ID: ${execution_id}`,
      {
        retryable: false,
        details: {
          possible_reasons: [
            'The script is still executing',
            'The execution ID is incorrect',
            'The output has been cleaned up'
          ]
        }
      }
    );

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
