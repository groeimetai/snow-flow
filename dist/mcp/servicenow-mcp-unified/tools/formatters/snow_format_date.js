"use strict";
/**
 * snow_format_date
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_format_date',
    description: 'Format date for ServiceNow',
    inputSchema: {
        type: 'object',
        properties: {
            date: { type: 'string', description: 'Date to format' },
            format: { type: 'string', enum: ['date', 'datetime', 'time', 'relative'], default: 'datetime' }
        },
        required: ['date']
    }
};
async function execute(args, context) {
    const { date, format = 'datetime' } = args;
    try {
        const dateObj = new Date(date);
        let formatted = '';
        switch (format) {
            case 'date':
                formatted = dateObj.toISOString().split('T')[0];
                break;
            case 'datetime':
                formatted = dateObj.toISOString();
                break;
            case 'time':
                formatted = dateObj.toISOString().split('T')[1];
                break;
            case 'relative':
                const now = new Date();
                const diffMs = now.getTime() - dateObj.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                formatted = diffMins < 60 ? `${diffMins} minutes ago` :
                    diffMins < 1440 ? `${Math.floor(diffMins / 60)} hours ago` :
                        `${Math.floor(diffMins / 1440)} days ago`;
                break;
        }
        return (0, error_handler_js_1.createSuccessResult)({
            formatted,
            format,
            original: date
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_format_date.js.map