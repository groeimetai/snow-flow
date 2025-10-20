"use strict";
/**
 * snow_field_mapper
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_field_mapper',
    description: 'Map fields between schemas',
    inputSchema: {
        type: 'object',
        properties: {
            source_data: { type: 'object', description: 'Source data' },
            field_mapping: { type: 'object', description: 'Field mapping rules' }
        },
        required: ['source_data', 'field_mapping']
    }
};
async function execute(args, context) {
    const { source_data, field_mapping } = args;
    try {
        const mapped = {};
        for (const [targetField, sourceField] of Object.entries(field_mapping)) {
            mapped[targetField] = source_data[sourceField];
        }
        return (0, error_handler_js_1.createSuccessResult)({
            mapped,
            field_count: Object.keys(mapped).length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_field_mapper.js.map