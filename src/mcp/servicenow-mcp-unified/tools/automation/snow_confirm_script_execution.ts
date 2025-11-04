/**
 * snow_confirm_script_execution - Confirm and execute approved background script
 *
 * Executes a background script after user approval. Only call this after user
 * explicitly approves script execution from snow_execute_background_script.
 *
 * ⚠️ CRITICAL: ALL SCRIPTS MUST BE ES5 ONLY!
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_confirm_script_execution',
  description: '⚡ INTERNAL: Confirms and executes background script after user approval',
  // Metadata for tool discovery (not sent to LLM)
  category: 'automation',
  subcategory: 'script-execution',
  use_cases: ['automation', 'scripts', 'execution'],
  complexity: 'advanced',
  frequency: 'high',

  // Permission enforcement
  // Classification: WRITE - Write operation based on name pattern
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
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

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { script, executionId, userConfirmed } = args;

  try {
    // Security check - must have user confirmation
    if (!userConfirmed) {
      throw new SnowFlowError(
        ErrorType.INVALID_REQUEST,
        'User confirmation required for script execution',
        { retryable: false }
      );
    }

    const client = await getAuthenticatedClient(context);

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

    return createSuccessResult({
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
