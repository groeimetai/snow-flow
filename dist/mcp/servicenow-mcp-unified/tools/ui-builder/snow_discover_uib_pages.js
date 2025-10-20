"use strict";
/**
 * snow_discover_uib_pages - Find all pages
 *
 * Discovers and lists all UI Builder pages with filtering options.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_discover_uib_pages',
    description: 'Find all UI Builder pages with filtering options',
    inputSchema: {
        type: 'object',
        properties: {
            search: {
                type: 'string',
                description: 'Search page names and titles'
            },
            experience: {
                type: 'string',
                description: 'Filter by experience sys_id'
            },
            active_only: {
                type: 'boolean',
                description: 'Return only active pages',
                default: true
            },
            include_routes: {
                type: 'boolean',
                description: 'Include route information',
                default: true
            },
            limit: {
                type: 'number',
                description: 'Maximum pages to return',
                default: 100
            }
        }
    }
};
async function execute(args, context) {
    const { search, experience, active_only = true, include_routes = true, limit = 100 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Build query
        const queryParts = [];
        if (search)
            queryParts.push(`nameLIKE${search}^ORtitleLIKE${search}`);
        if (experience)
            queryParts.push(`experience=${experience}`);
        if (active_only)
            queryParts.push('active=true');
        const query = queryParts.length > 0 ? queryParts.join('^') : '';
        const response = await client.get('/api/now/table/sys_ux_page', {
            params: {
                sysparm_query: query,
                sysparm_limit: limit
            }
        });
        const pages = [];
        for (const page of response.data.result) {
            const pageData = {
                sys_id: page.sys_id,
                name: page.name,
                title: page.title,
                description: page.description,
                active: page.active
            };
            if (include_routes) {
                // Get routes for this page
                const routesResponse = await client.get('/api/now/table/sys_ux_app_route', {
                    params: { sysparm_query: `page=${page.sys_id}` }
                });
                pageData.routes = routesResponse.data.result.map((route) => ({
                    sys_id: route.sys_id,
                    route: route.route,
                    url: `${context.instanceUrl}${route.route}`
                }));
            }
            pages.push(pageData);
        }
        return (0, error_handler_js_1.createSuccessResult)({
            pages,
            total: pages.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_discover_uib_pages.js.map