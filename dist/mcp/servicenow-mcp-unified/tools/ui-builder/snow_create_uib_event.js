"use strict";
/**
 * snow_create_uib_event - Create custom events
 *
 * Creates custom events for UI Builder components to enable
 * component communication and interactions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_uib_event',
    description: 'Create custom events for UI Builder component communication',
    // Metadata for tool discovery (not sent to LLM)
    category: 'ui-builder',
    subcategory: 'events',
    use_cases: ['ui-builder', 'events', 'components'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            page_id: {
                type: 'string',
                description: 'Target page sys_id'
            },
            name: {
                type: 'string',
                description: 'Event name'
            },
            description: {
                type: 'string',
                description: 'Event description'
            },
            payload_schema: {
                type: 'object',
                description: 'Event payload schema'
            },
            bubbles: {
                type: 'boolean',
                description: 'Event bubbles up the DOM',
                default: true
            }
        },
        required: ['page_id', 'name']
    }
};
async function execute(args, context) {
    const { page_id, name, description = '', payload_schema = {}, bubbles = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const payload = {
            page: page_id,
            name,
            description,
            bubbles
        };
        if (Object.keys(payload_schema).length > 0) {
            payload.payload_schema = JSON.stringify(payload_schema);
        }
        const response = await client.post('/api/now/table/sys_ux_event', payload);
        return (0, error_handler_js_1.createSuccessResult)({
            event: {
                sys_id: response.data.result.sys_id,
                name,
                page_id
            }
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_uib_event.js.map