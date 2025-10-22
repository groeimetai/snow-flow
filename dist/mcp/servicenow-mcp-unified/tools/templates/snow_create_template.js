"use strict";
/**
 * snow_create_template
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_template',
    description: 'Create record template',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'templates',
    use_cases: ['template-creation', 'record-templates', 'automation'],
    complexity: 'beginner',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Template name' },
            table: { type: 'string', description: 'Table name' },
            template: { type: 'object', description: 'Template field values' },
            active: { type: 'boolean', default: true }
        },
        required: ['name', 'table', 'template']
    }
};
async function execute(args, context) {
    const { name, table, template, active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const templateData = {
            name,
            table,
            template: JSON.stringify(template),
            active
        };
        const response = await client.post('/api/now/table/sys_template', templateData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, template: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_template.js.map