"use strict";
/**
 * snow_create_va_topic_block - Create Virtual Agent topic block
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_va_topic_block',
    description: 'Creates a conversation block within a Virtual Agent topic. Blocks define conversation steps and responses.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'automation',
    subcategory: 'virtual-agent',
    use_cases: ['virtual-agent', 'conversation-flow', 'topic-blocks'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            topic: {
                type: 'string',
                description: 'Parent topic sys_id'
            },
            name: {
                type: 'string',
                description: 'Block name'
            },
            type: {
                type: 'string',
                description: 'Block type: text, question, script, handoff, decision'
            },
            order: {
                type: 'number',
                description: 'Block execution order'
            },
            text: {
                type: 'string',
                description: 'Response text for text blocks'
            },
            script: {
                type: 'string',
                description: 'Script for script blocks'
            },
            variable: {
                type: 'string',
                description: 'Variable to store user input'
            },
            next_block: {
                type: 'string',
                description: 'Next block to execute'
            }
        },
        required: ['topic', 'name', 'type', 'order']
    }
};
async function execute(args, context) {
    const { topic, name, type, order, text, script, variable, next_block } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const blockData = {
            topic,
            name,
            type,
            order
        };
        if (text)
            blockData.text = text;
        if (script)
            blockData.script = script;
        if (variable)
            blockData.variable = variable;
        if (next_block)
            blockData.next_block = next_block;
        const response = await client.post('/api/now/table/sys_cs_topic_block', blockData);
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            block: response.data.result,
            message: `✅ Topic Block created: ${name} (Order: ${order})`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_va_topic_block.js.map