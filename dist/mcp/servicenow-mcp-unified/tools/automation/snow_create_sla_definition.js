"use strict";
/**
 * snow_create_sla_definition - Create SLA definition
 *
 * Creates Service Level Agreement definitions. Sets duration targets,
 * business schedules, and breach conditions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_sla_definition',
    description: 'Creates Service Level Agreement definitions. Sets duration targets, business schedules, and breach conditions.',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'SLA Definition name' },
            table: { type: 'string', description: 'Table to apply SLA to' },
            condition: { type: 'string', description: 'SLA condition script' },
            duration: { type: 'string', description: 'Duration specification (e.g., "8:00:00" for 8 hours)' },
            durationType: { type: 'string', description: 'Duration type (business, calendar)', default: 'business' },
            schedule: { type: 'string', description: 'Schedule to use (sys_id or name)' },
            active: { type: 'boolean', description: 'SLA active status', default: true },
            description: { type: 'string', description: 'SLA description' }
        },
        required: ['name', 'table', 'condition', 'duration']
    }
};
async function execute(args, context) {
    const { name, table, condition, duration, durationType = 'business', schedule, active = true, description = '' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Resolve schedule if name provided
        let resolvedSchedule = schedule;
        if (schedule && !schedule.match(/^[a-f0-9]{32}$/)) {
            const scheduleQuery = await client.get(`/api/now/table/cmn_schedule?sysparm_query=name=${schedule}&sysparm_limit=1`);
            if (scheduleQuery.data.result && scheduleQuery.data.result.length > 0) {
                resolvedSchedule = scheduleQuery.data.result[0].sys_id;
            }
        }
        const slaData = {
            name,
            collection: table,
            condition,
            duration,
            duration_type: durationType,
            active,
            description
        };
        if (resolvedSchedule) {
            slaData.schedule = resolvedSchedule;
        }
        const response = await client.post('/api/now/table/contract_sla', slaData);
        const sla = response.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            sla_definition: {
                sys_id: sla.sys_id,
                name: sla.name,
                table,
                duration,
                duration_type: durationType,
                schedule: resolvedSchedule || null,
                active
            },
            message: '✅ SLA definition created successfully'
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
//# sourceMappingURL=snow_create_sla_definition.js.map