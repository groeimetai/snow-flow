"use strict";
/**
 * snow_handoff_to_agent - Handoff conversation to live agent
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_handoff_to_agent',
    description: 'Initiates handoff from Virtual Agent to a live agent when automated assistance is insufficient.',
    inputSchema: {
        type: 'object',
        properties: {
            conversation_id: {
                type: 'string',
                description: 'Conversation to handoff'
            },
            queue: {
                type: 'string',
                description: 'Agent queue for routing'
            },
            priority: {
                type: 'number',
                description: 'Queue priority'
            },
            reason: {
                type: 'string',
                description: 'Handoff reason'
            },
            context: {
                type: 'object',
                description: 'Context to pass to agent'
            }
        },
        required: ['conversation_id']
    }
};
async function execute(args, context) {
    const { conversation_id, queue, priority, reason, context: handoffContext } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const handoffData = {
            conversation_id,
            queue: queue || 'general',
            priority: priority || 3,
            reason: reason || 'User requested live agent',
            status: 'pending'
        };
        if (handoffContext) {
            handoffData.context = JSON.stringify(handoffContext);
        }
        // Try to create handoff request
        try {
            const response = await client.post('/api/now/table/sys_cs_handoff', handoffData);
            return (0, error_handler_js_1.createSuccessResult)({
                handoff_id: response.data.result.sys_id,
                conversation_id,
                queue: queue || 'general',
                priority: priority || 3,
                reason: reason || 'User requested live agent',
                message: `✅ Handoff to live agent initiated successfully`
            });
        }
        catch (handoffError) {
            // Fallback to updating conversation status if handoff table doesn't exist
            await client.patch(`/api/now/table/sys_cs_conversation/${conversation_id}`, {
                status: 'handoff_requested'
            });
            return (0, error_handler_js_1.createSuccessResult)({
                conversation_id,
                queue: queue || 'general',
                priority: priority || 3,
                reason: reason || 'User requested live agent',
                status: 'handoff_requested',
                message: `✅ Conversation marked for handoff (live agent will join shortly)`
            });
        }
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_handoff_to_agent.js.map