"use strict";
/**
 * snow_create_atf_test - Create Automated Test Framework test
 *
 * Creates an ATF test for automated testing of ServiceNow applications.
 * Uses sys_atf_test table.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_atf_test',
    description: 'Create Automated Test Framework (ATF) test for automated testing',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Test name' },
            description: { type: 'string', description: 'Test description' },
            testFor: { type: 'string', description: 'What to test (form, list, service_portal, api, workflow)' },
            table: { type: 'string', description: 'Table to test (if applicable)' },
            active: { type: 'boolean', description: 'Test active status', default: true },
            category: { type: 'string', description: 'Test category (regression, smoke, integration)' }
        },
        required: ['name', 'testFor']
    }
};
async function execute(args, context) {
    const { name, description = '', testFor, table, active = true, category = 'general' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const testData = {
            name,
            description,
            active,
            category,
            sys_class_name: 'sys_atf_test'
        };
        if (table) {
            testData.table_name = table;
        }
        const response = await client.post('/api/now/table/sys_atf_test', testData);
        const test = response.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            test: {
                sys_id: test.sys_id,
                name: test.name,
                test_for: testFor,
                table: table || null,
                category,
                active
            }
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
//# sourceMappingURL=snow_create_atf_test.js.map