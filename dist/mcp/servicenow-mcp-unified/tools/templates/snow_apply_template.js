"use strict";
/**
 * snow_apply_template
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_apply_template',
    description: 'Apply template to create record',
    // Metadata for tool discovery (not sent to LLM)
    category: 'core-operations',
    subcategory: 'crud',
    use_cases: ['templates', 'record-creation', 'automation'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            template_sys_id: { type: 'string', description: 'Template sys_id' },
            additional_values: { type: 'object', description: 'Additional field values' }
        },
        required: ['template_sys_id']
    }
};
async function execute(args, context) {
    const { template_sys_id, additional_values = {} } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const templateRecord = await client.get(`/api/now/table/sys_template/${template_sys_id}`);
        const table = templateRecord.data.result.table;
        const templateData = JSON.parse(templateRecord.data.result.template);
        const recordData = { ...templateData, ...additional_values };
        const response = await client.post(`/api/now/table/${table}`, recordData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, record: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_apply_template.js.map