"use strict";
/**
 * snow_create_queue
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_queue',
    description: 'Create assignment queue',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'queues',
    use_cases: ['assignment-queues', 'work-distribution', 'routing'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Queue name' },
            table: { type: 'string', description: 'Table name' },
            condition: { type: 'string', description: 'Queue filter condition' },
            group: { type: 'string', description: 'Assignment group sys_id' }
        },
        required: ['name', 'table']
    }
};
async function execute(args, context) {
    const { name, table, condition, group } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const queueData = { name, table };
        if (condition)
            queueData.condition = condition;
        if (group)
            queueData.group = group;
        const response = await client.post('/api/now/table/sys_queue', queueData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, queue: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_queue.js.map