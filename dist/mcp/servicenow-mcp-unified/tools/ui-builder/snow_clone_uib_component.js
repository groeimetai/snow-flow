"use strict";
/**
 * snow_clone_uib_component - Clone existing components
 *
 * Clones an existing UI Builder component to create a customized
 * variant with modifications.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_clone_uib_component',
    description: 'Clone existing UI Builder component to create customized variant',
    inputSchema: {
        type: 'object',
        properties: {
            source_component_id: {
                type: 'string',
                description: 'Source component sys_id to clone'
            },
            new_name: {
                type: 'string',
                description: 'Name for the cloned component'
            },
            new_label: {
                type: 'string',
                description: 'Label for the cloned component'
            },
            modifications: {
                type: 'object',
                description: 'Specific modifications to apply to cloned component'
            },
            category: {
                type: 'string',
                description: 'Category for cloned component',
                default: 'custom'
            },
            version: {
                type: 'string',
                description: 'Version for cloned component',
                default: '1.0.0'
            },
            description: {
                type: 'string',
                description: 'Description of clone purpose and changes'
            }
        },
        required: ['source_component_id', 'new_name', 'new_label']
    }
};
async function execute(args, context) {
    const { source_component_id, new_name, new_label, modifications = {}, category = 'custom', version = '1.0.0', description = '' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Get source component
        const sourceResponse = await client.get(`/api/now/table/sys_ux_lib_component/${source_component_id}`);
        const sourceComponent = sourceResponse.data.result;
        // Create cloned component
        const clonedComponent = {
            name: new_name,
            label: new_label,
            category,
            version,
            description: description || `Cloned from ${sourceComponent.name}`,
            source_code: sourceComponent.source_code,
            properties: sourceComponent.properties,
            template: sourceComponent.template
        };
        // Apply modifications
        Object.keys(modifications).forEach(key => {
            if (modifications[key] !== undefined) {
                clonedComponent[key] = modifications[key];
            }
        });
        const response = await client.post('/api/now/table/sys_ux_lib_component', clonedComponent);
        return (0, error_handler_js_1.createSuccessResult)({
            component: {
                sys_id: response.data.result.sys_id,
                name: new_name,
                label: new_label,
                cloned_from: source_component_id
            }
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_clone_uib_component.js.map