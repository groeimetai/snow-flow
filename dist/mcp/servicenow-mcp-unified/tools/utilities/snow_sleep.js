"use strict";
/**
 * snow_sleep
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_sleep',
    description: 'Sleep for specified milliseconds',
    // Metadata for tool discovery (not sent to LLM)
    category: 'advanced',
    subcategory: 'utilities',
    use_cases: ['delay', 'timing', 'utilities'],
    complexity: 'beginner',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            milliseconds: { type: 'number', description: 'Sleep duration in ms', default: 1000 }
        }
    }
};
async function execute(args, context) {
    const { milliseconds = 1000 } = args;
    try {
        await new Promise(resolve => setTimeout(resolve, milliseconds));
        return (0, error_handler_js_1.createSuccessResult)({ slept: true, duration_ms: milliseconds });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_sleep.js.map