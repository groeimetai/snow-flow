"use strict";
/**
 * snow_employee_offboarding - Employee offboarding
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_employee_offboarding',
    description: 'Initiate employee offboarding workflow',
    inputSchema: {
        type: 'object',
        properties: {
            employee: { type: 'string', description: 'Employee sys_id or user name' },
            last_date: { type: 'string', description: 'Last working date' },
            reason: { type: 'string', description: 'Offboarding reason' },
            assets_to_return: { type: 'array', items: { type: 'string' }, description: 'Assets to collect' },
            knowledge_transfer: { type: 'string', description: 'Knowledge transfer plan' }
        },
        required: ['employee', 'last_date', 'reason']
    }
};
async function execute(args, context) {
    const { employee, last_date, reason, assets_to_return, knowledge_transfer } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const offboardingData = {
            employee,
            last_date,
            reason,
            hr_service: 'Employee Offboarding',
            short_description: `Offboarding for ${employee}`,
            category: 'Offboarding'
        };
        if (assets_to_return)
            offboardingData.assets_to_return = assets_to_return.join(',');
        if (knowledge_transfer)
            offboardingData.knowledge_transfer = knowledge_transfer;
        const response = await client.post('/api/now/table/sn_hr_core_case', offboardingData);
        return (0, error_handler_js_1.createSuccessResult)({ initiated: true, case: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_employee_offboarding.js.map