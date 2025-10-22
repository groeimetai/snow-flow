"use strict";
/**
 * snow_create_uib_component - Create custom components
 *
 * Creates custom UI Builder components with source code for reuse
 * across pages.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_uib_component',
    description: 'Create custom UI Builder component with source code',
    // Metadata for tool discovery (not sent to LLM)
    category: 'ui-frameworks',
    subcategory: 'ui-builder',
    use_cases: ['component-creation', 'ui-builder', 'reusable-components'],
    complexity: 'advanced',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Component name (internal identifier)'
            },
            label: {
                type: 'string',
                description: 'Component label (display name)'
            },
            description: {
                type: 'string',
                description: 'Component description'
            },
            category: {
                type: 'string',
                description: 'Component category',
                default: 'custom'
            },
            source_code: {
                type: 'string',
                description: 'Component JavaScript source code'
            },
            template: {
                type: 'string',
                description: 'Component HTML template'
            },
            styles: {
                type: 'string',
                description: 'Component CSS styles'
            },
            properties: {
                type: 'object',
                description: 'Component properties schema'
            },
            version: {
                type: 'string',
                description: 'Component version',
                default: '1.0.0'
            }
        },
        required: ['name', 'label']
    }
};
async function execute(args, context) {
    const { name, label, description = '', category = 'custom', source_code = '', template = '', styles = '', properties = {}, version = '1.0.0' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const payload = {
            name,
            label,
            description,
            category,
            version
        };
        if (source_code)
            payload.source_code = source_code;
        if (template)
            payload.template = template;
        if (styles)
            payload.styles = styles;
        if (Object.keys(properties).length > 0)
            payload.properties = JSON.stringify(properties);
        const response = await client.post('/api/now/table/sys_ux_lib_component', payload);
        return (0, error_handler_js_1.createSuccessResult)({
            component: {
                sys_id: response.data.result.sys_id,
                name,
                label,
                category
            }
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_uib_component.js.map