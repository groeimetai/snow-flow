"use strict";
/**
 * snow_paginate
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_paginate',
    description: 'Calculate pagination parameters',
    inputSchema: {
        type: 'object',
        properties: {
            total_records: { type: 'number', description: 'Total record count' },
            page_size: { type: 'number', default: 100 },
            current_page: { type: 'number', default: 1 }
        },
        required: ['total_records']
    }
};
async function execute(args, context) {
    const { total_records, page_size = 100, current_page = 1 } = args;
    try {
        const total_pages = Math.ceil(total_records / page_size);
        const offset = (current_page - 1) * page_size;
        const has_next = current_page < total_pages;
        const has_prev = current_page > 1;
        return (0, error_handler_js_1.createSuccessResult)({
            total_records,
            page_size,
            current_page,
            total_pages,
            offset,
            has_next,
            has_prev
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_paginate.js.map