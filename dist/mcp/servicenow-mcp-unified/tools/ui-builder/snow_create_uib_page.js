"use strict";
/**
 * snow_create_uib_page - Create UI Builder pages
 *
 * Create Now Experience Framework UI Builder pages with automatic
 * routing and configuration.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_uib_page',
    description: 'Create UI Builder page with automatic routing and configuration',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Page name (internal identifier)'
            },
            title: {
                type: 'string',
                description: 'Page title (display name)'
            },
            description: {
                type: 'string',
                description: 'Page description'
            },
            route: {
                type: 'string',
                description: 'URL route (e.g., "/my-page")'
            },
            roles: {
                type: 'array',
                items: { type: 'string' },
                description: 'Required roles to access page',
                default: []
            },
            public: {
                type: 'boolean',
                description: 'Make page publicly accessible',
                default: false
            }
        },
        required: ['name', 'title']
    }
};
async function execute(args, context) {
    const { name, title, description = '', route, roles = [], public: isPublic = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Create UI Builder page
        const pageResponse = await client.post('/api/now/table/sys_ux_page', {
            name,
            title,
            description,
            type: 'page'
        });
        const pageSysId = pageResponse.data.result.sys_id;
        // Create route if specified
        let routeSysId;
        if (route) {
            const routeResponse = await client.post('/api/now/table/sys_ux_app_route', {
                page: pageSysId,
                route,
                roles: roles.join(','),
                public: isPublic
            });
            routeSysId = routeResponse.data.result.sys_id;
        }
        return (0, error_handler_js_1.createSuccessResult)({
            page: {
                sys_id: pageSysId,
                name,
                title,
                url: `${context.instanceUrl}/now/experience/page/${pageSysId}`
            },
            route: route ? {
                sys_id: routeSysId,
                route,
                url: `${context.instanceUrl}${route}`
            } : undefined
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_uib_page.js.map