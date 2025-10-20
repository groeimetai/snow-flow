"use strict";
/**
 * snow_upload_attachment
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_upload_attachment',
    description: 'Upload attachment to record',
    inputSchema: {
        type: 'object',
        properties: {
            table_name: { type: 'string', description: 'Table name' },
            table_sys_id: { type: 'string', description: 'Record sys_id' },
            file_name: { type: 'string', description: 'File name' },
            content_type: { type: 'string', description: 'MIME type' },
            content: { type: 'string', description: 'Base64 encoded content' }
        },
        required: ['table_name', 'table_sys_id', 'file_name', 'content']
    }
};
async function execute(args, context) {
    const { table_name, table_sys_id, file_name, content_type = 'application/octet-stream', content } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.post(`/api/now/attachment/file?table_name=${table_name}&table_sys_id=${table_sys_id}&file_name=${file_name}`, Buffer.from(content, 'base64'), {
            headers: {
                'Content-Type': content_type
            }
        });
        return (0, error_handler_js_1.createSuccessResult)({ uploaded: true, attachment: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_upload_attachment.js.map