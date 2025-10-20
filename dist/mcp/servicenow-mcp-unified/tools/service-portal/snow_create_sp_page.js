"use strict";
/**
 * snow_create_sp_page - Create Service Portal page
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_sp_page',
    description: 'Create Service Portal page',
    inputSchema: {
        type: 'object',
        properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            public: { type: 'boolean', default: false }
        },
        required: ['id', 'title']
    }
};
async function execute(args, context) {
    const { id, title, public: isPublic = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.post('/api/now/table/sp_page', { id, title, public: isPublic });
        return (0, error_handler_js_1.createSuccessResult)({ created: true, page: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_sp_page.js.map