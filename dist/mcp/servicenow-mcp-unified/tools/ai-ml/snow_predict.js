"use strict";
/**
 * snow_predict - ML prediction
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_predict',
    description: 'Make ML prediction',
    // Metadata for tool discovery (not sent to LLM)
    category: 'advanced',
    subcategory: 'machine-learning',
    use_cases: ['ml-prediction', 'ai', 'predictive-analytics'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            model_id: { type: 'string' },
            input_data: { type: 'object' }
        },
        required: ['model_id', 'input_data']
    }
};
async function execute(args, context) {
    const { model_id, input_data } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.post(`/api/now/v1/ml/predict/${model_id}`, input_data);
        return (0, error_handler_js_1.createSuccessResult)({ prediction: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_predict.js.map