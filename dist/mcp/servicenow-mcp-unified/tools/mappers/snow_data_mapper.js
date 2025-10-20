"use strict";
/**
 * snow_data_mapper
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_data_mapper',
    description: 'Advanced data mapping with transformations',
    inputSchema: {
        type: 'object',
        properties: {
            data: { type: 'array', items: { type: 'object' }, description: 'Source data array' },
            mapping_rules: { type: 'object', description: 'Mapping rules' }
        },
        required: ['data', 'mapping_rules']
    }
};
async function execute(args, context) {
    const { data, mapping_rules } = args;
    try {
        const mapped = data.map((item) => {
            const result = {};
            for (const [targetField, sourceField] of Object.entries(mapping_rules)) {
                result[targetField] = item[sourceField];
            }
            return result;
        });
        return (0, error_handler_js_1.createSuccessResult)({
            mapped,
            record_count: mapped.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_data_mapper.js.map