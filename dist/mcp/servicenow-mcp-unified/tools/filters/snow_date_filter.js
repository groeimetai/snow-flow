"use strict";
/**
 * snow_date_filter
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_date_filter',
    description: 'Build date-based query filter',
    inputSchema: {
        type: 'object',
        properties: {
            field: { type: 'string', description: 'Date field name' },
            relative: { type: 'string', enum: ['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth'], description: 'Relative date' },
            start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
            end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' }
        },
        required: ['field']
    }
};
async function execute(args, context) {
    const { field, relative, start_date, end_date } = args;
    try {
        let query = '';
        if (relative) {
            const relativeQueries = {
                'today': `${field}ON Today`,
                'yesterday': `${field}ON Yesterday`,
                'thisWeek': `${field}ON This week`,
                'lastWeek': `${field}ON Last week`,
                'thisMonth': `${field}ON This month`,
                'lastMonth': `${field}ON Last month`
            };
            query = relativeQueries[relative] || '';
        }
        else if (start_date && end_date) {
            query = `${field}BETWEEN${start_date}@${end_date}`;
        }
        else if (start_date) {
            query = `${field}>=${start_date}`;
        }
        else if (end_date) {
            query = `${field}<=${end_date}`;
        }
        return (0, error_handler_js_1.createSuccessResult)({
            query,
            field,
            type: relative ? 'relative' : 'absolute'
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_date_filter.js.map