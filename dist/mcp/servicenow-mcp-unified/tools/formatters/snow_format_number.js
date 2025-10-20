"use strict";
/**
 * snow_format_number
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_format_number',
    description: 'Format number with locale',
    inputSchema: {
        type: 'object',
        properties: {
            number: { type: 'number', description: 'Number to format' },
            type: { type: 'string', enum: ['decimal', 'currency', 'percent'], default: 'decimal' },
            decimals: { type: 'number', default: 2 },
            currency: { type: 'string', default: 'USD' }
        },
        required: ['number']
    }
};
async function execute(args, context) {
    const { number, type = 'decimal', decimals = 2, currency = 'USD' } = args;
    try {
        let formatted = '';
        switch (type) {
            case 'decimal':
                formatted = number.toFixed(decimals);
                break;
            case 'currency':
                formatted = `${currency} ${number.toFixed(decimals)}`;
                break;
            case 'percent':
                formatted = `${(number * 100).toFixed(decimals)}%`;
                break;
        }
        return (0, error_handler_js_1.createSuccessResult)({
            formatted,
            type,
            original: number
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_format_number.js.map