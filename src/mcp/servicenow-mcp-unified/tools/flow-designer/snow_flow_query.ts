/**
 * snow_flow_query - Unified Flow Designer Query Operations
 *
 * Flow query operations: get details, list flows, execution status, execution history.
 *
 * Replaces: snow_get_flow_details, snow_list_flows,
 *           snow_get_flow_execution_status, snow_get_flow_execution_history
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_flow_query',
  description: 'Unified flow query operations (get_details, list, execution_status, execution_history)',
  // Metadata for tool discovery (not sent to LLM)
  category: 'automation',
  subcategory: 'flow-designer',
  use_cases: ['flow-query', 'monitoring', 'discovery'],
  complexity: 'beginner',
  frequency: 'high',

  // 🆕 Permission enforcement (Q1 2025)
  // Classification: READ - Query operation - only reads data
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Flow query action',
        enum: ['get_details', 'list', 'execution_status', 'execution_history']
      },
      // GET_DETAILS parameters
      flow_sys_id: {
        type: 'string',
        description: '[get_details/execution_history] Flow sys_id'
      },
      include_actions: {
        type: 'boolean',
        description: '[get_details] Include action details',
        default: true
      },
      // LIST parameters
      active_only: {
        type: 'boolean',
        description: '[list] Return only active flows',
        default: true
      },
      limit: {
        type: 'number',
        description: '[list/execution_history] Maximum results',
        default: 50
      },
      // EXECUTION_STATUS parameters
      execution_sys_id: {
        type: 'string',
        description: '[execution_status] Flow execution context sys_id'
      },
      include_action_details: {
        type: 'boolean',
        description: '[execution_status] Include action execution details',
        default: false
      },
      // EXECUTION_HISTORY parameters
      status: {
        type: 'string',
        description: '[execution_history] Filter by status',
        enum: ['success', 'error', 'in_progress', 'cancelled']
      }
    },
    required: ['action']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { action } = args;

  try {
    switch (action) {
      case 'get_details':
        return await executeGetDetails(args, context);
      case 'list':
        return await executeList(args, context);
      case 'execution_status':
        return await executeExecutionStatus(args, context);
      case 'execution_history':
        return await executeExecutionHistory(args, context);
      default:
        return createErrorResult(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

// ==================== GET DETAILS ====================
async function executeGetDetails(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { flow_sys_id, include_actions = true } = args;

  if (!flow_sys_id) {
    return createErrorResult('flow_sys_id is required for get_details action');
  }

  const client = await getAuthenticatedClient(context);

  // Get flow details
  const flowResponse = await client.get(`/api/now/table/sys_hub_flow/${flow_sys_id}`);
  const flow = flowResponse.data.result;

  const details: any = {
    sys_id: flow.sys_id,
    name: flow.name,
    description: flow.description,
    active: flow.active,
    trigger_type: flow.trigger_type,
    table: flow.table
  };

  // Get actions if requested
  if (include_actions) {
    const actionsResponse = await client.get('/api/now/table/sys_hub_action_instance', {
      params: {
        sysparm_query: `flow=${flow_sys_id}`,
        sysparm_limit: 100
      }
    });
    details.actions = actionsResponse.data.result;
  }

  return createSuccessResult({
    action: 'get_details',
    flow: details
  });
}

// ==================== LIST ====================
async function executeList(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { active_only = true, limit = 50 } = args;

  const client = await getAuthenticatedClient(context);

  let query = active_only ? 'active=true' : '';

  const response = await client.get('/api/now/table/sys_hub_flow', {
    params: {
      sysparm_query: query,
      sysparm_limit: limit
    }
  });

  return createSuccessResult({
    action: 'list',
    flows: response.data.result,
    count: response.data.result.length
  });
}

// ==================== EXECUTION STATUS ====================
async function executeExecutionStatus(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { execution_sys_id, include_action_details = false } = args;

  if (!execution_sys_id) {
    return createErrorResult('execution_sys_id is required for execution_status action');
  }

  const client = await getAuthenticatedClient(context);

  // Get execution context
  const execResponse = await client.get(`/api/now/table/sys_flow_context/${execution_sys_id}`);
  const execution = execResponse.data.result;

  const status: any = {
    sys_id: execution.sys_id,
    state: execution.state,
    flow: execution.flow,
    started: execution.sys_created_on,
    status: execution.status
  };

  // Get action details if requested
  if (include_action_details) {
    const actionExecsResponse = await client.get('/api/now/table/sys_flow_action_context', {
      params: {
        sysparm_query: `context=${execution_sys_id}`,
        sysparm_limit: 100
      }
    });
    status.actions = actionExecsResponse.data.result;
  }

  return createSuccessResult({
    action: 'execution_status',
    execution: status
  });
}

// ==================== EXECUTION HISTORY ====================
async function executeExecutionHistory(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { flow_sys_id, limit = 10, status } = args;

  if (!flow_sys_id) {
    return createErrorResult('flow_sys_id is required for execution_history action');
  }

  const client = await getAuthenticatedClient(context);

  let query = `flow=${flow_sys_id}`;
  if (status) {
    query += `^state=${status}`;
  }

  const response = await client.get('/api/now/table/sys_flow_context', {
    params: {
      sysparm_query: query,
      sysparm_limit: limit,
      sysparm_orderby: 'DESCsys_created_on'
    }
  });

  return createSuccessResult({
    action: 'execution_history',
    executions: response.data.result,
    count: response.data.result.length
  });
}

export const version = '2.0.0';
export const author = 'Snow-Flow v8.2.0 Tool Merging - Phase 1';
