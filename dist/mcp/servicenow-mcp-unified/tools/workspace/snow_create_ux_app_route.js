"use strict";
/**
 * snow_create_ux_app_route - Create UX app route
 *
 * STEP 5: Create Route Record (sys_ux_app_route) -
 * Defines the URL slug that leads to the page.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_ux_app_route',
    description: 'STEP 5: Create Route Record (sys_ux_app_route) - Defines the URL slug that leads to the page.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Route name - becomes URL slug (e.g., "home")'
            },
            app_config_sys_id: {
                type: 'string',
                description: 'App config sys_id from Step 2 (optional)'
            },
            experience_sys_id: {
                type: 'string',
                description: 'Experience sys_id (alternative to app_config_sys_id)'
            },
            page_sys_name: {
                type: 'string',
                description: 'Page sys_name from Step 4 registry (optional)'
            },
            route: {
                type: 'string',
                description: 'URL route path (e.g., "/home")'
            },
            description: {
                type: 'string',
                description: 'Route description'
            }
        },
        required: ['name']
    }
};
async function execute(args, context) {
    const { name, app_config_sys_id, experience_sys_id, page_sys_name, route, description } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Create route
        const routeData = {
            name,
            route: route || `/${name.toLowerCase().replace(/\s+/g, '-')}`,
            description: description || `Route for ${name}`,
            active: true
        };
        if (app_config_sys_id) {
            routeData.app_config = app_config_sys_id;
        }
        if (experience_sys_id) {
            routeData.experience = experience_sys_id;
        }
        if (page_sys_name) {
            routeData.page_sys_name = page_sys_name;
        }
        const response = await client.post('/api/now/table/sys_ux_app_route', routeData);
        const appRoute = response.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            route_sys_id: appRoute.sys_id,
            name: appRoute.name,
            route: appRoute.route,
            page_sys_name: appRoute.page_sys_name || null,
            full_url: `/now/experience${appRoute.route}`,
            message: `UX App Route '${name}' created successfully`,
            next_step: 'Update App Config landing page (Step 6) using snow_update_ux_app_config_landing_page'
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError ? error : error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_ux_app_route.js.map