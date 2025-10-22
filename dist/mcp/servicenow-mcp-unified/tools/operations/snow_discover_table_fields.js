"use strict";
/**
 * snow_discover_table_fields - Discover table schema
 *
 * Get comprehensive table schema information including fields,
 * relationships, indexes, and ACLs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_discover_table_fields',
    description: 'Discover table schema with fields, types, relationships, and metadata',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'schema',
    use_cases: ['discovery', 'schema'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            table_name: {
                type: 'string',
                description: 'Table name to discover schema for'
            },
            include_relationships: {
                type: 'boolean',
                description: 'Include field relationships (reference fields)',
                default: true
            },
            include_acls: {
                type: 'boolean',
                description: 'Include ACL information',
                default: false
            },
            include_indexes: {
                type: 'boolean',
                description: 'Include index information',
                default: false
            }
        },
        required: ['table_name']
    }
};
async function execute(args, context) {
    const { table_name, include_relationships = true, include_acls = false, include_indexes = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Step 1: Get table metadata
        const tableResponse = await client.get('/api/now/table/sys_db_object', {
            params: {
                sysparm_query: `name=${table_name}`,
                sysparm_limit: 1
            }
        });
        if (tableResponse.data.result.length === 0) {
            return (0, error_handler_js_1.createErrorResult)(`Table not found: ${table_name}`);
        }
        const tableInfo = tableResponse.data.result[0];
        // Step 2: Get all fields for the table
        const fieldsResponse = await client.get('/api/now/table/sys_dictionary', {
            params: {
                sysparm_query: `name=${table_name}^element!=NULL^ORDERBYelement`,
                sysparm_limit: 1000
            }
        });
        const fields = fieldsResponse.data.result.map((field) => ({
            name: field.element,
            label: field.column_label,
            type: field.internal_type?.display_value || field.internal_type,
            max_length: field.max_length,
            mandatory: field.mandatory === 'true',
            read_only: field.read_only === 'true',
            default_value: field.default_value,
            reference: field.reference?.display_value || field.reference,
            help_text: field.help
        }));
        // Step 3: Get relationships if requested
        let relationships = [];
        if (include_relationships) {
            const refFields = fields.filter((f) => f.type === 'reference');
            relationships = refFields.map((f) => ({
                field: f.name,
                references_table: f.reference,
                type: 'many-to-one'
            }));
        }
        // Step 4: Get ACLs if requested
        let acls = [];
        if (include_acls) {
            const aclResponse = await client.get('/api/now/table/sys_security_acl', {
                params: {
                    sysparm_query: `name=${table_name}`,
                    sysparm_limit: 100
                }
            });
            acls = aclResponse.data.result.map((acl) => ({
                operation: acl.operation,
                roles: acl.roles,
                condition: acl.condition,
                script: acl.script ? 'Present' : 'None'
            }));
        }
        // Step 5: Get indexes if requested
        let indexes = [];
        if (include_indexes) {
            const indexResponse = await client.get('/api/now/table/sys_db_index', {
                params: {
                    sysparm_query: `table=${table_name}`,
                    sysparm_limit: 100
                }
            });
            indexes = indexResponse.data.result.map((idx) => ({
                name: idx.name,
                fields: idx.field_list,
                unique: idx.unique === 'true'
            }));
        }
        return (0, error_handler_js_1.createSuccessResult)({
            table: {
                name: table_name,
                label: tableInfo.label,
                extends: tableInfo.super_class?.display_value || null,
                sys_id: tableInfo.sys_id
            },
            fields,
            field_count: fields.length,
            relationships,
            acls: include_acls ? acls : undefined,
            indexes: include_indexes ? indexes : undefined
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_discover_table_fields.js.map