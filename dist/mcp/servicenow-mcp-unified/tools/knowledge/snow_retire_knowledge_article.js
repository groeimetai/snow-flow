"use strict";
/**
 * snow_retire_knowledge_article - Retire article
 *
 * Retires a knowledge article, making it unavailable for general use while preserving history.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_retire_knowledge_article',
    description: 'Retires a knowledge article, making it unavailable for general use while preserving history.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'knowledge',
    use_cases: ['knowledge', 'retire', 'workflow'],
    complexity: 'beginner',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            sys_id: { type: 'string', description: 'Article sys_id to retire' },
            retirement_reason: { type: 'string', description: 'Reason for retirement' },
            replacement_article: { type: 'string', description: 'Replacement article sys_id (optional)' }
        },
        required: ['sys_id']
    }
};
async function execute(args, context) {
    const { sys_id, retirement_reason, replacement_article } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const updateData = {
            workflow_state: 'retired',
            retirement_date: new Date().toISOString()
        };
        if (retirement_reason)
            updateData.retirement_reason = retirement_reason;
        if (replacement_article)
            updateData.replacement_article = replacement_article;
        const response = await client.patch(`/api/now/table/kb_knowledge/${sys_id}`, updateData);
        return (0, error_handler_js_1.createSuccessResult)({
            retired: true,
            article: response.data.result,
            sys_id
        }, {
            operation: 'retire_article',
            reason: retirement_reason
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_retire_knowledge_article.js.map