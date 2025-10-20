"use strict";
/**
 * snow_csv_to_json
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_csv_to_json',
    description: 'Convert CSV to JSON array',
    inputSchema: {
        type: 'object',
        properties: {
            csv: { type: 'string', description: 'CSV string' },
            delimiter: { type: 'string', default: ',' }
        },
        required: ['csv']
    }
};
async function execute(args, context) {
    const { csv, delimiter = ',' } = args;
    try {
        const lines = csv.split('\n').filter(l => l.trim());
        const headers = lines[0].split(delimiter);
        const data = lines.slice(1).map(line => {
            const values = line.split(delimiter);
            const obj = {};
            headers.forEach((h, i) => {
                obj[h.trim()] = values[i]?.trim();
            });
            return obj;
        });
        return (0, error_handler_js_1.createSuccessResult)({
            converted: true,
            json: data,
            row_count: data.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_csv_to_json.js.map