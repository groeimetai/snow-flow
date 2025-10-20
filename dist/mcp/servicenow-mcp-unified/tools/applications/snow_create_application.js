"use strict";
/**
 * snow_create_application
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_application',
    description: 'Create scoped application',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Application name' },
            scope: { type: 'string', description: 'Application scope' },
            version: { type: 'string', description: 'Version', default: '1.0.0' },
            short_description: { type: 'string', description: 'Description' }
        },
        required: ['name', 'scope']
    }
};
async function execute(args, context) {
    const { name, scope, version = '1.0.0', short_description } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const appData = { name, scope, version };
        if (short_description)
            appData.short_description = short_description;
        const response = await client.post('/api/now/table/sys_app', appData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, application: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_application.js.map