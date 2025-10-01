/**
 * snow_file_download
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_file_download',
  description: 'Download file from ServiceNow',
  inputSchema: {
    type: 'object',
    properties: {
      attachment_sys_id: { type: 'string', description: 'Attachment sys_id' }
    },
    required: ['attachment_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { attachment_sys_id } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const response = await client.get(`/api/now/attachment/${attachment_sys_id}/file`, {
      responseType: 'arraybuffer'
    });

    const base64Data = Buffer.from(response.data).toString('base64');

    return createSuccessResult({
      downloaded: true,
      attachment_sys_id,
      file_data: base64Data,
      content_type: response.headers['content-type']
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
