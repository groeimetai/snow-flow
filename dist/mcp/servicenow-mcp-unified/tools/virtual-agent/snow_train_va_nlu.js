"use strict";
/**
 * snow_train_va_nlu - Train Virtual Agent NLU
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_train_va_nlu',
    description: 'Train Virtual Agent NLU model',
    // Metadata for tool discovery (not sent to LLM)
    category: 'automation',
    subcategory: 'virtual-agent',
    use_cases: ['virtual-agent', 'nlu-training', 'machine-learning'],
    complexity: 'advanced',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            model_id: { type: 'string' }
        },
        required: ['model_id']
    }
};
async function execute(args, context) {
    const { model_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.post(`/api/now/v1/va/models/${model_id}/train`, {});
        return (0, error_handler_js_1.createSuccessResult)({ training_started: true, model: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_train_va_nlu.js.map