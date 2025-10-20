"use strict";
/**
 * snow_parse_csv
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_parse_csv',
    description: 'Parse CSV to JSON',
    inputSchema: {
        type: 'object',
        properties: {
            csv_string: { type: 'string', description: 'CSV string to parse' },
            delimiter: { type: 'string', default: ',', description: 'Field delimiter' },
            has_header: { type: 'boolean', default: true }
        },
        required: ['csv_string']
    }
};
async function execute(args, context) {
    const { csv_string, delimiter = ',', has_header = true } = args;
    try {
        const lines = csv_string.split('\n').filter(line => line.trim());
        const headers = has_header ? lines[0].split(delimiter) : [];
        const dataLines = has_header ? lines.slice(1) : lines;
        const parsed = dataLines.map(line => {
            const values = line.split(delimiter);
            if (has_header) {
                const obj = {};
                headers.forEach((header, i) => {
                    obj[header.trim()] = values[i]?.trim();
                });
                return obj;
            }
            return values.map(v => v.trim());
        });
        return (0, error_handler_js_1.createSuccessResult)({
            parsed: true,
            rows: parsed.length,
            columns: headers.length || parsed[0]?.length || 0,
            data: parsed
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_parse_csv.js.map