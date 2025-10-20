"use strict";
/**
 * Delete a system property
 * Uses official ServiceNow Table API on sys_properties
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tool = void 0;
exports.snow_property_delete = snow_property_delete;
const zod_1 = require("zod");
const servicenow_client_js_1 = require("../../../../utils/servicenow-client.js");
const mcp_logger_js_1 = require("../../../shared/mcp-logger.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const schema = zod_1.z.object({
    name: zod_1.z.string().describe('Property name to delete'),
    confirm: zod_1.z.boolean().default(false).describe('Confirmation flag (must be true)'),
});
async function snow_property_delete(args) {
    const params = schema.parse(args);
    const client = new servicenow_client_js_1.ServiceNowClient();
    const logger = new mcp_logger_js_1.MCPLogger('snow_property_delete');
    if (!params.confirm) {
        return {
            content: [{
                    type: 'text',
                    text: `⚠️ Deletion requires confirmation. Set confirm: true to proceed.

**Property to delete:** ${params.name}

⚠️ WARNING: Deleting system properties can affect ServiceNow functionality!`
                }]
        };
    }
    try {
        logger.info(`Deleting property: ${params.name}`);
        // Find the property
        const response = await client.searchRecords('sys_properties', `name=${params.name}`, 1);
        if (!response.success || !response.data?.result?.length) {
            return {
                content: [{
                        type: 'text',
                        text: `❌ Property not found: ${params.name}`
                    }]
            };
        }
        const sys_id = response.data.result[0].sys_id;
        const result = await client.deleteRecord('sys_properties', sys_id);
        if (!result.success) {
            throw new Error(`Failed to delete property: ${result.error}`);
        }
        return {
            content: [{
                    type: 'text',
                    text: `✅ Property deleted successfully: ${params.name}

⚠️ Note: Some properties may be recreated by ServiceNow on next access with default values.`
                }]
        };
    }
    catch (error) {
        logger.error('Failed to delete property:', error);
        throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to delete property: ${error instanceof Error ? error.message : String(error)}`);
    }
}
exports.tool = {
    name: 'snow_property_delete',
    description: 'Delete a system property',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Property name to delete'
            },
            confirm: {
                type: 'boolean',
                description: 'Confirmation flag (must be true)',
                default: false
            }
        },
        required: ['name', 'confirm']
    }
};
//# sourceMappingURL=snow_property_delete.js.map