/**
 * snow_create_incident - Specialized incident creation
 *
 * Create incidents with smart defaults, assignment, categorization,
 * and SLA tracking.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_incident',
  description: 'Create ServiceNow incident with smart defaults and assignment',
  inputSchema: {
    type: 'object',
    properties: {
      short_description: {
        type: 'string',
        description: 'Brief description of the incident'
      },
      description: {
        type: 'string',
        description: 'Detailed description'
      },
      caller_id: {
        type: 'string',
        description: 'User sys_id or username of caller'
      },
      urgency: {
        type: 'number',
        description: '1=High, 2=Medium, 3=Low',
        enum: [1, 2, 3],
        default: 3
      },
      impact: {
        type: 'number',
        description: '1=High, 2=Medium, 3=Low',
        enum: [1, 2, 3],
        default: 3
      },
      category: {
        type: 'string',
        description: 'Incident category (e.g., "software", "hardware")'
      },
      subcategory: {
        type: 'string',
        description: 'Incident subcategory'
      },
      assignment_group: {
        type: 'string',
        description: 'Assignment group sys_id or name'
      },
      assigned_to: {
        type: 'string',
        description: 'Assigned user sys_id or username'
      },
      configuration_item: {
        type: 'string',
        description: 'Configuration Item sys_id or name'
      },
      auto_assign: {
        type: 'boolean',
        description: 'Auto-assign based on category and assignment rules',
        default: false
      }
    },
    required: ['short_description']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    short_description,
    description = '',
    caller_id,
    urgency = 3,
    impact = 3,
    category,
    subcategory,
    assignment_group,
    assigned_to,
    configuration_item,
    auto_assign = false
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Build incident data
    const incidentData: any = {
      short_description,
      description,
      urgency,
      impact,
      category,
      subcategory
    };

    // Resolve caller_id (could be sys_id or username)
    if (caller_id) {
      if (caller_id.length === 32) {
        incidentData.caller_id = caller_id;
      } else {
        const userResponse = await client.get('/api/now/table/sys_user', {
          params: {
            sysparm_query: `user_name=${caller_id}`,
            sysparm_fields: 'sys_id',
            sysparm_limit: 1
          }
        });
        if (userResponse.data.result && userResponse.data.result.length > 0) {
          incidentData.caller_id = userResponse.data.result[0].sys_id;
        }
      }
    }

    // Resolve assignment_group (could be sys_id or name)
    if (assignment_group) {
      if (assignment_group.length === 32) {
        incidentData.assignment_group = assignment_group;
      } else {
        const groupResponse = await client.get('/api/now/table/sys_user_group', {
          params: {
            sysparm_query: `name=${assignment_group}`,
            sysparm_fields: 'sys_id',
            sysparm_limit: 1
          }
        });
        if (groupResponse.data.result && groupResponse.data.result.length > 0) {
          incidentData.assignment_group = groupResponse.data.result[0].sys_id;
        }
      }
    }

    // Resolve assigned_to (could be sys_id or username)
    if (assigned_to) {
      if (assigned_to.length === 32) {
        incidentData.assigned_to = assigned_to;
      } else {
        const userResponse = await client.get('/api/now/table/sys_user', {
          params: {
            sysparm_query: `user_name=${assigned_to}`,
            sysparm_fields: 'sys_id',
            sysparm_limit: 1
          }
        });
        if (userResponse.data.result && userResponse.data.result.length > 0) {
          incidentData.assigned_to = userResponse.data.result[0].sys_id;
        }
      }
    }

    // Resolve configuration_item (could be sys_id or name)
    if (configuration_item) {
      if (configuration_item.length === 32) {
        incidentData.cmdb_ci = configuration_item;
      } else {
        const ciResponse = await client.get('/api/now/table/cmdb_ci', {
          params: {
            sysparm_query: `name=${configuration_item}`,
            sysparm_fields: 'sys_id',
            sysparm_limit: 1
          }
        });
        if (ciResponse.data.result && ciResponse.data.result.length > 0) {
          incidentData.cmdb_ci = ciResponse.data.result[0].sys_id;
        }
      }
    }

    // Auto-assign if requested
    if (auto_assign && !incidentData.assignment_group && category) {
      const assignmentRules = await client.get('/api/now/table/sys_auto_assignment', {
        params: {
          sysparm_query: `table=incident^category=${category}^active=true`,
          sysparm_fields: 'assignment_group',
          sysparm_limit: 1,
          sysparm_order_by: 'order'
        }
      });

      if (assignmentRules.data.result && assignmentRules.data.result.length > 0) {
        incidentData.assignment_group = assignmentRules.data.result[0].assignment_group;
      }
    }

    // Calculate priority (P = U × I formula)
    // Priority matrix: 1=Critical, 2=High, 3=Moderate, 4=Low, 5=Planning
    const priorityMatrix: Record<string, number> = {
      '1-1': 1, '1-2': 2, '1-3': 2,
      '2-1': 2, '2-2': 3, '2-3': 3,
      '3-1': 2, '3-2': 3, '3-3': 4
    };
    incidentData.priority = priorityMatrix[`${urgency}-${impact}`] || 5;

    // Create incident
    const response = await client.post('/api/now/table/incident', incidentData, {
      params: {
        sysparm_display_value: 'all',
        sysparm_exclude_reference_link: 'true'
      }
    });

    const incident = response.data.result;

    return createSuccessResult({
      created: true,
      number: incident.number,
      sys_id: incident.sys_id,
      priority: incident.priority,
      state: incident.state,
      incident: {
        number: incident.number,
        sys_id: incident.sys_id,
        short_description: incident.short_description,
        priority: incident.priority,
        urgency: incident.urgency,
        impact: incident.impact,
        state: incident.state,
        assignment_group: incident.assignment_group,
        assigned_to: incident.assigned_to,
        caller: incident.caller_id
      },
      url: `${context.instanceUrl}/incident.do?sys_id=${incident.sys_id}`
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
