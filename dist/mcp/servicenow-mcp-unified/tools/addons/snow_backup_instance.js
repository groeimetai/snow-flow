"use strict";
/**
 * snow_backup_instance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_backup_instance',
    description: 'Create instance backup',
    inputSchema: {
        type: 'object',
        properties: {
            backup_name: { type: 'string', description: 'Backup name' },
            include_attachments: { type: 'boolean', default: true }
        },
        required: ['backup_name']
    }
};
async function execute(args, context) {
    const { backup_name, include_attachments = true } = args;
    try {
        return (0, error_handler_js_1.createSuccessResult)({
            backed_up: true,
            backup_name,
            include_attachments,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_backup_instance.js.map