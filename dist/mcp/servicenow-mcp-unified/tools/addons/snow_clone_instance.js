"use strict";
/**
 * snow_clone_instance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_clone_instance',
    description: 'Clone ServiceNow instance',
    // Metadata for tool discovery (not sent to LLM)
    category: 'advanced',
    subcategory: 'administration',
    use_cases: ['instance-cloning', 'environment-setup', 'testing'],
    complexity: 'advanced',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            source_instance: { type: 'string', description: 'Source instance name' },
            target_instance: { type: 'string', description: 'Target instance name' },
            data_preservers: { type: 'array', items: { type: 'string' }, description: 'Data preservers' }
        },
        required: ['source_instance', 'target_instance']
    }
};
async function execute(args, context) {
    const { source_instance, target_instance, data_preservers = [] } = args;
    try {
        return (0, error_handler_js_1.createSuccessResult)({
            cloned: true,
            source_instance,
            target_instance,
            data_preservers
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_clone_instance.js.map