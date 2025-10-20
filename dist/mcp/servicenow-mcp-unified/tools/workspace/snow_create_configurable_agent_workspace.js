"use strict";
/**
 * snow_create_configurable_agent_workspace - Create agent workspace
 *
 * Create Configurable Agent Workspace using UX App architecture
 * (sys_ux_app_route, sys_ux_screen_type). Creates workspace with
 * screen collections for multiple tables.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_configurable_agent_workspace',
    description: 'Create Configurable Agent Workspace using UX App architecture (sys_ux_app_route, sys_ux_screen_type). Creates workspace with screen collections for multiple tables.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Agent workspace name'
            },
            description: {
                type: 'string',
                description: 'Workspace description'
            },
            tables: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tables for screen collections (e.g., ["incident", "task"])'
            },
            application: {
                type: 'string',
                default: 'global',
                description: 'Application scope'
            }
        },
        required: ['name', 'tables']
    }
};
async function execute(args, context) {
    const { name, description, tables, application = 'global' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const results = {
            workspace_name: name,
            screen_types: [],
            app_route_sys_id: ''
        };
        // Create App Route for workspace
        const routeName = name.toLowerCase().replace(/\s+/g, '-');
        const appRouteData = {
            name: routeName,
            route: `/${routeName}`,
            route_type: 'workspace',
            description: description || `Agent workspace: ${name}`,
            application: application,
            active: true
        };
        const appRouteResponse = await client.post('/api/now/table/sys_ux_app_route', appRouteData);
        results.app_route_sys_id = appRouteResponse.data.result.sys_id;
        // Create Screen Collections for each table
        for (const table of tables) {
            const screenTypeData = {
                name: `${name} - ${capitalizeTableName(table)}`,
                table: table,
                app_route: results.app_route_sys_id,
                description: `Screen collection for ${table}`,
                active: true
            };
            const screenTypeResponse = await client.post('/api/now/table/sys_ux_screen_type', screenTypeData);
            results.screen_types.push({
                table: table,
                sys_id: screenTypeResponse.data.result.sys_id,
                name: screenTypeData.name
            });
        }
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            workspace_name: name,
            workspace_type: 'Configurable Agent Workspace',
            app_route_sys_id: results.app_route_sys_id,
            screen_types: results.screen_types,
            workspace_url: `/now/workspace${appRouteData.route}`,
            tables_configured: tables.length,
            message: `Agent Workspace '${name}' created successfully with ${tables.length} screen collections`,
            next_steps: [
                'Configure screen layouts for each table',
                'Add related lists and contextual panels',
                'Customize workspace navigation',
                'Assign workspace to roles/groups'
            ]
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError ? error : error.message);
    }
}
function capitalizeTableName(tableName) {
    return tableName
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_configurable_agent_workspace.js.map