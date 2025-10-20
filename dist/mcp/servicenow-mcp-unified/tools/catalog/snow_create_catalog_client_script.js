"use strict";
/**
 * snow_create_catalog_client_script - Create catalog client script
 *
 * Creates client scripts for catalog items to add custom JavaScript behavior to forms.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_catalog_client_script',
    description: 'Creates client scripts for catalog items to add custom JavaScript behavior to forms.',
    inputSchema: {
        type: 'object',
        properties: {
            cat_item: { type: 'string', description: 'Catalog item sys_id' },
            name: { type: 'string', description: 'Script name' },
            script: { type: 'string', description: 'JavaScript code' },
            type: { type: 'string', description: 'Type: onLoad, onChange, onSubmit, onCellEdit' },
            applies_to: { type: 'string', description: 'Applies to: item, set, variable' },
            variable: { type: 'string', description: 'Variable name (for onChange)' },
            active: { type: 'boolean', description: 'Active status', default: true }
        },
        required: ['cat_item', 'name', 'script', 'type']
    }
};
async function execute(args, context) {
    const { cat_item, name, script, type, applies_to = 'item', variable, active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const scriptData = {
            cat_item,
            name,
            script,
            type,
            applies_to,
            active
        };
        if (variable)
            scriptData.cat_variable = variable;
        const response = await client.post('/api/now/table/catalog_script_client', scriptData);
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            client_script: response.data.result,
            sys_id: response.data.result.sys_id
        }, {
            operation: 'create_catalog_client_script',
            name,
            type
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_catalog_client_script.js.map