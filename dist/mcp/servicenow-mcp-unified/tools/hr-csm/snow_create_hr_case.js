"use strict";
/**
 * snow_create_hr_case - Create HR case
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_hr_case',
    description: 'Create HR service case',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'hr',
    use_cases: ['hr-service-delivery', 'case-management', 'hr'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            subject: { type: 'string' },
            opened_for: { type: 'string' },
            hr_service: { type: 'string' },
            priority: { type: 'number' }
        },
        required: ['subject', 'hr_service']
    }
};
async function execute(args, context) {
    const { subject, opened_for, hr_service, priority } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const caseData = { subject, hr_service };
        if (opened_for)
            caseData.opened_for = opened_for;
        if (priority)
            caseData.priority = priority;
        const response = await client.post('/api/now/table/sn_hr_core_case', caseData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, hr_case: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_hr_case.js.map