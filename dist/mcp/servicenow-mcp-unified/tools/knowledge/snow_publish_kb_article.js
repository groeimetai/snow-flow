"use strict";
/**
 * snow_publish_kb_article - Publish KB article
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_publish_kb_article',
    description: 'Publish knowledge base article',
    inputSchema: {
        type: 'object',
        properties: {
            article_sys_id: { type: 'string' }
        },
        required: ['article_sys_id']
    }
};
async function execute(args, context) {
    const { article_sys_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.put(`/api/now/table/kb_knowledge/${article_sys_id}`, {
            workflow_state: 'published'
        });
        return (0, error_handler_js_1.createSuccessResult)({ published: true, article: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_publish_kb_article.js.map