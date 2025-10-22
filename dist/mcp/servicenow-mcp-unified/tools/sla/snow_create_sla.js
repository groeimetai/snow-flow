"use strict";
/**
 * snow_create_sla
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_sla',
    description: 'Create Service Level Agreement',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'sla',
    use_cases: ['sla-management', 'service-level', 'agreements'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'SLA name' },
            table: { type: 'string', description: 'Table name' },
            duration: { type: 'string', description: 'Duration (e.g., "4 Hours")' },
            condition: { type: 'string', description: 'When SLA applies' },
            schedule: { type: 'string', description: 'Schedule sys_id' },
            active: { type: 'boolean', default: true }
        },
        required: ['name', 'table', 'duration']
    }
};
async function execute(args, context) {
    const { name, table, duration, condition, schedule, active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const slaData = { name, collection: table, duration, active };
        if (condition)
            slaData.condition = condition;
        if (schedule)
            slaData.schedule = schedule;
        const response = await client.post('/api/now/table/contract_sla', slaData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, sla: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_sla.js.map