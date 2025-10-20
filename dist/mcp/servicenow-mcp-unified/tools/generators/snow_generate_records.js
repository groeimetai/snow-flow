"use strict";
/**
 * snow_generate_records
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_generate_records',
    description: 'Generate multiple test records',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Table name' },
            count: { type: 'number', description: 'Number of records to generate', default: 10 },
            template: { type: 'object', description: 'Template for generated records' }
        },
        required: ['table', 'template']
    }
};
async function execute(args, context) {
    const { table, count = 10, template } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const createPromises = [];
        for (let i = 0; i < count; i++) {
            const recordData = { ...template };
            createPromises.push(client.post(`/api/now/table/${table}`, recordData));
        }
        const results = await Promise.all(createPromises);
        return (0, error_handler_js_1.createSuccessResult)({
            generated: true,
            count: results.length,
            records: results.map(r => r.data.result)
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_generate_records.js.map