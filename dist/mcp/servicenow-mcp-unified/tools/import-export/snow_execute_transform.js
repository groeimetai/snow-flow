"use strict";
/**
 * snow_execute_transform
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_execute_transform',
    description: 'Execute transform map on import set',
    inputSchema: {
        type: 'object',
        properties: {
            import_set_sys_id: { type: 'string', description: 'Import set sys_id' },
            transform_map_sys_id: { type: 'string', description: 'Transform map sys_id' }
        },
        required: ['import_set_sys_id', 'transform_map_sys_id']
    }
};
async function execute(args, context) {
    const { import_set_sys_id, transform_map_sys_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const transformScript = `
var transformer = new GlideTransformMap();
transformer.setTransformMap('${transform_map_sys_id}');
transformer.transformImportSet('${import_set_sys_id}');
    `;
        const response = await client.post('/api/now/table/sys_script_execution', {
            script: transformScript
        });
        return (0, error_handler_js_1.createSuccessResult)({
            executed: true,
            import_set: import_set_sys_id,
            transform_map: transform_map_sys_id
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_execute_transform.js.map