"use strict";
/**
 * snow_discover_va_topics - Discover Virtual Agent topics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_discover_va_topics',
    description: 'Discovers available Virtual Agent topics and their configurations.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'ui-frameworks',
    subcategory: 'virtual-agent',
    use_cases: ['virtual-agent', 'topic-discovery', 'conversational-ai'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            category: {
                type: 'string',
                description: 'Filter by category'
            },
            active_only: {
                type: 'boolean',
                description: 'Show only active topics',
                default: true
            }
        }
    }
};
async function execute(args, context) {
    const { category, active_only = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        let query = '';
        if (category) {
            query = `category=${category}`;
        }
        if (active_only) {
            query += query ? '^' : '';
            query += 'active=true';
        }
        const url = query
            ? `/api/now/table/sys_cs_topic?sysparm_query=${query}&sysparm_limit=50`
            : '/api/now/table/sys_cs_topic?sysparm_limit=50';
        const response = await client.get(url);
        const topics = response.data.result;
        if (!topics || topics.length === 0) {
            return (0, error_handler_js_1.createSuccessResult)({
                topics: [],
                count: 0,
                message: '❌ No Virtual Agent topics found'
            });
        }
        const topicList = topics.map((topic) => ({
            sys_id: topic.sys_id,
            name: topic.name,
            description: topic.description || 'No description',
            category: topic.category || 'General',
            active: topic.active === 'true' || topic.active === true,
            live_agent_enabled: topic.live_agent_enabled === 'true' || topic.live_agent_enabled === true
        }));
        return (0, error_handler_js_1.createSuccessResult)({
            topics: topicList,
            count: topicList.length,
            message: `🔍 Found ${topicList.length} Virtual Agent topic(s)`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_discover_va_topics.js.map