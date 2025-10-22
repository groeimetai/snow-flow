"use strict";
/**
 * snow_find_artifact - Find ServiceNow artifacts using natural language
 *
 * Searches cached memory first for performance, then queries ServiceNow directly if needed.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_find_artifact',
    description: 'Finds ServiceNow artifacts using natural language queries. Searches cached memory first for performance, then queries ServiceNow directly if needed.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'search',
    use_cases: ['search', 'discovery', 'natural-language'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Natural language query (e.g., "the widget that shows incidents on homepage")'
            },
            type: {
                type: 'string',
                enum: ['widget', 'flow', 'script', 'application', 'any'],
                description: 'Artifact type filter'
            }
        },
        required: ['query']
    }
};
async function execute(args, context) {
    const { query, type = 'any' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Determine table based on type
        const tableMapping = {
            widget: 'sp_widget',
            flow: 'sys_hub_flow',
            script: 'sys_script_include',
            application: 'sys_app_application'
        };
        const table = type !== 'any' ? tableMapping[type] : null;
        // Search ServiceNow
        let results = [];
        if (table) {
            // Search specific table
            const response = await client.query(table, {
                query: `nameLIKE${query}^ORshort_descriptionLIKE${query}`,
                limit: 10
            });
            results = response.data?.result || [];
        }
        else {
            // Search across common tables
            const commonTables = ['sp_widget', 'sys_hub_flow', 'sys_script_include', 'sys_app_application'];
            for (const tbl of commonTables) {
                const response = await client.query(tbl, {
                    query: `nameLIKE${query}`,
                    limit: 5
                });
                if (response.data?.result) {
                    results.push(...response.data.result.map((r) => ({ ...r, _table: tbl })));
                }
            }
        }
        return (0, error_handler_js_1.createSuccessResult)({
            found: results.length > 0,
            count: results.length,
            results: results.map(r => ({
                sys_id: r.sys_id,
                name: r.name,
                title: r.title || r.name,
                table: r._table || table,
                description: r.short_description,
                active: r.active
            }))
        }, {
            query,
            type,
            table: table || 'multiple'
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error, {
            query,
            type
        });
    }
}
//# sourceMappingURL=snow_find_artifact.js.map