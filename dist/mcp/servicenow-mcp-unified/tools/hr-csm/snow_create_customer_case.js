"use strict";
/**
 * snow_create_customer_case - Create customer service case
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_customer_case',
    description: 'Create CSM customer case',
    inputSchema: {
        type: 'object',
        properties: {
            subject: { type: 'string' },
            account: { type: 'string' },
            contact: { type: 'string' },
            priority: { type: 'number' }
        },
        required: ['subject', 'account']
    }
};
async function execute(args, context) {
    const { subject, account, contact, priority } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const caseData = { subject, account };
        if (contact)
            caseData.contact = contact;
        if (priority)
            caseData.priority = priority;
        const response = await client.post('/api/now/table/sn_customerservice_case', caseData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, case: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_customer_case.js.map