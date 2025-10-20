"use strict";
/**
 * snow_get_knowledge_article_details - Get article details
 *
 * Gets detailed information about a knowledge article including metadata and content.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_knowledge_article_details',
    description: 'Gets detailed information about a knowledge article including metadata and content.',
    inputSchema: {
        type: 'object',
        properties: {
            sys_id: { type: 'string', description: 'Article sys_id' },
            include_attachments: { type: 'boolean', description: 'Include attachment information', default: false }
        },
        required: ['sys_id']
    }
};
async function execute(args, context) {
    const { sys_id, include_attachments = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Get article details
        const response = await client.get(`/api/now/table/kb_knowledge/${sys_id}`);
        const article = response.data.result;
        // Get attachments if requested
        let attachments = [];
        if (include_attachments) {
            const attachResponse = await client.get('/api/now/table/sys_attachment', {
                params: {
                    sysparm_query: `table_name=kb_knowledge^table_sys_id=${sys_id}`,
                    sysparm_limit: 50
                }
            });
            attachments = attachResponse.data.result;
        }
        return (0, error_handler_js_1.createSuccessResult)({
            article,
            attachments: include_attachments ? attachments : undefined,
            attachment_count: attachments.length
        }, {
            operation: 'get_article_details',
            article_id: sys_id
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_get_knowledge_article_details.js.map