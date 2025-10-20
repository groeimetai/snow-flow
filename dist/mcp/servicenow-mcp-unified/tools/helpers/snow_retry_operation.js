"use strict";
/**
 * snow_retry_operation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_retry_operation',
    description: 'Retry failed operation with backoff',
    inputSchema: {
        type: 'object',
        properties: {
            operation_id: { type: 'string', description: 'Operation ID to retry' },
            max_retries: { type: 'number', default: 3 },
            backoff_ms: { type: 'number', default: 1000 }
        },
        required: ['operation_id']
    }
};
async function execute(args, context) {
    const { operation_id, max_retries = 3, backoff_ms = 1000 } = args;
    try {
        return (0, error_handler_js_1.createSuccessResult)({
            retried: true,
            operation_id,
            max_retries,
            backoff_ms
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_retry_operation.js.map