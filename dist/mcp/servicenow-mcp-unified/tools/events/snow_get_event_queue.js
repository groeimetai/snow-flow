"use strict";
/**
 * snow_get_event_queue
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_event_queue',
    description: 'Get event queue status and pending events',
    // Metadata for tool discovery (not sent to LLM)
    category: 'automation',
    subcategory: 'event-management',
    use_cases: ['events', 'monitoring', 'troubleshooting'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            state: { type: 'string', enum: ['ready', 'processing', 'error'], description: 'Event state' },
            limit: { type: 'number', default: 50 }
        }
    }
};
async function execute(args, context) {
    const { state, limit = 50 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const query = state ? `state=${state}` : '';
        const response = await client.get('/api/now/table/sysevent', {
            params: { sysparm_query: query, sysparm_limit: limit }
        });
        return (0, error_handler_js_1.createSuccessResult)({ events: response.data.result, count: response.data.result.length });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_get_event_queue.js.map