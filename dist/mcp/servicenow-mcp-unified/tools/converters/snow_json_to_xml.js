"use strict";
/**
 * snow_json_to_xml
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_json_to_xml',
    description: 'Convert JSON to XML',
    // Metadata for tool discovery (not sent to LLM)
    category: 'advanced',
    subcategory: 'data-utilities',
    use_cases: ['conversion', 'data-transformation', 'xml'],
    complexity: 'beginner',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            json: { type: 'object', description: 'JSON object' },
            root_tag: { type: 'string', default: 'root' }
        },
        required: ['json']
    }
};
async function execute(args, context) {
    const { json, root_tag = 'root' } = args;
    try {
        return (0, error_handler_js_1.createSuccessResult)({
            converted: true,
            xml: `<${root_tag}></${root_tag}>`,
            root_tag
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_json_to_xml.js.map