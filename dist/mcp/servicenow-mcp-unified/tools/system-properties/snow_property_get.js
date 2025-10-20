"use strict";
/**
 * Get a system property value by name
 * Uses official ServiceNow Table API on sys_properties
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tool = void 0;
exports.snow_property_get = snow_property_get;
const zod_1 = require("zod");
const servicenow_client_js_1 = require("../../../../utils/servicenow-client.js");
const mcp_logger_js_1 = require("../../../shared/mcp-logger.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const schema = zod_1.z.object({
    name: zod_1.z.string().describe('Property name (e.g., glide.servlet.uri)'),
    include_metadata: zod_1.z.boolean().optional().default(false).describe('Include full property metadata'),
});
async function snow_property_get(args) {
    const params = schema.parse(args);
    const client = new servicenow_client_js_1.ServiceNowClient();
    const logger = new mcp_logger_js_1.MCPLogger('snow_property_get');
    try {
        logger.info(`Getting property: ${params.name}`);
        logger.trackAPICall('SEARCH', 'sys_properties', 1);
        const response = await client.searchRecords('sys_properties', `name=${params.name}`, 1);
        if (!response.success || !response.data?.result?.length) {
            return {
                content: [{
                        type: 'text',
                        text: `❌ Property not found: ${params.name}`
                    }]
            };
        }
        const property = response.data.result[0];
        if (params.include_metadata) {
            return {
                content: [{
                        type: 'text',
                        text: `📋 **Property: ${params.name}**

**Value:** ${property.value || '(empty)'}
**Type:** ${property.type || 'string'}
**Description:** ${property.description || 'No description'}
**Suffix:** ${property.suffix || 'global'}
**Private:** ${property.is_private === 'true' ? 'Yes' : 'No'}
**Choices:** ${property.choices || 'None'}
**sys_id:** ${property.sys_id}

✅ Property retrieved successfully`
                    }]
            };
        }
        else {
            return {
                content: [{
                        type: 'text',
                        text: property.value || ''
                    }]
            };
        }
    }
    catch (error) {
        logger.error('Failed to get property:', error);
        throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to get property: ${error instanceof Error ? error.message : String(error)}`);
    }
}
exports.tool = {
    name: 'snow_property_get',
    description: 'Get a system property value by name',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Property name (e.g., glide.servlet.uri)'
            },
            include_metadata: {
                type: 'boolean',
                description: 'Include full property metadata',
                default: false
            }
        },
        required: ['name']
    }
};
//# sourceMappingURL=snow_property_get.js.map