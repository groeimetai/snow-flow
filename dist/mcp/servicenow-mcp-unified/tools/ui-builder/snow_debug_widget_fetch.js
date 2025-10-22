"use strict";
/**
 * snow_debug_widget_fetch - Debug widget fetching
 *
 * Debug widget data fetching and server communication issues
 * in UI Builder pages.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_debug_widget_fetch',
    description: 'Debug widget data fetching and server communication issues',
    // Metadata for tool discovery (not sent to LLM)
    category: 'ui-builder',
    subcategory: 'debugging',
    use_cases: ['ui-builder', 'debugging', 'widgets'],
    complexity: 'advanced',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            page_id: {
                type: 'string',
                description: 'Target page sys_id'
            },
            widget_name: {
                type: 'string',
                description: 'Widget name to debug'
            },
            trace_requests: {
                type: 'boolean',
                description: 'Trace HTTP requests',
                default: true
            },
            log_level: {
                type: 'string',
                description: 'Log level (info, debug, warn, error)',
                default: 'debug'
            }
        },
        required: ['page_id']
    }
};
async function execute(args, context) {
    const { page_id, widget_name, trace_requests = true, log_level = 'debug' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Get page elements
        const elementsResponse = await client.get('/api/now/table/sys_ux_page_element', {
            params: { sysparm_query: `page=${page_id}` }
        });
        const elements = elementsResponse.data.result;
        // Get data brokers for the page
        const brokersResponse = await client.get('/api/now/table/sys_ux_data_broker', {
            params: { sysparm_query: `page=${page_id}` }
        });
        const brokers = brokersResponse.data.result;
        // Build debug info
        const debugInfo = {
            page_id,
            total_elements: elements.length,
            total_brokers: brokers.length,
            elements: elements.map((el) => ({
                sys_id: el.sys_id,
                component: el.component,
                data_broker: el.data_broker || 'none'
            })),
            brokers: brokers.map((broker) => ({
                sys_id: broker.sys_id,
                name: broker.name,
                table: broker.table,
                query: broker.query
            }))
        };
        // Filter by widget if specified
        if (widget_name) {
            debugInfo.elements = debugInfo.elements.filter((el) => el.component.includes(widget_name));
        }
        return (0, error_handler_js_1.createSuccessResult)(debugInfo);
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_debug_widget_fetch.js.map