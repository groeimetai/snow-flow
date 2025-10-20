"use strict";
/**
 * snow_error_handler
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_error_handler',
    description: 'Create error handler',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Handler name' },
            error_type: { type: 'string', description: 'Error type to handle' },
            handler_script: { type: 'string', description: 'Handler script (ES5 only!)' }
        },
        required: ['name', 'error_type', 'handler_script']
    }
};
async function execute(args, context) {
    const { name, error_type, handler_script } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const handlerData = {
            name,
            type: error_type,
            script: handler_script,
            active: true
        };
        const response = await client.post('/api/now/table/sys_error_handler', handlerData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, handler: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_error_handler.js.map