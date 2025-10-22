"use strict";
/**
 * snow_create_mobile_layout - Create mobile layout
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_mobile_layout',
    description: 'Creates a custom mobile layout for forms and lists in the mobile app.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'ui-frameworks',
    subcategory: 'mobile',
    use_cases: ['mobile-layouts', 'mobile-ui', 'form-layouts'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Layout name'
            },
            table: {
                type: 'string',
                description: 'Table this layout applies to'
            },
            view: {
                type: 'string',
                description: 'View name (default, mobile, etc.)'
            },
            layout_type: {
                type: 'string',
                description: 'Layout type: form, list, card'
            },
            fields: {
                type: 'array',
                items: { type: 'string' },
                description: 'Fields to display in order'
            },
            sections: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        title: { type: 'string' },
                        fields: { type: 'array', items: { type: 'string' } }
                    }
                },
                description: 'Form sections with fields'
            },
            active: {
                type: 'boolean',
                description: 'Is layout active',
                default: true
            }
        },
        required: ['name', 'table', 'layout_type']
    }
};
async function execute(args, context) {
    const { name, table, view, layout_type, fields, sections, active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const layoutData = {
            name,
            table,
            layout_type,
            active
        };
        if (view)
            layoutData.view = view;
        if (fields && fields.length > 0)
            layoutData.fields = fields.join(',');
        if (sections)
            layoutData.sections = JSON.stringify(sections);
        const response = await client.post('/api/now/table/sys_ui_mobile_layout', layoutData);
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            layout: response.data.result,
            name,
            table,
            layout_type,
            field_count: fields ? fields.length : 0,
            section_count: sections ? sections.length : 0,
            message: `✅ Mobile layout created: ${name} for ${table}`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_mobile_layout.js.map