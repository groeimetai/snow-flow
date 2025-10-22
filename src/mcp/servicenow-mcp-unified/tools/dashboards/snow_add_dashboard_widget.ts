/**
 * snow_add_dashboard_widget
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_add_dashboard_widget',
  description: 'Add widget to dashboard',
  // Metadata for tool discovery (not sent to LLM)
  category: 'reporting',
  subcategory: 'dashboards',
  use_cases: ['dashboards', 'widgets', 'visualization'],
  complexity: 'beginner',
  frequency: 'medium',
  inputSchema: {
    type: 'object',
    properties: {
      dashboard_sys_id: { type: 'string', description: 'Dashboard sys_id' },
      widget_type: { type: 'string', description: 'Widget type' },
      title: { type: 'string', description: 'Widget title' },
      position: { type: 'number', description: 'Widget position' }
    },
    required: ['dashboard_sys_id', 'widget_type']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { dashboard_sys_id, widget_type, title, position } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const widgetData: any = {
      dashboard: dashboard_sys_id,
      type: widget_type
    };
    if (title) widgetData.title = title;
    if (position !== undefined) widgetData.position = position;
    const response = await client.post('/api/now/table/sys_dashboard_widget', widgetData);
    return createSuccessResult({ added: true, widget: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
