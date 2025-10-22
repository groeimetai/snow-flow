"use strict";
/**
 * snow_create_uib_page_registry - Configure URL routing
 *
 * Creates page registry entries to configure URL routing and
 * access control for UI Builder pages.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_uib_page_registry',
    description: 'Configure URL routing and access control for UI Builder pages',
    // Metadata for tool discovery (not sent to LLM)
    category: 'ui-builder',
    subcategory: 'routing',
    use_cases: ['ui-builder', 'routing', 'access-control'],
    complexity: 'intermediate',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            page_id: {
                type: 'string',
                description: 'Target page sys_id'
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
            },
            active: {
                type: 'boolean',
                description: 'Active state',
                default: true
            }
        },
        required: ['page_id', 'route']
    }
};
async function execute(args, context) {
    const { page_id, route, roles = [], public: isPublic = false, active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.post('/api/now/table/sys_ux_app_route', {
            page: page_id,
            route,
            roles: roles.join(','),
            public: isPublic,
            active
        });
        return (0, error_handler_js_1.createSuccessResult)({
            registry: {
                sys_id: response.data.result.sys_id,
                route,
                page_id,
                url: `${context.instanceUrl}${route}`
            }
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_uib_page_registry.js.map