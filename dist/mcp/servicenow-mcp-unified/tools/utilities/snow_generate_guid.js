"use strict";
/**
 * snow_generate_guid
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
const crypto_1 = __importDefault(require("crypto"));
exports.toolDefinition = {
    name: 'snow_generate_guid',
    description: 'Generate GUID/UUID',
    inputSchema: {
        type: 'object',
        properties: {
            format: { type: 'string', enum: ['uuid', 'guid', 'sys_id'], default: 'sys_id' }
        }
    }
};
async function execute(args, context) {
    const { format = 'sys_id' } = args;
    try {
        const uuid = crypto_1.default.randomUUID();
        let formatted = uuid;
        if (format === 'sys_id') {
            formatted = uuid.replace(/-/g, '');
        }
        else if (format === 'guid') {
            formatted = uuid.toUpperCase();
        }
        return (0, error_handler_js_1.createSuccessResult)({ guid: formatted, format });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_generate_guid.js.map