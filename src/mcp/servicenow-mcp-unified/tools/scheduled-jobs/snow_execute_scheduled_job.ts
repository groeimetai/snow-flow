/**
 * snow_execute_scheduled_job
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_execute_scheduled_job',
  description: 'Execute scheduled job immediately',
  // Metadata for tool discovery (not sent to LLM)
  category: 'automation',
  subcategory: 'scheduling',
  use_cases: ['job-execution', 'testing', 'manual-trigger'],
  complexity: 'intermediate',
  frequency: 'medium',
  inputSchema: {
    type: 'object',
    properties: {
      job_sys_id: { type: 'string', description: 'Scheduled job sys_id' }
    },
    required: ['job_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { job_sys_id } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const executeScript = `
var job = new GlideRecord('sysauto_script');
if (job.get('${job_sys_id}')) {
  var worker = new GlideScriptedHierarchicalWorker();
  worker.setProgressName('Scheduled Job: ' + job.name);
  worker.setScriptIncludeName('ScheduledScriptExecution');
  worker.putMethodArg('sys_id', '${job_sys_id}');
  worker.setBackground(true);
  worker.start();
  gs.info('Job executed: ' + job.name);
}
    `;
    await client.post('/api/now/table/sys_script_execution', { script: executeScript });
    return createSuccessResult({
      executed: true,
      job: job_sys_id
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
