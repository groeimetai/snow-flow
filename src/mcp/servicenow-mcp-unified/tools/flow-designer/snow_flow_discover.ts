/**
 * snow_flow_discover - Discover available Flow Designer components
 *
 * Discovers available trigger types, action types, and subflows
 * that can be used when creating flows programmatically.
 *
 * @version 1.0.0
 * @author Snow-Flow v8.3.0 - Flow Designer Discovery
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

// ==================== TYPE DEFINITIONS ====================

interface TriggerType {
  sys_id: string;
  name: string;
  label: string;
  description?: string;
  table_name?: string;
}

interface ActionType {
  sys_id: string;
  name: string;
  label: string;
  category?: string;
  description?: string;
  spoke?: string;
}

interface Subflow {
  sys_id: string;
  name: string;
  internal_name: string;
  description?: string;
  inputs?: any[];
  outputs?: any[];
}

// ==================== TOOL DEFINITION ====================

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_flow_discover',
  description: `Discover available Flow Designer components.

Discovers:
- Trigger types: Record triggers, scheduled, API, email, etc.
- Action types: Create record, update record, log, send email, etc.
- Subflows: Reusable flow components
- Spokes: Integration action packages (Jira, Slack, etc.)

Use this to find the correct sys_id or name for triggers and actions
when creating flows programmatically with snow_create_flow.`,

  category: 'automation',
  subcategory: 'flow-designer',
  use_cases: ['discovery', 'flow-creation', 'documentation'],
  complexity: 'beginner',
  frequency: 'medium',

  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],

  inputSchema: {
    type: 'object',
    properties: {
      discover: {
        type: 'string',
        enum: ['trigger_types', 'action_types', 'subflows', 'spokes', 'all'],
        description: 'What to discover',
        default: 'all'
      },
      category: {
        type: 'string',
        description: 'Filter by category (for action types)'
      },
      search: {
        type: 'string',
        description: 'Search term to filter results'
      },
      limit: {
        type: 'number',
        description: 'Maximum results per category',
        default: 50
      },
      include_inactive: {
        type: 'boolean',
        description: 'Include inactive items',
        default: false
      }
    }
  }
};

// ==================== MAIN EXECUTOR ====================

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    discover = 'all',
    category,
    search,
    limit = 50,
    include_inactive = false
  } = args;

  try {
    const client = await getAuthenticatedClient(context);
    const results: any = {};

    // ==================== TRIGGER TYPES ====================
    if (discover === 'trigger_types' || discover === 'all') {
      console.log('Discovering trigger types...');

      try {
        let query = '';
        if (search) {
          query = `nameLIKE${search}^ORlabelLIKE${search}`;
        }

        const response = await client.get('/api/now/table/sys_hub_trigger_type', {
          params: {
            sysparm_query: query,
            sysparm_limit: limit,
            sysparm_fields: 'sys_id,name,label,description,table_name'
          }
        });

        if (response.data.result) {
          results.trigger_types = response.data.result.map((t: any) => ({
            sys_id: t.sys_id,
            name: t.name,
            label: t.label || t.name,
            description: t.description,
            table_name: t.table_name
          }));
          console.log(`Found ${results.trigger_types.length} trigger types`);
        }
      } catch (error: any) {
        console.error('Failed to fetch trigger types:', error.message);
        results.trigger_types_error = error.message;
      }
    }

    // ==================== ACTION TYPES ====================
    if (discover === 'action_types' || discover === 'all') {
      console.log('Discovering action types...');

      try {
        let query = include_inactive ? '' : 'active=true';

        if (category) {
          query += (query ? '^' : '') + `category=${category}`;
        }

        if (search) {
          query += (query ? '^' : '') + `nameLIKE${search}^ORlabelLIKE${search}`;
        }

        const response = await client.get('/api/now/table/sys_hub_action_type_base', {
          params: {
            sysparm_query: query,
            sysparm_limit: limit,
            sysparm_fields: 'sys_id,name,label,category,description,spoke'
          }
        });

        if (response.data.result) {
          results.action_types = response.data.result.map((a: any) => ({
            sys_id: a.sys_id,
            name: a.name,
            label: a.label || a.name,
            category: a.category,
            description: a.description,
            spoke: a.spoke
          }));
          console.log(`Found ${results.action_types.length} action types`);

          // Group by category for easier browsing
          const byCategory: Record<string, any[]> = {};
          for (const action of results.action_types) {
            const cat = action.category || 'Uncategorized';
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(action);
          }
          results.action_types_by_category = byCategory;
        }
      } catch (error: any) {
        console.error('Failed to fetch action types:', error.message);
        results.action_types_error = error.message;
      }
    }

    // ==================== SUBFLOWS ====================
    if (discover === 'subflows' || discover === 'all') {
      console.log('Discovering subflows...');

      try {
        let query = include_inactive ? '' : 'active=true';
        query += (query ? '^' : '') + 'type=subflow';

        if (search) {
          query += `^nameLIKE${search}^ORinternal_nameLIKE${search}`;
        }

        const response = await client.get('/api/now/table/sys_hub_flow', {
          params: {
            sysparm_query: query,
            sysparm_limit: limit,
            sysparm_fields: 'sys_id,name,internal_name,description'
          }
        });

        if (response.data.result) {
          results.subflows = response.data.result.map((s: any) => ({
            sys_id: s.sys_id,
            name: s.name,
            internal_name: s.internal_name,
            description: s.description
          }));
          console.log(`Found ${results.subflows.length} subflows`);
        }
      } catch (error: any) {
        console.error('Failed to fetch subflows:', error.message);
        results.subflows_error = error.message;
      }
    }

    // ==================== SPOKES (Integration Hubs) ====================
    if (discover === 'spokes' || discover === 'all') {
      console.log('Discovering spokes...');

      try {
        let query = include_inactive ? '' : 'active=true';

        if (search) {
          query += (query ? '^' : '') + `nameLIKE${search}^ORlabelLIKE${search}`;
        }

        const response = await client.get('/api/now/table/sys_hub_spoke', {
          params: {
            sysparm_query: query,
            sysparm_limit: limit,
            sysparm_fields: 'sys_id,name,label,description,version'
          }
        });

        if (response.data.result) {
          results.spokes = response.data.result.map((s: any) => ({
            sys_id: s.sys_id,
            name: s.name,
            label: s.label || s.name,
            description: s.description,
            version: s.version
          }));
          console.log(`Found ${results.spokes.length} spokes`);
        }
      } catch (error: any) {
        console.error('Failed to fetch spokes:', error.message);
        results.spokes_error = error.message;
      }
    }

    // ==================== COMMON ACTIONS REFERENCE ====================
    // Add a quick reference for common action types
    results.common_action_reference = {
      'Core Actions': [
        { name: 'Log', description: 'Write a message to the system log' },
        { name: 'Create Record', description: 'Create a new record in a table' },
        { name: 'Update Record', description: 'Update an existing record' },
        { name: 'Delete Record', description: 'Delete a record' },
        { name: 'Look Up Records', description: 'Query records from a table' },
        { name: 'Look Up Record', description: 'Get a single record by sys_id' },
        { name: 'Set Flow Variables', description: 'Set flow variable values' }
      ],
      'Communication': [
        { name: 'Send Email', description: 'Send an email notification' },
        { name: 'Send Event', description: 'Fire a system event' },
        { name: 'Create Task', description: 'Create a task record' }
      ],
      'Approvals': [
        { name: 'Ask For Approval', description: 'Request approval from users' },
        { name: 'Wait For Condition', description: 'Wait until a condition is met' }
      ],
      'Scripting': [
        { name: 'Run Script', description: 'Execute a server-side script' }
      ]
    };

    // ==================== COMMON TRIGGER REFERENCE ====================
    results.common_trigger_reference = {
      'Record Triggers': [
        { name: 'Created', description: 'When a record is created' },
        { name: 'Updated', description: 'When a record is updated' },
        { name: 'Deleted', description: 'When a record is deleted' },
        { name: 'Created or Updated', description: 'When a record is created or updated' }
      ],
      'Scheduled Triggers': [
        { name: 'Scheduled', description: 'Run on a schedule (daily, weekly, etc.)' },
        { name: 'Interval', description: 'Run at fixed intervals' }
      ],
      'Other Triggers': [
        { name: 'REST API', description: 'Triggered via REST API call' },
        { name: 'Inbound Email', description: 'Triggered by incoming email' },
        { name: 'Service Catalog', description: 'Triggered by catalog request' }
      ]
    };

    // Build summary
    const summary = {
      trigger_types: results.trigger_types?.length || 0,
      action_types: results.action_types?.length || 0,
      subflows: results.subflows?.length || 0,
      spokes: results.spokes?.length || 0
    };

    return createSuccessResult({
      discovered: discover,
      summary,
      ...results
    });

  } catch (error: any) {
    return createErrorResult(`Failed to discover flow components: ${error.message}`);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow v8.3.0 - Flow Designer Discovery';
