/**
 * snow_schedule_cab_meeting - Schedule CAB meeting
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_schedule_cab_meeting',
  description: 'Schedule a Change Advisory Board (CAB) meeting for change review',
  inputSchema: {
    type: 'object',
    properties: {
      change_request: { type: 'string', description: 'Change request sys_id' },
      meeting_date: { type: 'string', description: 'Meeting date/time' },
      attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee sys_ids' },
      agenda: { type: 'string', description: 'Meeting agenda' },
      location: { type: 'string', description: 'Meeting location or link' }
    },
    required: ['change_request', 'meeting_date']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { change_request, meeting_date, attendees, agenda, location } = args;
  try {
    const client = await getAuthenticatedClient(context);

    const cabData: any = {
      change_request,
      meeting_date,
      short_description: `CAB Meeting for ${change_request}`,
      sys_class_name: 'task'
    };

    if (attendees) cabData.attendees = attendees.join(',');
    if (agenda) cabData.agenda = agenda;
    if (location) cabData.location = location;

    const response = await client.post('/api/now/table/task', cabData);
    return createSuccessResult({ scheduled: true, meeting: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
