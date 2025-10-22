"use strict";
/**
 * snow_update_knowledge_article - Update article
 *
 * Updates an existing knowledge article. Can modify content, metadata, or workflow state.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_update_knowledge_article',
    description: 'Updates an existing knowledge article. Can modify content, metadata, or workflow state.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'knowledge',
    use_cases: ['knowledge', 'update', 'edit'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            sys_id: { type: 'string', description: 'Article sys_id to update' },
            short_description: { type: 'string', description: 'Updated title' },
            text: { type: 'string', description: 'Updated content' },
            workflow_state: { type: 'string', description: 'New state' },
            valid_to: { type: 'string', description: 'New expiration date' },
            meta_description: { type: 'string', description: 'Updated SEO description' },
            keywords: { type: 'array', items: { type: 'string' }, description: 'Updated keywords' }
        },
        required: ['sys_id']
    }
};
async function execute(args, context) {
    const { sys_id, short_description, text, workflow_state, valid_to, meta_description, keywords } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const updateData = {};
        if (short_description)
            updateData.short_description = short_description;
        if (text)
            updateData.text = text;
        if (workflow_state)
            updateData.workflow_state = workflow_state;
        if (valid_to)
            updateData.valid_to = valid_to;
        if (meta_description)
            updateData.meta_description = meta_description;
        if (keywords)
            updateData.keywords = keywords.join(',');
        const response = await client.patch(`/api/now/table/kb_knowledge/${sys_id}`, updateData);
        return (0, error_handler_js_1.createSuccessResult)({
            updated: true,
            article: response.data.result,
            sys_id
        }, {
            operation: 'update_article',
            fields_updated: Object.keys(updateData)
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_update_knowledge_article.js.map