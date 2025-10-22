"use strict";
/**
 * snow_create_event_rule - Create event-driven automation rule
 *
 * Creates event-driven automation rules. Triggers scripts based on
 * system events with conditional logic.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_event_rule',
    description: 'Creates event-driven automation rules. Triggers scripts based on system events with conditional logic.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'automation',
    subcategory: 'rules',
    use_cases: ['automation', 'events', 'rules'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Event Rule name' },
            eventName: { type: 'string', description: 'Event name to listen for' },
            condition: { type: 'string', description: 'Event condition script (ES5 only!)' },
            script: { type: 'string', description: '🚨 ES5 ONLY! Action script to execute (no const/let/arrows/templates - Rhino engine)' },
            description: { type: 'string', description: 'Rule description' },
            active: { type: 'boolean', description: 'Rule active status', default: true },
            order: { type: 'number', description: 'Execution order', default: 100 }
        },
        required: ['name', 'eventName', 'script']
    }
};
async function execute(args, context) {
    const { name, eventName, condition = '', script, description = '', active = true, order = 100 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const eventRuleData = {
            name,
            event_name: eventName,
            script,
            description,
            active,
            order
        };
        if (condition) {
            eventRuleData.condition = condition;
        }
        const response = await client.post('/api/now/table/sysevent_script_action', eventRuleData);
        const rule = response.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            event_rule: {
                sys_id: rule.sys_id,
                name: rule.name,
                event_name: eventName,
                active,
                order
            },
            message: '✅ Event rule created successfully'
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
//# sourceMappingURL=snow_create_event_rule.js.map