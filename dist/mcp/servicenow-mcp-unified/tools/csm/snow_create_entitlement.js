"use strict";
/**
 * snow_create_entitlement - Create entitlement
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_entitlement',
    description: 'Create service entitlement for customer',
    inputSchema: {
        type: 'object',
        properties: {
            account: { type: 'string', description: 'Customer account sys_id' },
            service: { type: 'string', description: 'Service offering' },
            start_date: { type: 'string', description: 'Entitlement start date' },
            end_date: { type: 'string', description: 'Entitlement end date' },
            support_level: { type: 'string', description: 'Support level: Basic, Standard, Premium' },
            hours_included: { type: 'number', description: 'Support hours included' },
            response_time: { type: 'string', description: 'SLA response time' }
        },
        required: ['account', 'service', 'start_date', 'end_date']
    }
};
async function execute(args, context) {
    const { account, service, start_date, end_date, support_level, hours_included, response_time } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const entitlementData = { account, service, start_date, end_date };
        if (support_level)
            entitlementData.support_level = support_level;
        if (hours_included)
            entitlementData.hours_included = hours_included;
        if (response_time)
            entitlementData.response_time = response_time;
        const response = await client.post('/api/now/table/sn_customerservice_entitlement', entitlementData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, entitlement: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_entitlement.js.map