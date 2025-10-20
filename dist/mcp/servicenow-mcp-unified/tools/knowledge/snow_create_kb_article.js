"use strict";
/**
 * snow_create_kb_article - Create knowledge article
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_kb_article',
    description: 'Create knowledge base article',
    inputSchema: {
        type: 'object',
        properties: {
            short_description: { type: 'string' },
            text: { type: 'string' },
            kb_knowledge_base: { type: 'string' },
            kb_category: { type: 'string' },
            workflow_state: { type: 'string', default: 'draft' }
        },
        required: ['short_description', 'text']
    }
};
async function execute(args, context) {
    const { short_description, text, kb_knowledge_base, kb_category, workflow_state = 'draft' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const articleData = { short_description, text, workflow_state };
        if (kb_knowledge_base)
            articleData.kb_knowledge_base = kb_knowledge_base;
        if (kb_category)
            articleData.kb_category = kb_category;
        const response = await client.post('/api/now/table/kb_knowledge', articleData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, article: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_kb_article.js.map