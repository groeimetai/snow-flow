"use strict";
/**
 * List system properties with optional filtering
 * Uses official ServiceNow Table API on sys_properties
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tool = void 0;
exports.snow_property_list = snow_property_list;
const zod_1 = require("zod");
const servicenow_client_js_1 = require("../../../../utils/servicenow-client.js");
const mcp_logger_js_1 = require("../../../shared/mcp-logger.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const schema = zod_1.z.object({
    pattern: zod_1.z.string().optional().describe('Name pattern to filter (e.g., glide.* for all glide properties)'),
    category: zod_1.z.string().optional().describe('Property category filter'),
    is_private: zod_1.z.boolean().optional().describe('Filter by private properties'),
    limit: zod_1.z.number().optional().default(100).describe('Maximum number of properties to return'),
    include_values: zod_1.z.boolean().optional().default(true).describe('Include property values in response'),
});
async function snow_property_list(args) {
    const params = schema.parse(args);
    const client = new servicenow_client_js_1.ServiceNowClient();
    const logger = new mcp_logger_js_1.MCPLogger('snow_property_list');
    try {
        logger.info('Listing properties', { pattern: params.pattern, category: params.category, limit: params.limit });
        const conditions = [];
        if (params.pattern) {
            if (params.pattern.includes('*')) {
                // Convert wildcard to LIKE query
                const likePattern = params.pattern.replace(/\*/g, '');
                conditions.push(`nameLIKE${likePattern}`);
            }
            else {
                conditions.push(`name=${params.pattern}`);
            }
        }
        if (params.category) {
            conditions.push(`suffix=${params.category}`);
        }
        if (params.is_private !== undefined) {
            conditions.push(`is_private=${params.is_private ? 'true' : 'false'}`);
        }
        const query = conditions.join('^');
        const response = await client.searchRecords('sys_properties', query, params.limit);
        if (!response.success || !response.data?.result) {
            throw new Error('Failed to list properties');
        }
        const properties = response.data.result;
        // Group by category/suffix
        const grouped = {};
        for (const prop of properties) {
            const category = prop.suffix || 'global';
            if (!grouped[category])
                grouped[category] = [];
            grouped[category].push(prop);
        }
        let output = `📋 **System Properties** (Found: ${properties.length})\n\n`;
        for (const [cat, props] of Object.entries(grouped)) {
            output += `**Category: ${cat}**\n`;
            for (const prop of props) {
                if (params.include_values) {
                    output += `• ${prop.name} = "${prop.value || ''}"\n`;
                    if (prop.description) {
                        output += `  ↳ ${prop.description}\n`;
                    }
                }
                else {
                    output += `• ${prop.name}\n`;
                }
            }
            output += '\n';
        }
        return {
            content: [{
                    type: 'text',
                    text: output
                }]
        };
    }
    catch (error) {
        logger.error('Failed to list properties:', error);
        throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to list properties: ${error instanceof Error ? error.message : String(error)}`);
    }
}
exports.tool = {
    name: 'snow_property_list',
    description: 'List system properties with optional filtering',
    inputSchema: {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'Name pattern to filter (e.g., glide.* for all glide properties)'
            },
            category: {
                type: 'string',
                description: 'Property category filter'
            },
            is_private: {
                type: 'boolean',
                description: 'Filter by private properties'
            },
            limit: {
                type: 'number',
                description: 'Maximum number of properties to return',
                default: 100
            },
            include_values: {
                type: 'boolean',
                description: 'Include property values in response',
                default: true
            }
        }
    }
};
//# sourceMappingURL=snow_property_list.js.map