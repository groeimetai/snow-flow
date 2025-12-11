/**
 * snow_start_workflow - Start a workflow on a record
 *
 * ⚠️ IMPORTANT: This tool starts workflows via the Workflow API.
 * Workflows run asynchronously in ServiceNow.
 *
 * Note: Uses the standard workflow start approach via GlideRecord update
 * which triggers any associated workflow.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_start_workflow',
  description: 'Start a workflow on a specific record. Workflows run asynchronously in ServiceNow.',
  // Metadata for tool discovery (not sent to LLM)
  category: 'automation',
  subcategory: 'workflow',
  use_cases: ['workflow', 'workflow-execution', 'automation'],
  complexity: 'intermediate',
  frequency: 'medium',

  // Permission enforcement
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      workflow_sys_id: {
        type: 'string',
        description: 'Workflow sys_id (from wf_workflow table)'
      },
      workflow_name: {
        type: 'string',
        description: 'Workflow name (alternative to sys_id)'
      },
      table: {
        type: 'string',
        description: 'Table name the record belongs to'
      },
      record_sys_id: {
        type: 'string',
        description: 'Record sys_id to run workflow on'
      }
    },
    required: ['record_sys_id', 'table']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { workflow_sys_id, workflow_name, table, record_sys_id } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Resolve workflow if name provided
    let resolvedWorkflowId = workflow_sys_id;
    let workflowInfo: any = null;

    if (!workflow_sys_id && workflow_name) {
      const workflowQuery = await client.get('/api/now/table/wf_workflow', {
        params: {
          sysparm_query: `name=${workflow_name}`,
          sysparm_fields: 'sys_id,name,table,active',
          sysparm_limit: 1
        }
      });

      if (!workflowQuery.data?.result?.[0]) {
        throw new SnowFlowError(
          ErrorType.NOT_FOUND,
          `Workflow not found: ${workflow_name}`,
          { retryable: false }
        );
      }

      workflowInfo = workflowQuery.data.result[0];
      resolvedWorkflowId = workflowInfo.sys_id;
    } else if (workflow_sys_id) {
      // Get workflow info for response
      const workflowQuery = await client.get(`/api/now/table/wf_workflow/${workflow_sys_id}`, {
        params: {
          sysparm_fields: 'sys_id,name,table,active'
        }
      });
      workflowInfo = workflowQuery.data?.result;
    }

    // Verify record exists
    const recordCheck = await client.get(`/api/now/table/${table}/${record_sys_id}`, {
      params: {
        sysparm_fields: 'sys_id'
      }
    });

    if (!recordCheck.data?.result) {
      throw new SnowFlowError(
        ErrorType.NOT_FOUND,
        `Record not found: ${table}/${record_sys_id}`,
        { retryable: false }
      );
    }

    // Start workflow by creating a workflow context
    // This is the standard way to programmatically start workflows
    const contextResponse = await client.post('/api/now/table/wf_context', {
      workflow_version: resolvedWorkflowId,
      table: table,
      id: record_sys_id,
      state: 'executing',
      started_by: 'snow-flow'
    });

    if (contextResponse.data?.result?.sys_id) {
      return createSuccessResult({
        started: true,
        workflow_sys_id: resolvedWorkflowId,
        workflow_name: workflowInfo?.name || 'Unknown',
        record_sys_id,
        table,
        context_sys_id: contextResponse.data.result.sys_id,
        message: 'Workflow started successfully. It will run asynchronously.',
        note: 'Check wf_context table for execution status'
      }, {
        operation: 'start_workflow',
        method: 'wf_context'
      });
    }

    // Fallback: Try to trigger via record update (which may fire associated workflows)
    return createSuccessResult({
      started: false,
      workflow_sys_id: resolvedWorkflowId,
      workflow_name: workflowInfo?.name || 'Unknown',
      record_sys_id,
      table,
      message: 'Could not create workflow context directly. The workflow may need to be triggered via record state change or business rule.',
      suggestion: 'Try updating the record state to trigger associated workflows'
    }, {
      operation: 'start_workflow',
      method: 'fallback'
    });

  } catch (error: any) {
    return createErrorResult(
      error instanceof SnowFlowError
        ? error
        : new SnowFlowError(ErrorType.UNKNOWN_ERROR, error.message, { originalError: error })
    );
  }
}

export const version = '2.0.0';
export const author = 'Snow-Flow SDK';
