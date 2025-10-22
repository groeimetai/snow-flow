"use strict";
/**
 * snow_discover_schedules - Discover schedules
 *
 * Discovers schedules (business hours, maintenance windows) in the instance.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_discover_schedules',
    description: 'Discovers schedules (business hours, maintenance windows) in the instance.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'automation',
    subcategory: 'discovery',
    use_cases: ['automation', 'schedules', 'discovery'],
    complexity: 'beginner',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            nameContains: { type: 'string', description: 'Search by schedule name pattern' },
            type: { type: 'string', description: 'Filter by schedule type' },
            limit: { type: 'number', description: 'Maximum number of schedules to return', default: 50 }
        }
    }
};
async function execute(args, context) {
    const { nameContains, type, limit = 50 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Build query
        const queryParts = [];
        if (type) {
            queryParts.push(`type=${type}`);
        }
        if (nameContains) {
            queryParts.push(`nameLIKE${nameContains}`);
        }
        const query = queryParts.join('^');
        const response = await client.get(`/api/now/table/cmn_schedule?sysparm_query=${query}&sysparm_limit=${limit}&sysparm_display_value=true`);
        const schedules = response.data.result;
        const formattedSchedules = schedules.map((schedule) => ({
            sys_id: schedule.sys_id,
            name: schedule.name,
            description: schedule.description,
            type: schedule.type,
            time_zone: schedule.time_zone,
            parent_schedule: schedule.parent?.display_value || null,
            created_on: schedule.sys_created_on,
            updated_on: schedule.sys_updated_on
        }));
        return (0, error_handler_js_1.createSuccessResult)({
            found: true,
            count: formattedSchedules.length,
            schedules: formattedSchedules
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError
            ? error
            : new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.UNKNOWN_ERROR, error.message, { originalError: error }));
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_discover_schedules.js.map