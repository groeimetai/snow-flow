"use strict";
/**
 * snow_create_variable_set
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_variable_set',
    description: 'Create reusable variable set',
    inputSchema: {
        type: 'object',
        properties: {
            title: { type: 'string', description: 'Variable set title' },
            description: { type: 'string', description: 'Description' },
            internal_name: { type: 'string', description: 'Internal name' }
        },
        required: ['title', 'internal_name']
    }
};
async function execute(args, context) {
    const { title, description, internal_name } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const setData = { title, internal_name };
        if (description)
            setData.description = description;
        const response = await client.post('/api/now/table/item_option_new_set', setData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, variable_set: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_variable_set.js.map