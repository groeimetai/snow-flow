"use strict";
/**
 * snow_create_va_topic - Create Virtual Agent topic
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_va_topic',
    description: 'Create Virtual Agent conversation topic',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string' },
            utterances: { type: 'array', items: { type: 'string' } },
            response: { type: 'string' }
        },
        required: ['name', 'utterances']
    }
};
async function execute(args, context) {
    const { name, utterances, response } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const topicData = { name, utterances: utterances.join(',') };
        if (response)
            topicData.response = response;
        const resp = await client.post('/api/now/table/topic', topicData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, topic: resp.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_va_topic.js.map