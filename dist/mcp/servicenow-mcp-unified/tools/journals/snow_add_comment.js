"use strict";
/**
 * snow_add_comment
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_add_comment',
    description: 'Add comment/work note to record',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Table name' },
            record_sys_id: { type: 'string', description: 'Record sys_id' },
            comment: { type: 'string', description: 'Comment text' },
            work_note: { type: 'boolean', default: false, description: 'Is work note (internal)' }
        },
        required: ['table', 'record_sys_id', 'comment']
    }
};
async function execute(args, context) {
    const { table, record_sys_id, comment, work_note = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const field = work_note ? 'work_notes' : 'comments';
        const updateData = { [field]: comment };
        const response = await client.patch(`/api/now/table/${table}/${record_sys_id}`, updateData);
        return (0, error_handler_js_1.createSuccessResult)({ added: true, type: work_note ? 'work_note' : 'comment' });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_add_comment.js.map