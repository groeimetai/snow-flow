"use strict";
/**
 * snow_discover_platform_tables - Platform table discovery
 *
 * Discover platform development tables categorized by type
 * (UI, script, policy, security, system).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_discover_platform_tables',
    description: 'Discover platform development tables by category (ui, script, policy, action)',
    // Metadata for tool discovery (not sent to LLM)
    category: 'core-operations',
    subcategory: 'discovery',
    use_cases: ['table-discovery', 'schema-exploration', 'platform-development'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            category: {
                type: 'string',
                enum: ['all', 'ui', 'script', 'policy', 'action', 'security', 'system'],
                description: 'Filter by table category',
                default: 'all'
            },
            limit: {
                type: 'number',
                description: 'Maximum results per category',
                default: 50
            }
        }
    }
};
const TABLE_CATEGORIES = [
    {
        category: 'ui',
        query: 'nameSTARTSWITHsys_ui^ORnameSTARTSWITHsp_',
        description: 'UI pages, forms, lists, and portal widgets'
    },
    {
        category: 'script',
        query: 'nameSTARTSWITHsys_script^ORname=sys_script_include',
        description: 'Scripts, script includes, and processors'
    },
    {
        category: 'policy',
        query: 'name=sys_ui_policy^ORname=sys_data_policy',
        description: 'UI policies and data policies'
    },
    {
        category: 'action',
        query: 'name=sys_ui_action^ORname=sys_ui_context_menu',
        description: 'UI actions and context menus'
    },
    {
        category: 'security',
        query: 'nameSTARTSWITHsys_security^ORname=sys_user_role',
        description: 'Security policies and roles'
    },
    {
        category: 'system',
        query: 'name=sys_dictionary^ORname=sys_db_object^ORname=sys_choice',
        description: 'System tables for schema and data'
    }
];
async function execute(args, context) {
    const { category = 'all', limit = 50 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const discoveredTables = [];
        const categoriesToQuery = category === 'all'
            ? TABLE_CATEGORIES
            : TABLE_CATEGORIES.filter(cat => cat.category === category);
        for (const cat of categoriesToQuery) {
            const response = await client.get('/api/now/table/sys_db_object', {
                params: {
                    sysparm_query: cat.query,
                    sysparm_limit: limit,
                    sysparm_fields: 'sys_id,name,label,super_class,is_extendable,extension_model'
                }
            });
            if (response.data.result && response.data.result.length > 0) {
                discoveredTables.push({
                    category: cat.category,
                    description: cat.description,
                    count: response.data.result.length,
                    tables: response.data.result.map((table) => ({
                        name: table.name,
                        label: table.label,
                        super_class: table.super_class,
                        is_extendable: table.is_extendable === 'true',
                        extension_model: table.extension_model,
                        sys_id: table.sys_id
                    }))
                });
            }
        }
        const totalTables = discoveredTables.reduce((sum, cat) => sum + cat.count, 0);
        return (0, error_handler_js_1.createSuccessResult)({
            discovered: true,
            platform_tables: discoveredTables,
            summary: {
                total_tables: totalTables,
                categories_found: discoveredTables.length,
                filter_applied: category
            },
            message: `Discovered ${totalTables} platform development tables across ${discoveredTables.length} categories`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_discover_platform_tables.js.map