"use strict";
/**
 * snow_json_to_csv
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_json_to_csv',
    description: 'Convert JSON array to CSV',
    inputSchema: {
        type: 'object',
        properties: {
            json: { type: 'array', items: { type: 'object' }, description: 'JSON array' },
            delimiter: { type: 'string', default: ',' }
        },
        required: ['json']
    }
};
async function execute(args, context) {
    const { json, delimiter = ',' } = args;
    try {
        if (json.length === 0) {
            return (0, error_handler_js_1.createSuccessResult)({ converted: true, csv: '', row_count: 0 });
        }
        const headers = Object.keys(json[0]);
        const csvLines = [headers.join(delimiter)];
        json.forEach((row) => {
            const values = headers.map(h => row[h] || '');
            csvLines.push(values.join(delimiter));
        });
        return (0, error_handler_js_1.createSuccessResult)({
            converted: true,
            csv: csvLines.join('\n'),
            row_count: json.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_json_to_csv.js.map