"use strict";
/**
 * snow_send_va_message - Send message to Virtual Agent
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_send_va_message',
    description: 'Sends a message to Virtual Agent and gets the response. Simulates user interaction with the chatbot.',
    inputSchema: {
        type: 'object',
        properties: {
            conversation_id: {
                type: 'string',
                description: 'Existing conversation ID (optional)'
            },
            message: {
                type: 'string',
                description: 'User message text'
            },
            user_id: {
                type: 'string',
                description: 'User sys_id'
            },
            context: {
                type: 'object',
                description: 'Additional context variables'
            }
        },
        required: ['message']
    }
};
async function execute(args, context) {
    const { conversation_id, message, user_id, context: userContext } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        let conversationId = conversation_id;
        // Create new conversation if not provided
        if (!conversationId) {
            const convData = {
                user: user_id || 'guest',
                status: 'active'
            };
            const convResponse = await client.post('/api/now/table/sys_cs_conversation', convData);
            conversationId = convResponse.data.result.sys_id;
        }
        // Create user message
        const messageData = {
            conversation: conversationId,
            text: message,
            author: 'user'
        };
        if (userContext) {
            messageData.context = JSON.stringify(userContext);
        }
        const messageResponse = await client.post('/api/now/table/sys_cs_message', messageData);
        if (!messageResponse.data.result) {
            return (0, error_handler_js_1.createErrorResult)('Failed to send message to Virtual Agent');
        }
        // Simulate VA response (in real implementation, this would trigger VA processing)
        const vaResponse = {
            text: `I understand you said: "${message}". How can I help you with that?`,
            suggested_actions: ['Get more info', 'Create ticket', 'Talk to agent']
        };
        return (0, error_handler_js_1.createSuccessResult)({
            conversation_id: conversationId,
            user_message: message,
            va_response: vaResponse.text,
            suggested_actions: vaResponse.suggested_actions,
            message: `💬 Message sent to Virtual Agent successfully`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_send_va_message.js.map