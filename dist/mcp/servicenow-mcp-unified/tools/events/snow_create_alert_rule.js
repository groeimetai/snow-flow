"use strict";
/**
 * snow_create_alert_rule
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_alert_rule',
    description: 'Create alert rules for automated monitoring and notifications',
    // Metadata for tool discovery (not sent to LLM)
    category: 'automation',
    subcategory: 'event-management',
    use_cases: ['alerts', 'rules', 'monitoring'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Alert rule name' },
            table: { type: 'string', description: 'Target table to monitor' },
            condition: { type: 'string', description: 'Alert trigger condition' },
            severity: { type: 'number', enum: [1, 2, 3, 4, 5], description: 'Alert severity (1=Critical, 5=Info)' },
            notification_group: { type: 'string', description: 'Group to notify' },
            notification_user: { type: 'string', description: 'User to notify' },
            email_template: { type: 'string', description: 'Email template sys_id' },
            active: { type: 'boolean', description: 'Rule active status', default: true }
        },
        required: ['name', 'table', 'condition']
    }
};
async function execute(args, context) {
    const { name, table, condition, severity, notification_group, notification_user, email_template, active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const ruleData = {
            name,
            table,
            condition,
            active
        };
        if (severity)
            ruleData.severity = severity;
        if (notification_group)
            ruleData.notification_group = notification_group;
        if (notification_user)
            ruleData.notification_user = notification_user;
        if (email_template)
            ruleData.email_template = email_template;
        const response = await client.post('/api/now/table/em_alert_rule', ruleData);
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            alert_rule: response.data.result,
            sys_id: response.data.result.sys_id
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_alert_rule.js.map