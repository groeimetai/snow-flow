"use strict";
/**
 * List all property categories
 * Uses official ServiceNow Table API on sys_properties
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tool = void 0;
exports.snow_property_categories = snow_property_categories;
const zod_1 = require("zod");
const servicenow_client_js_1 = require("../../../../utils/servicenow-client.js");
const mcp_logger_js_1 = require("../../../shared/mcp-logger.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const schema = zod_1.z.object({
    include_counts: zod_1.z.boolean().optional().default(true).describe('Include count of properties per category'),
});
async function snow_property_categories(args) {
    const params = schema.parse(args);
    const client = new servicenow_client_js_1.ServiceNowClient();
    const logger = new mcp_logger_js_1.MCPLogger('snow_property_categories');
    try {
        logger.info('Getting property categories');
        // Get distinct suffixes (categories)
        const response = await client.searchRecords('sys_properties', '', 1000);
        if (!response.success || !response.data?.result) {
            throw new Error('Failed to get categories');
        }
        const categories = {};
        for (const prop of response.data.result) {
            const category = prop.suffix || 'global';
            categories[category] = (categories[category] || 0) + 1;
        }
        const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
        let output = `📂 **Property Categories**\n\n`;
        for (const [category, count] of sorted) {
            if (params.include_counts) {
                output += `• **${category}** (${count} properties)\n`;
            }
            else {
                output += `• ${category}\n`;
            }
        }
        output += `\n📊 Total categories: ${sorted.length}`;
        output += `\n📋 Total properties: ${response.data.result.length}`;
        return {
            content: [{
                    type: 'text',
                    text: output
                }]
        };
    }
    catch (error) {
        logger.error('Failed to get categories:', error);
        throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to get categories: ${error instanceof Error ? error.message : String(error)}`);
    }
}
exports.tool = {
    name: 'snow_property_categories',
    description: 'List all property categories',
    inputSchema: {
        type: 'object',
        properties: {
            include_counts: {
                type: 'boolean',
                description: 'Include count of properties per category',
                default: true
            }
        }
    }
};
//# sourceMappingURL=snow_property_categories.js.map