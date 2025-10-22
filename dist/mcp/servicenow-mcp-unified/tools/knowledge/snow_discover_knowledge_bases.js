"use strict";
/**
 * snow_discover_knowledge_bases - Discover knowledge bases
 *
 * Discovers available knowledge bases and their categories in the ServiceNow instance.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_discover_knowledge_bases',
    description: 'Discovers available knowledge bases and their categories in the ServiceNow instance.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'knowledge',
    use_cases: ['knowledge', 'discovery', 'query'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            active_only: { type: 'boolean', description: 'Show only active knowledge bases', default: true }
        }
    }
};
async function execute(args, context) {
    const { active_only = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Build query
        const query = active_only ? 'active=true' : '';
        // Get knowledge bases
        const response = await client.get('/api/now/table/kb_knowledge_base', {
            params: {
                sysparm_query: query,
                sysparm_limit: 50
            }
        });
        const knowledgeBases = response.data.result;
        // Get categories for each knowledge base
        const kbWithCategories = await Promise.all(knowledgeBases.map(async (kb) => {
            const catResponse = await client.get('/api/now/table/kb_category', {
                params: {
                    sysparm_query: `kb_knowledge_base=${kb.sys_id}`,
                    sysparm_limit: 20
                }
            });
            return {
                ...kb,
                categories: catResponse.data.result
            };
        }));
        return (0, error_handler_js_1.createSuccessResult)({
            knowledge_bases: kbWithCategories,
            count: kbWithCategories.length
        }, {
            operation: 'discover_knowledge_bases',
            active_only
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_discover_knowledge_bases.js.map