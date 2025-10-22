"use strict";
/**
 * snow_discover_pa_indicators - Discover PA indicators
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_discover_pa_indicators',
    description: 'Discovers available Performance Analytics indicators and their configurations',
    // Metadata for tool discovery (not sent to LLM)
    category: 'performance-analytics',
    subcategory: 'discovery',
    use_cases: ['performance-analytics', 'indicators', 'discovery'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Filter by table' },
            active_only: { type: 'boolean', description: 'Show only active indicators', default: true }
        }
    }
};
async function execute(args, context) {
    const { table, active_only } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        let query = '';
        if (table)
            query = `facts_table=${table}`;
        if (active_only !== false) {
            query += query ? '^' : '';
            query += 'active=true';
        }
        const response = await client.get('/api/now/table/pa_indicators', {
            params: {
                sysparm_query: query || '',
                sysparm_limit: 50
            }
        });
        return (0, error_handler_js_1.createSuccessResult)({
            indicators: response.data.result,
            count: response.data.result.length,
            message: `Found ${response.data.result.length} PA indicators`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_discover_pa_indicators.js.map