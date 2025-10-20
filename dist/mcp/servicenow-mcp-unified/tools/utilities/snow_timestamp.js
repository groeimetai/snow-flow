"use strict";
/**
 * snow_timestamp
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_timestamp',
    description: 'Get current timestamp in various formats',
    inputSchema: {
        type: 'object',
        properties: {
            format: { type: 'string', enum: ['iso', 'unix', 'unix_ms', 'date', 'time'], default: 'iso' }
        }
    }
};
async function execute(args, context) {
    const { format = 'iso' } = args;
    try {
        const now = new Date();
        let timestamp;
        switch (format) {
            case 'iso':
                timestamp = now.toISOString();
                break;
            case 'unix':
                timestamp = Math.floor(now.getTime() / 1000);
                break;
            case 'unix_ms':
                timestamp = now.getTime();
                break;
            case 'date':
                timestamp = now.toISOString().split('T')[0];
                break;
            case 'time':
                timestamp = now.toISOString().split('T')[1];
                break;
        }
        return (0, error_handler_js_1.createSuccessResult)({ timestamp, format });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_timestamp.js.map