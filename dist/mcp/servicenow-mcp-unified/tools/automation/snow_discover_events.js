"use strict";
/**
 * snow_discover_events - Discover system events
 *
 * Discovers system events registered in the instance.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_discover_events',
    description: 'Discovers system events registered in the instance.',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Filter by table name' },
            nameContains: { type: 'string', description: 'Search by event name pattern' },
            limit: { type: 'number', description: 'Maximum number of events to return', default: 50 }
        }
    }
};
async function execute(args, context) {
    const { table, nameContains, limit = 50 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Build query
        const queryParts = [];
        if (table) {
            queryParts.push(`table=${table}`);
        }
        if (nameContains) {
            queryParts.push(`event_nameLIKE${nameContains}`);
        }
        const query = queryParts.join('^');
        const response = await client.get(`/api/now/table/sysevent_register?sysparm_query=${query}&sysparm_limit=${limit}&sysparm_display_value=true`);
        const events = response.data.result;
        const formattedEvents = events.map((event) => ({
            sys_id: event.sys_id,
            event_name: event.event_name,
            table: event.table || null,
            description: event.description,
            queue: event.queue,
            claimed_by: event.claimed_by || null,
            state: event.state,
            created_on: event.sys_created_on
        }));
        return (0, error_handler_js_1.createSuccessResult)({
            found: true,
            count: formattedEvents.length,
            events: formattedEvents
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError
            ? error
            : new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.UNKNOWN_ERROR, error.message, { originalError: error }));
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_discover_events.js.map