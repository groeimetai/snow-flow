"use strict";
/**
 * Get multiple properties at once
 * Uses official ServiceNow Table API on sys_properties
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tool = void 0;
exports.snow_property_bulk_get = snow_property_bulk_get;
const zod_1 = require("zod");
const servicenow_client_js_1 = require("../../../../utils/servicenow-client.js");
const mcp_logger_js_1 = require("../../../shared/mcp-logger.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const schema = zod_1.z.object({
    names: zod_1.z.array(zod_1.z.string()).describe('Array of property names to retrieve'),
    include_metadata: zod_1.z.boolean().optional().default(false).describe('Include full metadata for each property'),
});
async function snow_property_bulk_get(args) {
    const params = schema.parse(args);
    const client = new servicenow_client_js_1.ServiceNowClient();
    const logger = new mcp_logger_js_1.MCPLogger('snow_property_bulk_get');
    try {
        logger.info(`Bulk getting ${params.names.length} properties`);
        const results = {};
        const errors = [];
        for (const name of params.names) {
            try {
                const response = await client.searchRecords('sys_properties', `name=${name}`, 1);
                if (response.success && response.data?.result?.length > 0) {
                    const prop = response.data.result[0];
                    results[name] = params.include_metadata ? prop : prop.value;
                }
                else {
                    results[name] = null;
                    errors.push(name);
                }
            }
            catch (error) {
                logger.error(`Failed to get property ${name}:`, error);
                results[name] = null;
                errors.push(name);
            }
        }
        let output = `📋 **Bulk Property Retrieval**\n\n`;
        if (params.include_metadata) {
            output += JSON.stringify(results, null, 2);
        }
        else {
            for (const [name, value] of Object.entries(results)) {
                output += `• ${name} = ${value !== null ? `"${value}"` : 'NOT FOUND'}\n`;
            }
        }
        if (errors.length > 0) {
            output += `\n⚠️ Properties not found: ${errors.join(', ')}`;
        }
        return {
            content: [{
                    type: 'text',
                    text: output
                }]
        };
    }
    catch (error) {
        logger.error('Bulk get failed:', error);
        throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Bulk get failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
exports.tool = {
    name: 'snow_property_bulk_get',
    description: 'Get multiple properties at once',
    inputSchema: {
        type: 'object',
        properties: {
            names: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of property names to retrieve'
            },
            include_metadata: {
                type: 'boolean',
                description: 'Include full metadata for each property',
                default: false
            }
        },
        required: ['names']
    }
};
//# sourceMappingURL=snow_property_bulk_get.js.map