"use strict";
/**
 * snow_create_uib_client_script - Create client scripts
 *
 * Creates client-side JavaScript for UI Builder pages to handle
 * user interactions and page logic.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_uib_client_script',
    description: 'Create client-side JavaScript for UI Builder pages',
    // Metadata for tool discovery (not sent to LLM)
    category: 'ui-builder',
    subcategory: 'scripting',
    use_cases: ['ui-builder', 'scripts', 'client-side'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            page_id: {
                type: 'string',
                description: 'Target page sys_id'
            },
            name: {
                type: 'string',
                description: 'Client script name'
            },
            script: {
                type: 'string',
                description: 'JavaScript code to execute'
            },
            event: {
                type: 'string',
                description: 'Event trigger (e.g., "onLoad", "onChange")',
                default: 'onLoad'
            },
            order: {
                type: 'number',
                description: 'Execution order',
                default: 100
            },
            active: {
                type: 'boolean',
                description: 'Active state',
                default: true
            }
        },
        required: ['page_id', 'name', 'script']
    }
};
async function execute(args, context) {
    const { page_id, name, script, event = 'onLoad', order = 100, active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.post('/api/now/table/sys_ux_client_script', {
            page: page_id,
            name,
            script,
            event,
            order,
            active
        });
        return (0, error_handler_js_1.createSuccessResult)({
            client_script: {
                sys_id: response.data.result.sys_id,
                name,
                event,
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
//# sourceMappingURL=snow_create_uib_client_script.js.map