"use strict";
/**
 * snow_discover_all_workspaces - Discover all workspaces
 *
 * Discover all workspaces (UX Experiences, Agent Workspaces, UI Builder pages)
 * with comprehensive details and usage analytics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_discover_all_workspaces',
    description: 'Discover all workspaces (UX Experiences, Agent Workspaces, UI Builder pages) with comprehensive details and usage analytics.',
    inputSchema: {
        type: 'object',
        properties: {
            include_ux_experiences: {
                type: 'boolean',
                default: true,
                description: 'Include Now Experience Framework workspaces'
            },
            include_agent_workspaces: {
                type: 'boolean',
                default: true,
                description: 'Include Configurable Agent Workspaces'
            },
            include_ui_builder: {
                type: 'boolean',
                default: true,
                description: 'Include UI Builder pages'
            },
            active_only: {
                type: 'boolean',
                default: true,
                description: 'Only show active workspaces'
            }
        }
    }
};
async function execute(args, context) {
    const { include_ux_experiences = true, include_agent_workspaces = true, include_ui_builder = true, active_only = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const discovery = {
            ux_experiences: [],
            agent_workspaces: [],
            ui_builder_pages: [],
            total_count: 0
        };
        // Discover UX Experiences
        if (include_ux_experiences) {
            const experiencesQuery = active_only ? 'active=true' : '';
            const experiencesResponse = await client.get('/api/now/table/sys_ux_experience', {
                params: {
                    sysparm_query: experiencesQuery,
                    sysparm_limit: 50,
                    sysparm_fields: 'sys_id,name,description,active'
                }
            });
            if (experiencesResponse.data.result) {
                discovery.ux_experiences = experiencesResponse.data.result.map((exp) => ({
                    type: 'UX Experience',
                    name: exp.name,
                    sys_id: exp.sys_id,
                    description: exp.description || 'No description',
                    active: exp.active,
                    url: `/now/experience/${exp.name?.toLowerCase().replace(/\s+/g, '-')}`
                }));
            }
        }
        // Discover Agent Workspaces
        if (include_agent_workspaces) {
            const routesQuery = active_only ? 'active=true^route_type=workspace' : 'route_type=workspace';
            const routesResponse = await client.get('/api/now/table/sys_ux_app_route', {
                params: {
                    sysparm_query: routesQuery,
                    sysparm_limit: 50,
                    sysparm_fields: 'sys_id,name,description,route,active'
                }
            });
            if (routesResponse.data.result) {
                discovery.agent_workspaces = routesResponse.data.result.map((route) => ({
                    type: 'Agent Workspace',
                    name: route.name,
                    sys_id: route.sys_id,
                    description: route.description || 'No description',
                    route: route.route,
                    active: route.active,
                    url: `/now/workspace${route.route}`
                }));
            }
        }
        // Discover UI Builder Pages
        if (include_ui_builder) {
            const pagesQuery = active_only ? 'active=true' : '';
            const pagesResponse = await client.get('/api/now/table/sys_ux_page', {
                params: {
                    sysparm_query: pagesQuery,
                    sysparm_limit: 50,
                    sysparm_fields: 'sys_id,name,description,active'
                }
            });
            if (pagesResponse.data.result) {
                discovery.ui_builder_pages = pagesResponse.data.result.map((page) => ({
                    type: 'UI Builder Page',
                    name: page.name,
                    sys_id: page.sys_id,
                    description: page.description || 'No description',
                    active: page.active
                }));
            }
        }
        discovery.total_count = discovery.ux_experiences.length +
            discovery.agent_workspaces.length +
            discovery.ui_builder_pages.length;
        return (0, error_handler_js_1.createSuccessResult)({
            discovery,
            summary: {
                ux_experiences: discovery.ux_experiences.length,
                agent_workspaces: discovery.agent_workspaces.length,
                ui_builder_pages: discovery.ui_builder_pages.length,
                total_workspaces: discovery.total_count
            },
            message: `Found ${discovery.total_count} workspaces across all types`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError ? error : error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_discover_all_workspaces.js.map