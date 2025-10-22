"use strict";
/**
 * snow_exception_handler
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_exception_handler',
    description: 'Handle exceptions with logging',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'error-handling',
    use_cases: ['exceptions', 'logging', 'debugging'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            exception_message: { type: 'string', description: 'Exception message' },
            severity: { type: 'string', enum: ['info', 'warning', 'error', 'critical'], default: 'error' },
            source: { type: 'string', description: 'Exception source' }
        },
        required: ['exception_message']
    }
};
async function execute(args, context) {
    const { exception_message, severity = 'error', source } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const exceptionData = {
            message: exception_message,
            severity,
            type: 'exception'
        };
        if (source)
            exceptionData.source = source;
        const response = await client.post('/api/now/table/syslog', exceptionData);
        return (0, error_handler_js_1.createSuccessResult)({ logged: true, exception: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_exception_handler.js.map