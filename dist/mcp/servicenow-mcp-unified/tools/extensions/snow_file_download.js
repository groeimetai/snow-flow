"use strict";
/**
 * snow_file_download
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_file_download',
    description: 'Download file from ServiceNow',
    // Metadata for tool discovery (not sent to LLM)
    category: 'core-operations',
    subcategory: 'attachments',
    use_cases: ['files', 'download', 'attachments'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            attachment_sys_id: { type: 'string', description: 'Attachment sys_id' }
        },
        required: ['attachment_sys_id']
    }
};
async function execute(args, context) {
    const { attachment_sys_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.get(`/api/now/attachment/${attachment_sys_id}/file`, {
            responseType: 'arraybuffer'
        });
        const base64Data = Buffer.from(response.data).toString('base64');
        return (0, error_handler_js_1.createSuccessResult)({
            downloaded: true,
            attachment_sys_id,
            file_data: base64Data,
            content_type: response.headers['content-type']
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_file_download.js.map