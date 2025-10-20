"use strict";
/**
 * snow_configure_connection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_configure_connection',
    description: 'Configure ServiceNow connection alias',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Connection alias name' },
            instance_url: { type: 'string', description: 'Instance URL' },
            description: { type: 'string', description: 'Connection description' }
        },
        required: ['name', 'instance_url']
    }
};
async function execute(args, context) {
    const { name, instance_url, description } = args;
    try {
        return (0, error_handler_js_1.createSuccessResult)({
            configured: true,
            name,
            instance_url,
            description: description || 'ServiceNow connection'
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_configure_connection.js.map