"use strict";
/**
 * snow_create_schedule
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_schedule',
    description: 'Create work schedule',
    // Metadata for tool discovery (not sent to LLM)
    category: 'automation',
    subcategory: 'scheduling',
    use_cases: ['schedules', 'work-hours', 'sla'],
    complexity: 'intermediate',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Schedule name' },
            time_zone: { type: 'string', description: 'Time zone' },
            type: { type: 'string', enum: ['weekly', 'monthly', 'custom'], default: 'weekly' }
        },
        required: ['name']
    }
};
async function execute(args, context) {
    const { name, time_zone, type = 'weekly' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const scheduleData = { name, type };
        if (time_zone)
            scheduleData.time_zone = time_zone;
        const response = await client.post('/api/now/table/cmn_schedule', scheduleData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, schedule: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_schedule.js.map