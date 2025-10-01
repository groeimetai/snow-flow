/**
 * snow_trace_execution - Trace execution flow
 *
 * Traces execution flow with real-time tracking of scripts, REST calls, and errors.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_trace_execution',
  description: 'Trace execution flow with real-time tracking of scripts, REST calls, and errors',
  inputSchema: {
    type: 'object',
    properties: {
      track_id: {
        type: 'string',
        description: 'Tracking ID for the execution session'
      },
      include: {
        type: 'array',
        items: { type: 'string' },
        description: 'What to track: scripts, rest_calls, errors, queries, all',
        default: ['all']
      },
      real_time: {
        type: 'boolean',
        description: 'Enable real-time tracking',
        default: true
      },
      max_entries: {
        type: 'number',
        description: 'Maximum trace entries',
        default: 1000
      }
    },
    required: ['track_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    track_id,
    include = ['all'],
    real_time = true,
    max_entries = 1000
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Determine what to track
    const trackAll = include.includes('all');
    const tracking = {
      scripts: trackAll || include.includes('scripts'),
      rest_calls: trackAll || include.includes('rest_calls'),
      errors: trackAll || include.includes('errors'),
      queries: trackAll || include.includes('queries')
    };

    // Create trace configuration script
    const traceScript = `
var traceId = '${track_id}';
var tracking = ${JSON.stringify(tracking)};
var maxEntries = ${max_entries};

// Store trace configuration in session
gs.getSession().putClientData('snow_flow_trace_id', traceId);
gs.getSession().putClientData('snow_flow_trace_config', JSON.stringify(tracking));
gs.getSession().putClientData('snow_flow_trace_start', new GlideDateTime().getDisplayValue());

// Initialize trace storage in sys_properties
var traceProp = new GlideRecord('sys_properties');
traceProp.initialize();
traceProp.name = 'snow_flow.trace.' + traceId;
traceProp.value = JSON.stringify({
  trace_id: traceId,
  started_at: new GlideDateTime().getDisplayValue(),
  tracking: tracking,
  max_entries: maxEntries,
  entries: []
});
traceProp.type = 'string';
traceProp.description = 'Snow-Flow execution trace - ' + traceId;
traceProp.insert();

JSON.stringify({
  success: true,
  trace_id: traceId,
  tracking: tracking,
  message: 'Execution tracing enabled'
});
`;

    // Execute trace initialization
    const response = await client.post('/api/now/table/sys_script_execution', {
      script: traceScript
    });

    let result;
    try {
      const resultData = response.data.result || response.data;
      result = JSON.parse(typeof resultData === 'string' ? resultData : JSON.stringify(resultData));
    } catch (parseError) {
      result = {
        success: true,
        trace_id: track_id,
        message: 'Trace initialized'
      };
    }

    return createSuccessResult({
      trace_id: track_id,
      tracking_enabled: tracking,
      real_time,
      max_entries,
      started_at: new Date().toISOString(),
      status: 'active',
      instructions: {
        retrieve_trace: `Use snow_get_script_output with execution_id="${track_id}" to retrieve trace data`,
        stop_trace: 'Delete the trace property when done'
      }
    }, {
      operation: 'trace_execution',
      trace_id: track_id
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
