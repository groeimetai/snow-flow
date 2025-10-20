"use strict";
/**
 * snow_edit_by_sysid - Edit artifacts by sys_id
 *
 * Updates specific fields of an artifact using sys_id with validation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_edit_by_sysid',
    description: 'Updates specific fields of an artifact using sys_id. Provides direct field-level modifications with validation.',
    inputSchema: {
        type: 'object',
        properties: {
            sys_id: {
                type: 'string',
                description: 'System ID of the artifact to edit'
            },
            table: {
                type: 'string',
                description: 'ServiceNow table name'
            },
            field: {
                type: 'string',
                description: 'Field name to update (e.g., script, server_script, template)'
            },
            value: {
                type: 'string',
                description: 'New value for the field'
            }
        },
        required: ['sys_id', 'table', 'field', 'value']
    }
};
async function execute(args, context) {
    const { sys_id, table, field, value } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Validate artifact exists
        const getResponse = await client.getRecord(table, sys_id);
        if (!getResponse.data?.result) {
            throw new Error(`Artifact with sys_id ${sys_id} not found in table ${table}`);
        }
        const artifact = getResponse.data.result;
        const oldValue = artifact[field];
        // Update the field
        const updates = {};
        updates[field] = value;
        const updateResponse = await client.updateRecord(table, sys_id, updates);
        if (!updateResponse.success) {
            throw new Error('Failed to update artifact');
        }
        return (0, error_handler_js_1.createSuccessResult)({
            updated: true,
            sys_id,
            table,
            field,
            name: artifact.name || artifact.title,
            old_value: oldValue ? oldValue.substring(0, 100) + '...' : null,
            new_value: value.substring(0, 100) + '...',
            url: `${context.instanceUrl}/nav_to.do?uri=${table}.do?sys_id=${sys_id}`,
            change_summary: {
                field_updated: field,
                characters_changed: value.length - (oldValue?.length || 0)
            }
        }, {
            sys_id,
            table,
            field
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error, {
            sys_id,
            table,
            field
        });
    }
}
//# sourceMappingURL=snow_edit_by_sysid.js.map