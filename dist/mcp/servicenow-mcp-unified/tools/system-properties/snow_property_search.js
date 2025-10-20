"use strict";
/**
 * Search properties by name or value content
 * Uses official ServiceNow Table API on sys_properties
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tool = void 0;
exports.snow_property_search = snow_property_search;
const zod_1 = require("zod");
const servicenow_client_js_1 = require("../../../../utils/servicenow-client.js");
const mcp_logger_js_1 = require("../../../shared/mcp-logger.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const schema = zod_1.z.object({
    search_term: zod_1.z.string().describe('Search term to find in property names or values'),
    search_in: zod_1.z.enum(['name', 'value', 'description', 'all']).optional().default('all').describe('Where to search'),
    limit: zod_1.z.number().optional().default(50).describe('Maximum results'),
});
async function snow_property_search(args) {
    const params = schema.parse(args);
    const client = new servicenow_client_js_1.ServiceNowClient();
    const logger = new mcp_logger_js_1.MCPLogger('snow_property_search');
    try {
        logger.info(`Searching properties for: ${params.search_term}`);
        let query = '';
        switch (params.search_in) {
            case 'name':
                query = `nameLIKE${params.search_term}`;
                break;
            case 'value':
                query = `valueLIKE${params.search_term}`;
                break;
            case 'description':
                query = `descriptionLIKE${params.search_term}`;
                break;
            case 'all':
            default:
                query = `nameLIKE${params.search_term}^ORvalueLIKE${params.search_term}^ORdescriptionLIKE${params.search_term}`;
        }
        const response = await client.searchRecords('sys_properties', query, params.limit);
        if (!response.success || !response.data?.result) {
            throw new Error('Search failed');
        }
        const results = response.data.result;
        if (results.length === 0) {
            return {
                content: [{
                        type: 'text',
                        text: `No properties found matching: "${params.search_term}"`
                    }]
            };
        }
        let output = `🔍 **Search Results** (Found: ${results.length})\n`;
        output += `Search term: "${params.search_term}" in ${params.search_in}\n\n`;
        for (const prop of results) {
            output += `**${prop.name}**\n`;
            output += `• Value: ${prop.value || '(empty)'}\n`;
            if (prop.description) {
                output += `• Description: ${prop.description}\n`;
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
        logger.error('Search failed:', error);
        throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
exports.tool = {
    name: 'snow_property_search',
    description: 'Search properties by name or value content',
    inputSchema: {
        type: 'object',
        properties: {
            search_term: {
                type: 'string',
                description: 'Search term to find in property names or values'
            },
            search_in: {
                type: 'string',
                enum: ['name', 'value', 'description', 'all'],
                description: 'Where to search',
                default: 'all'
            },
            limit: {
                type: 'number',
                description: 'Maximum results',
                default: 50
            }
        },
        required: ['search_term']
    }
};
//# sourceMappingURL=snow_property_search.js.map