"use strict";
/**
 * Set or update a system property value
 * Uses official ServiceNow Table API on sys_properties
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tool = void 0;
exports.snow_property_set = snow_property_set;
const zod_1 = require("zod");
const servicenow_client_js_1 = require("../../../../utils/servicenow-client.js");
const mcp_logger_js_1 = require("../../../shared/mcp-logger.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const schema = zod_1.z.object({
    name: zod_1.z.string().describe('Property name'),
    value: zod_1.z.string().describe('Property value'),
    description: zod_1.z.string().optional().describe('Property description (optional)'),
    type: zod_1.z.string().optional().default('string').describe('Property type (string, boolean, integer, etc.)'),
    choices: zod_1.z.string().optional().describe('Comma-separated list of valid choices (optional)'),
    is_private: zod_1.z.boolean().optional().default(false).describe('Mark property as private'),
    suffix: zod_1.z.string().optional().describe('Property suffix/scope (optional)'),
});
async function snow_property_set(args) {
    const params = schema.parse(args);
    const client = new servicenow_client_js_1.ServiceNowClient();
    const logger = new mcp_logger_js_1.MCPLogger('snow_property_set');
    try {
        logger.info(`Setting property: ${params.name} = ${params.value}`);
        // Check if property exists
        logger.trackAPICall('SEARCH', 'sys_properties', 1);
        const existing = await client.searchRecords('sys_properties', `name=${params.name}`, 1);
        let result;
        if (existing.success && existing.data?.result?.length > 0) {
            // Update existing property
            const sys_id = existing.data.result[0].sys_id;
            logger.trackAPICall('UPDATE', 'sys_properties', 1);
            result = await client.updateRecord('sys_properties', sys_id, {
                value: params.value,
                ...(params.description && { description: params.description }),
                ...(params.type && { type: params.type }),
                ...(params.choices && { choices: params.choices }),
                ...(params.suffix && { suffix: params.suffix }),
                is_private: params.is_private ? 'true' : 'false'
            });
            logger.info(`Updated property: ${params.name}`);
        }
        else {
            // Create new property
            logger.trackAPICall('CREATE', 'sys_properties', 1);
            result = await client.createRecord('sys_properties', {
                name: params.name,
                value: params.value,
                description: params.description || `Created by Snow-Flow`,
                type: params.type,
                choices: params.choices || '',
                is_private: params.is_private ? 'true' : 'false',
                suffix: params.suffix || 'global'
            });
            logger.info(`Created new property: ${params.name}`);
        }
        if (!result.success) {
            throw new Error(`Failed to set property: ${result.error}`);
        }
        return {
            content: [{
                    type: 'text',
                    text: `✅ Property set successfully!

**Name:** ${params.name}
**Value:** ${params.value}
**Type:** ${params.type}
${params.description ? `**Description:** ${params.description}` : ''}
${params.choices ? `**Choices:** ${params.choices}` : ''}
**Private:** ${params.is_private ? 'Yes' : 'No'}

💡 Changes take effect immediately in ServiceNow`
                }]
        };
    }
    catch (error) {
        logger.error('Failed to set property:', error);
        throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to set property: ${error instanceof Error ? error.message : String(error)}`);
    }
}
exports.tool = {
    name: 'snow_property_set',
    description: 'Set or update a system property value',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Property name'
            },
            value: {
                type: 'string',
                description: 'Property value'
            },
            description: {
                type: 'string',
                description: 'Property description (optional)'
            },
            type: {
                type: 'string',
                description: 'Property type (string, boolean, integer, etc.)',
                default: 'string'
            },
            choices: {
                type: 'string',
                description: 'Comma-separated list of valid choices (optional)'
            },
            is_private: {
                type: 'boolean',
                description: 'Mark property as private',
                default: false
            },
            suffix: {
                type: 'string',
                description: 'Property suffix/scope (optional)'
            }
        },
        required: ['name', 'value']
    }
};
//# sourceMappingURL=snow_property_set.js.map