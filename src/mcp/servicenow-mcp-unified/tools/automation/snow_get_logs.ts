/**
 * snow_get_logs - Access system logs
 *
 * Retrieve ServiceNow system logs with filtering by level, source,
 * and time range for debugging and monitoring.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_get_logs',
  description: 'Retrieve ServiceNow system logs with filtering by level, source, and time range',
  // Metadata for tool discovery (not sent to LLM)
  category: 'automation',
  subcategory: 'monitoring',
  use_cases: ['automation', 'logs', 'monitoring'],
  complexity: 'beginner',
  frequency: 'high',
  inputSchema: {
    type: 'object',
    properties: {
      level: {
        type: 'string',
        enum: ['error', 'warn', 'info', 'debug', 'all'],
        description: 'Log level filter',
        default: 'all'
      },
      source: {
        type: 'string',
        description: 'Filter by log source (e.g., widget name, script name)'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of log entries to return',
        default: 100,
        minimum: 1,
        maximum: 1000
      },
      since: {
        type: 'string',
        description: 'Get logs since this timestamp (ISO 8601 or relative like "1h", "30m")'
      },
      search: {
        type: 'string',
        description: 'Search term in log messages'
      }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { level = 'all', source, limit = 100, since, search } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Build query
    const queryParts: string[] = [];

    // Level filter
    if (level !== 'all') {
      queryParts.push(`level=${level}`);
    }

    // Source filter
    if (source) {
      queryParts.push(`sourceLIKE${source}`);
    }

    // Time range filter
    if (since) {
      const sinceTimestamp = parseRelativeTime(since);
      queryParts.push(`sys_created_on>${sinceTimestamp}`);
    }

    // Search filter
    if (search) {
      queryParts.push(`messageLIKE${search}`);
    }

    const query = queryParts.join('^');

    // Get logs from syslog table
    const response = await client.get('/api/now/table/syslog', {
      params: {
        sysparm_query: query + '^ORDERBYDESCsys_created_on',
        sysparm_limit: limit,
        sysparm_fields: 'sys_created_on,level,source,message,sys_id'
      }
    });

    const logs = response.data.result.map((log: any) => ({
      timestamp: log.sys_created_on,
      level: log.level,
      source: log.source,
      message: log.message,
      sys_id: log.sys_id
    }));

    // Categorize by level
    const byLevel = {
      error: logs.filter((l: any) => l.level === 'error').length,
      warn: logs.filter((l: any) => l.level === 'warn').length,
      info: logs.filter((l: any) => l.level === 'info').length,
      debug: logs.filter((l: any) => l.level === 'debug').length
    };

    return createSuccessResult({
      logs,
      count: logs.length,
      by_level: byLevel,
      filters: { level, source, since, search }
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

function parseRelativeTime(relative: string): string {
  const now = new Date();
  const match = relative.match(/^(\d+)([mhd])$/);

  if (!match) {
    // Assume it's an absolute timestamp
    return relative;
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  let milliseconds = 0;
  switch (unit) {
    case 'm': milliseconds = value * 60 * 1000; break;
    case 'h': milliseconds = value * 60 * 60 * 1000; break;
    case 'd': milliseconds = value * 24 * 60 * 60 * 1000; break;
  }

  const since = new Date(now.getTime() - milliseconds);
  return since.toISOString();
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
