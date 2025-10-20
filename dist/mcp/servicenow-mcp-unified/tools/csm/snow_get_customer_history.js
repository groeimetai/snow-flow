"use strict";
/**
 * snow_get_customer_history - Get customer history
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_customer_history',
    description: 'Retrieve complete customer interaction history',
    inputSchema: {
        type: 'object',
        properties: {
            customer: { type: 'string', description: 'Customer account or contact sys_id' },
            include_cases: { type: 'boolean', description: 'Include case history', default: true },
            include_communications: { type: 'boolean', description: 'Include communications', default: true },
            date_range: { type: 'string', description: 'Date range filter' }
        },
        required: ['customer']
    }
};
async function execute(args, context) {
    const { customer, include_cases = true, include_communications = true, date_range } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const result = { customer };
        // Get cases if requested
        if (include_cases) {
            let caseQuery = `customer=${customer}`;
            if (date_range)
                caseQuery += `^sys_created_on>${date_range}`;
            const casesResponse = await client.get(`/api/now/table/sn_customerservice_case?sysparm_query=${caseQuery}`);
            result.cases = casesResponse.data?.result || [];
            result.case_count = result.cases.length;
        }
        // Get communications if requested
        if (include_communications) {
            let commQuery = `customer=${customer}`;
            if (date_range)
                commQuery += `^sys_created_on>${date_range}`;
            const commResponse = await client.get(`/api/now/table/sys_email?sysparm_query=${commQuery}`);
            result.communications = commResponse.data?.result || [];
            result.communication_count = result.communications.length;
        }
        return (0, error_handler_js_1.createSuccessResult)(result);
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_get_customer_history.js.map