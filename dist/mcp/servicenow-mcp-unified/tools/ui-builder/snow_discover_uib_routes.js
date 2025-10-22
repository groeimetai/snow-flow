"use strict";
/**
 * snow_discover_uib_routes - Find all routes
 *
 * Discovers all UI Builder page routes with security and
 * access control information.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_discover_uib_routes',
    description: 'Find all UI Builder page routes with security information',
    // Metadata for tool discovery (not sent to LLM)
    category: 'ui-builder',
    subcategory: 'routing',
    use_cases: ['ui-builder', 'routing', 'security'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            search: {
                type: 'string',
                description: 'Search route paths'
            },
            page_id: {
                type: 'string',
                description: 'Filter by page sys_id'
            },
            experience_id: {
                type: 'string',
                description: 'Filter by experience sys_id'
            },
            public_only: {
                type: 'boolean',
                description: 'Return only public routes',
                default: false
            },
            active_only: {
                type: 'boolean',
                description: 'Return only active routes',
                default: true
            },
            limit: {
                type: 'number',
                description: 'Maximum routes to return',
                default: 100
            }
        }
    }
};
async function execute(args, context) {
    const { search, page_id, experience_id, public_only = false, active_only = true, limit = 100 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Build query
        const queryParts = [];
        if (search)
            queryParts.push(`routeLIKE${search}`);
        if (page_id)
            queryParts.push(`page=${page_id}`);
        if (experience_id)
            queryParts.push(`experience=${experience_id}`);
        if (public_only)
            queryParts.push('public=true');
        if (active_only)
            queryParts.push('active=true');
        const query = queryParts.length > 0 ? queryParts.join('^') : '';
        const response = await client.get('/api/now/table/sys_ux_app_route', {
            params: {
                sysparm_query: query,
                sysparm_limit: limit
            }
        });
        const routes = response.data.result.map((route) => ({
            sys_id: route.sys_id,
            route: route.route,
            page_id: route.page,
            experience_id: route.experience,
            roles: route.roles ? route.roles.split(',') : [],
            public: route.public === 'true' || route.public === true,
            active: route.active === 'true' || route.active === true,
            url: `${context.instanceUrl}${route.route}`
        }));
        return (0, error_handler_js_1.createSuccessResult)({
            routes,
            total: routes.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_discover_uib_routes.js.map