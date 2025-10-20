"use strict";
/**
 * snow_search_kb - Search knowledge base
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_search_kb',
    description: 'Search knowledge base articles',
    inputSchema: {
        type: 'object',
        properties: {
            search_term: { type: 'string' },
            kb_knowledge_base: { type: 'string' },
            limit: { type: 'number', default: 10 }
        },
        required: ['search_term']
    }
};
async function execute(args, context) {
    const { search_term, kb_knowledge_base, limit = 10 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        let query = `textINDEXOF${search_term}^ORshort_descriptionLIKE${search_term}^workflow_state=published`;
        if (kb_knowledge_base)
            query += `^kb_knowledge_base=${kb_knowledge_base}`;
        const response = await client.get('/api/now/table/kb_knowledge', {
            params: { sysparm_query: query, sysparm_limit: limit }
        });
        return (0, error_handler_js_1.createSuccessResult)({ articles: response.data.result, count: response.data.result.length });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_search_kb.js.map