"use strict";
/**
 * snow_create_uib_client_state - Create client state
 *
 * Creates client state management for UI Builder pages to manage
 * page state and persistence.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_uib_client_state',
    description: 'Create client state management for UI Builder pages',
    inputSchema: {
        type: 'object',
        properties: {
            page_id: {
                type: 'string',
                description: 'Target page sys_id'
            },
            name: {
                type: 'string',
                description: 'State variable name'
            },
            initial_value: {
                type: 'string',
                description: 'Initial state value (JSON string)'
            },
            persistent: {
                type: 'boolean',
                description: 'Persist state across sessions',
                default: false
            },
            scope: {
                type: 'string',
                description: 'State scope (page, session, global)',
                default: 'page'
            }
        },
        required: ['page_id', 'name']
    }
};
async function execute(args, context) {
    const { page_id, name, initial_value = '{}', persistent = false, scope = 'page' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.post('/api/now/table/sys_ux_client_state', {
            page: page_id,
            name,
            initial_value,
            persistent,
            scope
        });
        return (0, error_handler_js_1.createSuccessResult)({
            client_state: {
                sys_id: response.data.result.sys_id,
                name,
                scope,
                persistent,
                page_id
            }
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_uib_client_state.js.map