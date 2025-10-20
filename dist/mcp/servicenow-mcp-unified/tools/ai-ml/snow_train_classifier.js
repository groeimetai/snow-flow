"use strict";
/**
 * snow_train_classifier - Train ML classifier
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_train_classifier',
    description: 'Train machine learning classifier',
    inputSchema: {
        type: 'object',
        properties: {
            model_name: { type: 'string' },
            training_data: { type: 'string' },
            algorithm: { type: 'string' }
        },
        required: ['model_name', 'training_data']
    }
};
async function execute(args, context) {
    const { model_name, training_data, algorithm = 'decision_tree' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const mlData = { name: model_name, training_data, algorithm };
        const response = await client.post('/api/now/v1/ml/train', mlData);
        return (0, error_handler_js_1.createSuccessResult)({ training_started: true, model: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_train_classifier.js.map