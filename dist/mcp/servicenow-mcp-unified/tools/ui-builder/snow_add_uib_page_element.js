"use strict";
/**
 * snow_add_uib_page_element - Add components to UI Builder pages
 *
 * Adds a component element to a UI Builder page using official
 * sys_ux_page_element API with full layout control.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_add_uib_page_element',
    description: 'Add component element to UI Builder page with full layout control',
    // Metadata for tool discovery (not sent to LLM)
    category: 'ui-builder',
    subcategory: 'page-layout',
    use_cases: ['ui-builder', 'components', 'pages'],
    complexity: 'intermediate',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            page_id: {
                type: 'string',
                description: 'Target page sys_id'
            },
            component: {
                type: 'string',
                description: 'Component name or sys_id from component library'
            },
            container_id: {
                type: 'string',
                description: 'Parent container element ID (optional for root level)'
            },
            position: {
                type: 'number',
                description: 'Element position in container',
                default: 0
            },
            properties: {
                type: 'object',
                description: 'Component properties and configuration'
            },
            data_broker: {
                type: 'string',
                description: 'Data broker sys_id to bind to component'
            },
            responsive_config: {
                type: 'object',
                description: 'Responsive layout configuration for different screen sizes'
            },
            conditional_display: {
                type: 'string',
                description: 'Condition script for element visibility'
            },
            css_classes: {
                type: 'array',
                items: { type: 'string' },
                description: 'CSS classes to apply'
            },
            inline_styles: {
                type: 'object',
                description: 'Inline styles configuration'
            }
        },
        required: ['page_id', 'component']
    }
};
async function execute(args, context) {
    const { page_id, component, container_id, position = 0, properties = {}, data_broker, responsive_config, conditional_display, css_classes = [], inline_styles = {} } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Create page element
        const payload = {
            page: page_id,
            component,
            position
        };
        if (container_id)
            payload.container = container_id;
        if (Object.keys(properties).length > 0)
            payload.properties = JSON.stringify(properties);
        if (data_broker)
            payload.data_broker = data_broker;
        if (responsive_config)
            payload.responsive_config = JSON.stringify(responsive_config);
        if (conditional_display)
            payload.conditional_display = conditional_display;
        if (css_classes.length > 0)
            payload.css_classes = css_classes.join(',');
        if (Object.keys(inline_styles).length > 0)
            payload.inline_styles = JSON.stringify(inline_styles);
        const response = await client.post('/api/now/table/sys_ux_page_element', payload);
        return (0, error_handler_js_1.createSuccessResult)({
            element: {
                sys_id: response.data.result.sys_id,
                page_id,
                component,
                position
            }
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_add_uib_page_element.js.map