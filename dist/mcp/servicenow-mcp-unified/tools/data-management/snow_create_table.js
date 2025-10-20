"use strict";
/**
 * snow_create_table
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_table',
    description: 'Create new database table',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Table name' },
            label: { type: 'string', description: 'Table label' },
            extends_table: { type: 'string', description: 'Parent table to extend' },
            is_extendable: { type: 'boolean', default: true }
        },
        required: ['name', 'label']
    }
};
async function execute(args, context) {
    const { name, label, extends_table, is_extendable = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const tableData = { name, label, is_extendable };
        if (extends_table)
            tableData.super_class = extends_table;
        const response = await client.post('/api/now/table/sys_db_object', tableData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, table: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_table.js.map