"use strict";
/**
 * snow_employee_onboarding - Employee onboarding
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_employee_onboarding',
    description: 'Trigger employee onboarding workflow',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'hr',
    use_cases: ['hr-service-delivery', 'onboarding', 'lifecycle'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            employee_sys_id: { type: 'string' },
            start_date: { type: 'string' },
            department: { type: 'string' }
        },
        required: ['employee_sys_id', 'start_date']
    }
};
async function execute(args, context) {
    const { employee_sys_id, start_date, department } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const onboardingData = { employee: employee_sys_id, start_date };
        if (department)
            onboardingData.department = department;
        const response = await client.post('/api/now/table/sn_hr_le_onboarding', onboardingData);
        return (0, error_handler_js_1.createSuccessResult)({ initiated: true, onboarding: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_employee_onboarding.js.map