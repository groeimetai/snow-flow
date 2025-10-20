"use strict";
/**
 * snow_event_handler
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_event_handler',
    description: 'Create event handler',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Handler name' },
            event_name: { type: 'string', description: 'Event name to handle' },
            script: { type: 'string', description: 'Handler script (ES5 only!)' }
        },
        required: ['name', 'event_name', 'script']
    }
};
async function execute(args, context) {
    const { name, event_name, script } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const handlerData = {
            name,
            event_name,
            script,
            active: true
        };
        const response = await client.post('/api/now/table/sysevent_script_action', handlerData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, event_handler: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_event_handler.js.map