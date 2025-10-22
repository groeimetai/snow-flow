"use strict";
/**
 * snow_create_import_set
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_import_set',
    description: 'Create import set for data import',
    // Metadata for tool discovery (not sent to LLM)
    category: 'integration',
    subcategory: 'import-export',
    use_cases: ['import', 'data-migration', 'integration'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Import set table name' },
            data: { type: 'array', items: { type: 'object' }, description: 'Data to import' }
        },
        required: ['table', 'data']
    }
};
async function execute(args, context) {
    const { table, data } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const importPromises = data.map((record) => client.post(`/api/now/import/${table}`, record));
        const results = await Promise.all(importPromises);
        return (0, error_handler_js_1.createSuccessResult)({
            imported: true,
            count: results.length,
            import_set: results[0]?.data?.result?.import_set
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_import_set.js.map