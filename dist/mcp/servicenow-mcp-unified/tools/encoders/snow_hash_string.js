"use strict";
/**
 * snow_hash_string
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
    name: 'snow_hash_string',
    description: 'Hash string using various algorithms',
    inputSchema: {
        type: 'object',
        properties: {
            text: { type: 'string', description: 'Text to hash' },
            algorithm: { type: 'string', enum: ['md5', 'sha1', 'sha256', 'sha512'], default: 'sha256' }
        },
        required: ['text']
    }
};
async function execute(args, context) {
    const { text, algorithm = 'sha256' } = args;
    try {
        const hash = crypto_1.default.createHash(algorithm).update(text).digest('hex');
        return (0, error_handler_js_1.createSuccessResult)({ hash, algorithm, original_length: text.length });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_hash_string.js.map