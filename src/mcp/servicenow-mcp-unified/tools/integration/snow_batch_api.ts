/**
 * snow_batch_api - Batch API operations (80% API reduction)
 *
 * Execute multiple API operations in a single request using ServiceNow's
 * Batch API, dramatically reducing network overhead and improving performance.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_batch_api',
  description: 'Execute multiple API operations in single request (80% API call reduction)',
  // Metadata for tool discovery (not sent to LLM)
  category: 'integration',
  subcategory: 'api',
  use_cases: ['integration', 'api', 'batch'],
  complexity: 'advanced',
  frequency: 'medium',
  inputSchema: {
    type: 'object',
    properties: {
      requests: {
        type: 'array',
        description: 'Array of API requests to batch',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique identifier for this request' },
            method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
            url: { type: 'string', description: 'API endpoint path' },
            headers: { type: 'object', description: 'Request headers' },
            body: { type: 'object', description: 'Request body (for POST/PUT/PATCH)' }
          },
          required: ['id', 'method', 'url']
        }
      },
      batch_execution_order: {
        type: 'string',
        enum: ['sequential', 'parallel'],
        description: 'Execute requests sequentially or in parallel',
        default: 'parallel'
      },
      exclude_reference_link: {
        type: 'boolean',
        description: 'Exclude reference links in responses',
        default: true
      }
    },
    required: ['requests']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { requests, batch_execution_order = 'parallel', exclude_reference_link = true } = args;

  try {
    const client = await getAuthenticatedClient(context);

    if (!requests || requests.length === 0) {
      throw new SnowFlowError(
        ErrorType.VALIDATION_ERROR,
        'At least one request is required',
        { details: { message: 'Provide requests array with API operations' } }
      );
    }

    if (requests.length > 100) {
      throw new SnowFlowError(
        ErrorType.VALIDATION_ERROR,
        'Maximum 100 requests allowed in batch',
        { details: { provided: requests.length, maximum: 100 } }
      );
    }

    // Build batch request payload
    const batchPayload = {
      batch_request_id: `batch_${Date.now()}`,
      rest_requests: requests.map((req: any) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        headers: {
          ...req.headers,
          'Content-Type': 'application/json'
        },
        body: req.body ? JSON.stringify(req.body) : undefined,
        exclude_reference_link: exclude_reference_link.toString()
      }))
    };

    // Execute batch request
    const response = await client.post('/api/now/v1/batch', batchPayload, {
      params: {
        execution_order: batch_execution_order
      }
    });

    const batchResult = response.data;

    // Parse responses
    const responses = (batchResult.serviced_requests || []).map((serviceReq: any) => ({
      id: serviceReq.id,
      status_code: serviceReq.status_code,
      status_text: serviceReq.status_text,
      body: serviceReq.body ? JSON.parse(serviceReq.body) : null,
      headers: serviceReq.headers,
      execution_time_ms: serviceReq.execution_time_ms
    }));

    // Calculate statistics
    const stats = {
      total_requests: requests.length,
      successful: responses.filter((r: any) => r.status_code >= 200 && r.status_code < 300).length,
      failed: responses.filter((r: any) => r.status_code >= 400).length,
      total_execution_time_ms: responses.reduce((sum: number, r: any) => sum + (r.execution_time_ms || 0), 0),
      average_time_per_request: responses.length > 0
        ? responses.reduce((sum: number, r: any) => sum + (r.execution_time_ms || 0), 0) / responses.length
        : 0,
      api_call_reduction: Math.round(((requests.length - 1) / requests.length) * 100)
    };

    return createSuccessResult({
      batch_id: batchResult.batch_request_id,
      execution_order: batch_execution_order,
      responses,
      statistics: stats,
      all_successful: stats.failed === 0,
      performance_gain: `${stats.api_call_reduction}% fewer API calls`
    });

  } catch (error: any) {
    return createErrorResult(
      error instanceof SnowFlowError ? error : error.message
    );
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
