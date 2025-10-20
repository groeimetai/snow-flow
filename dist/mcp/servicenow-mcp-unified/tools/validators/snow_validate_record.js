"use strict";
/**
 * snow_validate_record
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_validate_record',
    description: 'Validate record against business rules',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Table name' },
            record_sys_id: { type: 'string', description: 'Record sys_id' }
        },
        required: ['table', 'record_sys_id']
    }
};
async function execute(args, context) {
    const { table, record_sys_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const validateScript = `
var gr = new GlideRecord('${table}');
if (gr.get('${record_sys_id}')) {
  var isValid = gr.isValidRecord();
  gs.info('Record valid: ' + isValid);
}
    `;
        await client.post('/api/now/table/sys_script_execution', { script: validateScript });
        return (0, error_handler_js_1.createSuccessResult)({
            validated: true,
            table,
            record_sys_id
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_validate_record.js.map