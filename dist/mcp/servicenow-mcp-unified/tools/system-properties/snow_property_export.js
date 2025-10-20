"use strict";
/**
 * Export system properties to JSON format
 * Uses official ServiceNow Table API on sys_properties
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tool = void 0;
exports.snow_property_export = snow_property_export;
const zod_1 = require("zod");
const servicenow_client_js_1 = require("../../../../utils/servicenow-client.js");
const mcp_logger_js_1 = require("../../../shared/mcp-logger.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const schema = zod_1.z.object({
    pattern: zod_1.z.string().optional().describe('Pattern to filter properties (e.g., glide.*)'),
    include_system: zod_1.z.boolean().optional().default(false).describe('Include system properties'),
    include_private: zod_1.z.boolean().optional().default(false).describe('Include private properties'),
});
async function snow_property_export(args) {
    const params = schema.parse(args);
    const client = new servicenow_client_js_1.ServiceNowClient();
    const logger = new mcp_logger_js_1.MCPLogger('snow_property_export');
    try {
        logger.info('Exporting properties', { pattern: params.pattern, include_system: params.include_system, include_private: params.include_private });
        const conditions = [];
        if (params.pattern) {
            if (params.pattern.includes('*')) {
                const likePattern = params.pattern.replace(/\*/g, '');
                conditions.push(`nameLIKE${likePattern}`);
            }
            else {
                conditions.push(`name=${params.pattern}`);
            }
        }
        if (!params.include_system) {
            conditions.push(`name!=glide.*^name!=sys.*`);
        }
        if (!params.include_private) {
            conditions.push(`is_private=false`);
        }
        const query = conditions.join('^');
        const response = await client.searchRecords('sys_properties', query, 1000);
        if (!response.success || !response.data?.result) {
            throw new Error('Export failed');
        }
        const properties = response.data.result;
        const exportData = {};
        for (const prop of properties) {
            exportData[prop.name] = {
                value: prop.value,
                type: prop.type || 'string',
                description: prop.description || '',
                suffix: prop.suffix || 'global',
                is_private: prop.is_private === 'true',
                choices: prop.choices || ''
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: `📤 **Properties Export** (${properties.length} properties)

\`\`\`json
${JSON.stringify(exportData, null, 2)}
\`\`\`

✅ Export complete. You can save this JSON for backup or migration.`
                }]
        };
    }
    catch (error) {
        logger.error('Export failed:', error);
        throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
exports.tool = {
    name: 'snow_property_export',
    description: 'Export system properties to JSON format',
    inputSchema: {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'Pattern to filter properties (e.g., glide.*)'
            },
            include_system: {
                type: 'boolean',
                description: 'Include system properties',
                default: false
            },
            include_private: {
                type: 'boolean',
                description: 'Include private properties',
                default: false
            }
        }
    }
};
//# sourceMappingURL=snow_property_export.js.map