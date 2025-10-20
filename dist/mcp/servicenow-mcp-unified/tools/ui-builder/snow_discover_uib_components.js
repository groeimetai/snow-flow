"use strict";
/**
 * snow_discover_uib_components - Browse components
 *
 * Discovers and browses ServiceNow built-in and custom UI Builder
 * components available for use.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_discover_uib_components',
    description: 'Browse ServiceNow built-in and custom UI Builder components',
    inputSchema: {
        type: 'object',
        properties: {
            category: {
                type: 'string',
                description: 'Filter by category (e.g., "forms", "lists", "custom")'
            },
            search: {
                type: 'string',
                description: 'Search component names and labels'
            },
            include_custom: {
                type: 'boolean',
                description: 'Include custom components',
                default: true
            },
            include_builtin: {
                type: 'boolean',
                description: 'Include built-in components',
                default: true
            },
            limit: {
                type: 'number',
                description: 'Maximum components to return',
                default: 100
            }
        }
    }
};
async function execute(args, context) {
    const { category, search, include_custom = true, include_builtin = true, limit = 100 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Build query
        const queryParts = [];
        if (category)
            queryParts.push(`category=${category}`);
        if (search)
            queryParts.push(`nameLIKE${search}^ORlabelLIKE${search}`);
        const query = queryParts.length > 0 ? queryParts.join('^') : '';
        const response = await client.get('/api/now/table/sys_ux_lib_component', {
            params: {
                sysparm_query: query,
                sysparm_limit: limit
            }
        });
        const components = response.data.result.map((comp) => ({
            sys_id: comp.sys_id,
            name: comp.name,
            label: comp.label,
            category: comp.category,
            description: comp.description,
            version: comp.version,
            is_custom: comp.category === 'custom'
        }));
        // Filter by type
        const filteredComponents = components.filter((comp) => {
            if (!include_custom && comp.is_custom)
                return false;
            if (!include_builtin && !comp.is_custom)
                return false;
            return true;
        });
        return (0, error_handler_js_1.createSuccessResult)({
            components: filteredComponents,
            total: filteredComponents.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_discover_uib_components.js.map