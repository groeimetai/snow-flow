"use strict";
/**
 * snow_get_logs - Access system logs
 *
 * Retrieve ServiceNow system logs with filtering by level, source,
 * and time range for debugging and monitoring.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_logs',
    description: 'Retrieve ServiceNow system logs with filtering by level, source, and time range',
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
async function execute(args, context) {
    const { level = 'all', source, limit = 100, since, search } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Build query
        const queryParts = [];
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
        const logs = response.data.result.map((log) => ({
            timestamp: log.sys_created_on,
            level: log.level,
            source: log.source,
            message: log.message,
            sys_id: log.sys_id
        }));
        // Categorize by level
        const byLevel = {
            error: logs.filter((l) => l.level === 'error').length,
            warn: logs.filter((l) => l.level === 'warn').length,
            info: logs.filter((l) => l.level === 'info').length,
            debug: logs.filter((l) => l.level === 'debug').length
        };
        return (0, error_handler_js_1.createSuccessResult)({
            logs,
            count: logs.length,
            by_level: byLevel,
            filters: { level, source, since, search }
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
function parseRelativeTime(relative) {
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
        case 'm':
            milliseconds = value * 60 * 1000;
            break;
        case 'h':
            milliseconds = value * 60 * 60 * 1000;
            break;
        case 'd':
            milliseconds = value * 24 * 60 * 60 * 1000;
            break;
    }
    const since = new Date(now.getTime() - milliseconds);
    return since.toISOString();
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_get_logs.js.map