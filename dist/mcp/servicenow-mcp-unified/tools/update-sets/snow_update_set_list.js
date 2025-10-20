"use strict";
/**
 * snow_update_set_list - List Update Sets
 *
 * Lists Update Sets filtered by state (in_progress, complete, released).
 * Provides overview of recent changes and deployment readiness.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_update_set_list',
    description: 'List Update Sets filtered by state and recency',
    inputSchema: {
        type: 'object',
        properties: {
            state: {
                type: 'string',
                description: 'Filter by state',
                enum: ['in progress', 'complete', 'released']
            },
            limit: {
                type: 'number',
                description: 'Maximum number of results',
                default: 10
            },
            order_by: {
                type: 'string',
                description: 'Order by field (default: sys_created_on DESC)',
                default: 'sys_created_on'
            }
        }
    }
};
async function execute(args, context) {
    const { state, limit = 10, order_by = 'sys_created_on' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Build query
        let query = '';
        if (state) {
            query = `state=${state}`;
        }
        // Get Update Sets
        const response = await client.get('/api/now/table/sys_update_set', {
            params: {
                sysparm_query: query,
                sysparm_fields: 'sys_id,name,description,state,sys_created_on,sys_created_by,sys_updated_on',
                sysparm_limit: limit,
                sysparm_orderby: `DESC${order_by}`
            }
        });
        const updateSets = response.data.result || [];
        // Enrich with artifact counts
        const enrichedSets = await Promise.all(updateSets.map(async (us) => {
            const artifactsResponse = await client.get('/api/now/table/sys_update_xml', {
                params: {
                    sysparm_query: `update_set=${us.sys_id}`,
                    sysparm_fields: 'sys_id',
                    sysparm_limit: 1
                }
            });
            return {
                sys_id: us.sys_id,
                name: us.name,
                description: us.description,
                state: us.state,
                created_at: us.sys_created_on,
                created_by: us.sys_created_by,
                updated_at: us.sys_updated_on,
                artifact_count: artifactsResponse.data.result?.length || 0
            };
        }));
        return (0, error_handler_js_1.createSuccessResult)({
            update_sets: enrichedSets,
            count: enrichedSets.length,
            filtered_by: state || 'all',
            limit
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_update_set_list.js.map