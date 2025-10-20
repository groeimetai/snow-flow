"use strict";
/**
 * snow_create_escalation_rule - Create escalation rule
 *
 * Creates escalation rules for time-based actions. Defines escalation
 * timing, conditions, and automated responses.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_escalation_rule',
    description: 'Creates escalation rules for time-based actions. Defines escalation timing, conditions, and automated responses.',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Escalation Rule name' },
            table: { type: 'string', description: 'Table to monitor' },
            condition: { type: 'string', description: 'Escalation condition' },
            escalationTime: { type: 'number', description: 'Escalation time in minutes' },
            escalationScript: { type: 'string', description: 'Escalation action script (ES5 only!)' },
            active: { type: 'boolean', description: 'Rule active status', default: true },
            order: { type: 'number', description: 'Execution order', default: 100 },
            description: { type: 'string', description: 'Rule description' }
        },
        required: ['name', 'table', 'condition', 'escalationTime', 'escalationScript']
    }
};
async function execute(args, context) {
    const { name, table, condition, escalationTime, escalationScript, active = true, order = 100, description = '' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const escalationData = {
            name,
            table,
            condition,
            escalate_mins: escalationTime,
            script: escalationScript,
            active,
            order,
            description
        };
        const response = await client.post('/api/now/table/sys_script_escalation', escalationData);
        const rule = response.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            escalation_rule: {
                sys_id: rule.sys_id,
                name: rule.name,
                table,
                escalation_time_mins: escalationTime,
                active,
                order
            },
            message: '✅ Escalation rule created successfully'
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
//# sourceMappingURL=snow_create_escalation_rule.js.map