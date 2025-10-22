"use strict";
/**
 * snow_update_ux_app_config_landing_page - Update landing page
 *
 * STEP 6: Update App Configuration with Landing Page Route -
 * Sets the default landing page for the workspace.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_update_ux_app_config_landing_page',
    description: 'STEP 6: Update App Configuration with Landing Page Route - Sets the default landing page for the workspace.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'ui-frameworks',
    subcategory: 'workspace',
    use_cases: ['workspace', 'configuration', 'landing-page'],
    complexity: 'beginner',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            app_config_sys_id: {
                type: 'string',
                description: 'App config sys_id from Step 2'
            },
            route_name: {
                type: 'string',
                description: 'Route name from Step 5'
            }
        },
        required: ['app_config_sys_id', 'route_name']
    }
};
async function execute(args, context) {
    const { app_config_sys_id, route_name } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Validate app config exists
        const appConfigCheck = await client.get(`/api/now/table/sys_ux_app_config/${app_config_sys_id}`);
        if (!appConfigCheck.data.result) {
            throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.VALIDATION_ERROR, `App Config '${app_config_sys_id}' not found`, { details: { app_config_sys_id } });
        }
        // Update app config with landing page route
        const updateData = {
            landing_page: route_name
        };
        const response = await client.patch(`/api/now/table/sys_ux_app_config/${app_config_sys_id}`, updateData);
        const appConfig = response.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            updated: true,
            app_config_sys_id: appConfig.sys_id,
            landing_page: appConfig.landing_page,
            message: `App Configuration landing page set to '${route_name}'`,
            workspace_complete: true,
            summary: 'All 6 steps completed! Your UX workspace is now fully configured and ready to use.'
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError ? error : error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_update_ux_app_config_landing_page.js.map