"use strict";
/**
 * snow_create_customer_account - Create customer account
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_customer_account',
    description: 'Create customer account for tracking relationships and entitlements',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'customer-service',
    use_cases: ['csm', 'accounts', 'customers'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Account name' },
            account_number: { type: 'string', description: 'Account number' },
            type: { type: 'string', description: 'Account type: Customer, Partner, Prospect' },
            industry: { type: 'string', description: 'Industry' },
            annual_revenue: { type: 'string', description: 'Annual revenue' },
            employees: { type: 'number', description: 'Number of employees' },
            primary_contact: { type: 'string', description: 'Primary contact sys_id' }
        },
        required: ['name', 'type']
    }
};
async function execute(args, context) {
    const { name, account_number, type, industry, annual_revenue, employees, primary_contact } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const accountData = { name, type };
        if (account_number)
            accountData.account_number = account_number;
        if (industry)
            accountData.industry = industry;
        if (annual_revenue)
            accountData.annual_revenue = annual_revenue;
        if (employees)
            accountData.employees = employees;
        if (primary_contact)
            accountData.primary_contact = primary_contact;
        const response = await client.post('/api/now/table/sn_customerservice_account', accountData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, account: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_customer_account.js.map