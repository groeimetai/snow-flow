"use strict";
/**
 * snow_create_alert
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_alert',
    description: 'Create system alert for monitoring',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Alert name' },
            table: { type: 'string', description: 'Target table' },
            condition: { type: 'string', description: 'Alert condition' },
            message: { type: 'string', description: 'Alert message' },
            severity: { type: 'number', enum: [1, 2, 3, 4, 5], description: 'Alert severity' }
        },
        required: ['name', 'table', 'condition']
    }
};
async function execute(args, context) {
    const { name, table, condition, message, severity } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const alertData = { name, table, condition };
        if (message)
            alertData.message = message;
        if (severity)
            alertData.severity = severity;
        const response = await client.post('/api/now/table/em_alert', alertData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, alert: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_alert.js.map