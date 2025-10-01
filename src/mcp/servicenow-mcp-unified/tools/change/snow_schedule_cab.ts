/**
 * snow_schedule_cab - Schedule CAB meeting
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_schedule_cab',
  description: 'Schedule Change Advisory Board meeting',
  inputSchema: {
    type: 'object',
    properties: {
      change_request: { type: 'string' },
      meeting_date: { type: 'string' },
      attendees: { type: 'array', items: { type: 'string' } }
    },
    required: ['change_request', 'meeting_date']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { change_request, meeting_date, attendees = [] } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const cabData = { change_request, meeting_date, attendees: attendees.join(',') };
    const response = await client.post('/api/now/table/cab_meeting', cabData);
    return createSuccessResult({ scheduled: true, meeting: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
