/**
 * snow_create_scheduled_job
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_scheduled_job',
  description: 'Create scheduled job',
  // Metadata for tool discovery (not sent to LLM)
  category: 'automation',
  subcategory: 'scheduling',
  use_cases: ['scheduled-jobs', 'background-scripts', 'automation'],
  complexity: 'intermediate',
  frequency: 'medium',

  // 🆕 Permission enforcement (Q1 2025)
  // Classification: WRITE - Create operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Job name' },
      script: { type: 'string', description: 'Script to execute (ES5 only!)' },
      run_type: { type: 'string', enum: ['once', 'periodically', 'daily', 'weekly', 'monthly'], default: 'periodically' },
      run_period: { type: 'string', description: 'Run period (for periodically)' },
      run_dayofweek: { type: 'string', description: 'Day of week (for weekly)' },
      run_dayofmonth: { type: 'string', description: 'Day of month (for monthly)' },
      run_time: { type: 'string', description: 'Run time' },
      active: { type: 'boolean', default: true }
    },
    required: ['name', 'script']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, script, run_type = 'periodically', run_period, run_dayofweek, run_dayofmonth, run_time, active = true } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const jobData: any = { name, script, run_type, active };
    if (run_period) jobData.run_period = run_period;
    if (run_dayofweek) jobData.run_dayofweek = run_dayofweek;
    if (run_dayofmonth) jobData.run_dayofmonth = run_dayofmonth;
    if (run_time) jobData.run_time = run_time;
    const response = await client.post('/api/now/table/sysauto_script', jobData);
    return createSuccessResult({ created: true, job: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
