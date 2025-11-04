/**
 * snow_update_incident - Specialized incident updates
 *
 * Update incidents with workflow awareness, state validation,
 * and automatic work note creation.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_update_incident',
  description: 'Update incident with state validation and automatic work notes',
  // Metadata for tool discovery (not sent to LLM)
  category: 'itsm',
  subcategory: 'operations',
  use_cases: ['incidents', 'update'],
  complexity: 'intermediate',
  frequency: 'high',

  // Permission enforcement
  // Classification: WRITE - Update operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      sys_id: {
        type: 'string',
        description: 'Incident sys_id or number'
      },
      state: {
        type: 'number',
        description: '1=New, 2=In Progress, 3=On Hold, 6=Resolved, 7=Closed',
        enum: [1, 2, 3, 6, 7]
      },
      assigned_to: {
        type: 'string',
        description: 'Assigned user sys_id or username'
      },
      assignment_group: {
        type: 'string',
        description: 'Assignment group sys_id or name'
      },
      work_notes: {
        type: 'string',
        description: 'Work notes to add (internal)'
      },
      comments: {
        type: 'string',
        description: 'Customer-visible comments'
      },
      resolution_code: {
        type: 'string',
        description: 'Resolution code (required when resolving)'
      },
      resolution_notes: {
        type: 'string',
        description: 'Resolution notes (required when resolving)'
      },
      close_code: {
        type: 'string',
        description: 'Close code (required when closing)'
      },
      close_notes: {
        type: 'string',
        description: 'Close notes (required when closing)'
      },
      validate_state_transition: {
        type: 'boolean',
        description: 'Validate state transitions are valid',
        default: true
      }
    },
    required: ['sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    sys_id,
    state,
    assigned_to,
    assignment_group,
    work_notes,
    comments,
    resolution_code,
    resolution_notes,
    close_code,
    close_notes,
    validate_state_transition = true
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Get incident (by sys_id or number)
    let incident;
    if (sys_id.length === 32) {
      const response = await client.get(`/api/now/table/incident/${sys_id}`, {
        params: { sysparm_fields: 'sys_id,number,state,assignment_group,assigned_to' }
      });
      incident = response.data.result;
    } else {
      const response = await client.get('/api/now/table/incident', {
        params: {
          sysparm_query: `number=${sys_id}`,
          sysparm_fields: 'sys_id,number,state,assignment_group,assigned_to',
          sysparm_limit: 1
        }
      });
      if (response.data.result && response.data.result.length > 0) {
        incident = response.data.result[0];
      }
    }

    if (!incident) {
      throw new SnowFlowError(
        ErrorType.NOT_FOUND_ERROR,
        `Incident not found: ${sys_id}`,
        { details: { sys_id } }
      );
    }

    const updateData: any = {};

    // Validate state transition
    if (state && validate_state_transition) {
      const currentState = parseInt(incident.state);
      const validTransitions: Record<number, number[]> = {
        1: [2, 6, 7],           // New → In Progress, Resolved, Closed
        2: [3, 6, 7],           // In Progress → On Hold, Resolved, Closed
        3: [2, 6, 7],           // On Hold → In Progress, Resolved, Closed
        6: [2, 7],              // Resolved → In Progress, Closed
        7: [2]                  // Closed → In Progress (reopen)
      };

      if (!validTransitions[currentState]?.includes(state)) {
        throw new SnowFlowError(
          ErrorType.VALIDATION_ERROR,
          `Invalid state transition from ${currentState} to ${state}`,
          {
            details: {
              current_state: currentState,
              requested_state: state,
              valid_transitions: validTransitions[currentState]
            }
          }
        );
      }

      updateData.state = state;

      // Validate resolution requirements
      if (state === 6) { // Resolved
        if (!resolution_code || !resolution_notes) {
          throw new SnowFlowError(
            ErrorType.VALIDATION_ERROR,
            'Resolution code and notes are required when resolving',
            { details: { missing_fields: ['resolution_code', 'resolution_notes'] } }
          );
        }
        updateData.resolution_code = resolution_code;
        updateData.resolution_notes = resolution_notes;
      }

      // Validate close requirements
      if (state === 7) { // Closed
        if (!close_code || !close_notes) {
          throw new SnowFlowError(
            ErrorType.VALIDATION_ERROR,
            'Close code and notes are required when closing',
            { details: { missing_fields: ['close_code', 'close_notes'] } }
          );
        }
        updateData.close_code = close_code;
        updateData.close_notes = close_notes;
      }
    } else if (state) {
      updateData.state = state;
    }

    // Resolve assigned_to
    if (assigned_to) {
      if (assigned_to.length === 32) {
        updateData.assigned_to = assigned_to;
      } else {
        const userResponse = await client.get('/api/now/table/sys_user', {
          params: {
            sysparm_query: `user_name=${assigned_to}`,
            sysparm_fields: 'sys_id',
            sysparm_limit: 1
          }
        });
        if (userResponse.data.result && userResponse.data.result.length > 0) {
          updateData.assigned_to = userResponse.data.result[0].sys_id;
        }
      }
    }

    // Resolve assignment_group
    if (assignment_group) {
      if (assignment_group.length === 32) {
        updateData.assignment_group = assignment_group;
      } else {
        const groupResponse = await client.get('/api/now/table/sys_user_group', {
          params: {
            sysparm_query: `name=${assignment_group}`,
            sysparm_fields: 'sys_id',
            sysparm_limit: 1
          }
        });
        if (groupResponse.data.result && groupResponse.data.result.length > 0) {
          updateData.assignment_group = groupResponse.data.result[0].sys_id;
        }
      }
    }

    // Add work notes and comments
    if (work_notes) {
      updateData.work_notes = work_notes;
    }
    if (comments) {
      updateData.comments = comments;
    }

    // Update incident
    const response = await client.put(`/api/now/table/incident/${incident.sys_id}`, updateData, {
      params: {
        sysparm_display_value: 'all',
        sysparm_exclude_reference_link: 'true'
      }
    });

    const updatedIncident = response.data.result;

    return createSuccessResult({
      updated: true,
      number: updatedIncident.number,
      sys_id: updatedIncident.sys_id,
      previous_state: incident.state,
      current_state: updatedIncident.state,
      incident: {
        number: updatedIncident.number,
        sys_id: updatedIncident.sys_id,
        state: updatedIncident.state,
        assignment_group: updatedIncident.assignment_group,
        assigned_to: updatedIncident.assigned_to
      },
      url: `${context.instanceUrl}/incident.do?sys_id=${updatedIncident.sys_id}`
    });

  } catch (error: any) {
    return createErrorResult(
      error instanceof SnowFlowError ? error : error.message
    );
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
