"use strict";
/**
 * snow_search_knowledge - Search knowledge articles
 *
 * Searches knowledge articles using keywords, categories, or filters.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_search_knowledge',
    description: 'Searches knowledge articles using keywords, categories, or filters. Returns relevant articles with snippets.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'knowledge',
    use_cases: ['knowledge'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Search query text' },
            kb_knowledge_base: { type: 'string', description: 'Filter by knowledge base' },
            kb_category: { type: 'string', description: 'Filter by category' },
            workflow_state: { type: 'string', description: 'Filter by state (published, draft, etc.)' },
            limit: { type: 'number', description: 'Maximum results to return', default: 10 },
            include_content: { type: 'boolean', description: 'Include full article content', default: false }
        },
        required: ['query']
    }
};
async function execute(args, context) {
    const { query, kb_knowledge_base, kb_category, workflow_state = 'published', limit = 10, include_content = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Build query string
        let queryString = `short_descriptionLIKE${query}^ORtextLIKE${query}`;
        if (kb_knowledge_base) {
            queryString += `^kb_knowledge_base=${kb_knowledge_base}`;
        }
        if (kb_category) {
            queryString += `^kb_category=${kb_category}`;
        }
        if (workflow_state) {
            queryString += `^workflow_state=${workflow_state}`;
        }
        const response = await client.get('/api/now/table/kb_knowledge', {
            params: {
                sysparm_query: queryString,
                sysparm_limit: limit
            }
        });
        const articles = response.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            articles,
            count: articles.length,
            query_used: queryString
        }, {
            operation: 'search_knowledge',
            query,
            results: articles.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_search_knowledge.js.map