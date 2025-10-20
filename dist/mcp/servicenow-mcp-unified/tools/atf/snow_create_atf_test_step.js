"use strict";
/**
 * snow_create_atf_test_step - Add test step to ATF test
 *
 * Adds a test step to an existing ATF test. Steps define the actions
 * and assertions for testing using the sys_atf_step table.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_atf_test_step',
    description: 'Adds a test step to an existing ATF test. Steps define the actions and assertions for testing using the sys_atf_step table.',
    inputSchema: {
        type: 'object',
        properties: {
            testId: { type: 'string', description: 'Parent test sys_id or name' },
            stepType: { type: 'string', description: 'Step type (e.g., form_submission, impersonate, assert_condition, open_form, server_script)' },
            order: { type: 'number', description: 'Step execution order' },
            description: { type: 'string', description: 'Step description' },
            stepConfig: { type: 'object', description: 'Step configuration (varies by type)' },
            timeout: { type: 'number', description: 'Step timeout in seconds', default: 30 }
        },
        required: ['testId', 'stepType', 'order']
    }
};
async function execute(args, context) {
    const { testId, stepType, order, description = '', stepConfig = {}, timeout = 30 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Resolve test ID if name provided
        let resolvedTestId = testId;
        if (!testId.match(/^[a-f0-9]{32}$/)) {
            const testQuery = await client.get(`/api/now/table/sys_atf_test?sysparm_query=name=${testId}&sysparm_limit=1`);
            if (!testQuery.data.result || testQuery.data.result.length === 0) {
                throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.SERVICENOW_API_ERROR, `Test not found: ${testId}`);
            }
            resolvedTestId = testQuery.data.result[0].sys_id;
        }
        const stepData = {
            test: resolvedTestId,
            step_config: {
                type: stepType,
                ...stepConfig
            },
            order,
            description,
            timeout
        };
        const response = await client.post('/api/now/table/sys_atf_step', stepData);
        const step = response.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            step: {
                sys_id: step.sys_id,
                test_id: resolvedTestId,
                type: stepType,
                order,
                timeout
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
//# sourceMappingURL=snow_create_atf_test_step.js.map