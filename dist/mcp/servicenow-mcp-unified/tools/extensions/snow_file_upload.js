"use strict";
/**
 * snow_file_upload
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_file_upload',
    description: 'Upload file to ServiceNow',
    // Metadata for tool discovery (not sent to LLM)
    category: 'core-operations',
    subcategory: 'attachments',
    use_cases: ['files', 'upload', 'attachments'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            file_name: { type: 'string', description: 'File name' },
            content_type: { type: 'string', description: 'Content type' },
            file_data: { type: 'string', description: 'Base64 encoded file data' },
            table: { type: 'string', description: 'Target table' },
            record_sys_id: { type: 'string', description: 'Record sys_id' }
        },
        required: ['file_name', 'file_data', 'table', 'record_sys_id']
    }
};
async function execute(args, context) {
    const { file_name, content_type = 'application/octet-stream', file_data, table, record_sys_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.post(`/api/now/attachment/file?table_name=${table}&table_sys_id=${record_sys_id}&file_name=${file_name}`, Buffer.from(file_data, 'base64'), {
            headers: {
                'Content-Type': content_type
            }
        });
        return (0, error_handler_js_1.createSuccessResult)({
            uploaded: true,
            attachment: response.data.result
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_file_upload.js.map