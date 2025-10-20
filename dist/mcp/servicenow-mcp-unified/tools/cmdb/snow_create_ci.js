"use strict";
/**
 * snow_create_ci - Create Configuration Items
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_ci',
    description: 'Create Configuration Item in CMDB',
    inputSchema: {
        type: 'object',
        properties: {
            ci_class: { type: 'string', description: 'CI class (cmdb_ci_server, cmdb_ci_app, etc.)' },
            name: { type: 'string', description: 'CI name' },
            attributes: { type: 'object', description: 'CI attributes' },
            operational_status: { type: 'string', description: 'Operational status' },
            asset_tag: { type: 'string', description: 'Asset tag' }
        },
        required: ['ci_class', 'name']
    }
};
async function execute(args, context) {
    const { ci_class, name, attributes = {}, operational_status, asset_tag } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const ciData = { name, ...attributes };
        if (operational_status)
            ciData.operational_status = operational_status;
        if (asset_tag)
            ciData.asset_tag = asset_tag;
        const response = await client.post(`/api/now/table/${ci_class}`, ciData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, ci: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_ci.js.map