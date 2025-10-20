"use strict";
/**
 * snow_parse_json
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_parse_json',
    description: 'Parse and validate JSON',
    inputSchema: {
        type: 'object',
        properties: {
            json_string: { type: 'string', description: 'JSON string to parse' }
        },
        required: ['json_string']
    }
};
async function execute(args, context) {
    const { json_string } = args;
    try {
        const parsed = JSON.parse(json_string);
        return (0, error_handler_js_1.createSuccessResult)({
            parsed: true,
            data: parsed,
            keys: Object.keys(parsed).length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(`Invalid JSON: ${error.message}`);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_parse_json.js.map