"use strict";
/**
 * snow_create_processor
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_processor',
    description: 'Create script processor (ES5 only!)',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Processor name' },
            path: { type: 'string', description: 'URL path' },
            script: { type: 'string', description: 'Processing script (ES5 only!)' },
            type: { type: 'string', enum: ['script', 'scripted_rest'], default: 'script' },
            active: { type: 'boolean', default: true }
        },
        required: ['name', 'path', 'script']
    }
};
async function execute(args, context) {
    const { name, path, script, type = 'script', active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const processorData = {
            name,
            path,
            script,
            type,
            active
        };
        const response = await client.post('/api/now/table/sys_processor', processorData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, processor: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_processor.js.map