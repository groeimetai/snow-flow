"use strict";
/**
 * Get audit history for a property
 * Uses official ServiceNow Table API on sys_properties and sys_audit
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tool = void 0;
exports.snow_property_history = snow_property_history;
const zod_1 = require("zod");
const servicenow_client_js_1 = require("../../../../utils/servicenow-client.js");
const mcp_logger_js_1 = require("../../../shared/mcp-logger.js");
const schema = zod_1.z.object({
    name: zod_1.z.string().describe('Property name'),
    limit: zod_1.z.number().optional().default(10).describe('Number of history records'),
});
async function snow_property_history(args) {
    const params = schema.parse(args);
    const client = new servicenow_client_js_1.ServiceNowClient();
    const logger = new mcp_logger_js_1.MCPLogger('snow_property_history');
    try {
        logger.info(`Getting history for property: ${params.name}`);
        // First, get the property to get its sys_id
        const propResponse = await client.searchRecords('sys_properties', `name=${params.name}`, 1);
        if (!propResponse.success || !propResponse.data?.result?.length) {
            return {
                content: [{
                        type: 'text',
                        text: `❌ Property not found: ${params.name}`
                    }]
            };
        }
        const sys_id = propResponse.data.result[0].sys_id;
        // Get audit history
        const auditResponse = await client.searchRecords('sys_audit', `documentkey=${sys_id}^tablename=sys_properties`, params.limit);
        if (!auditResponse.success || !auditResponse.data?.result?.length) {
            return {
                content: [{
                        type: 'text',
                        text: `📜 No audit history found for property: ${params.name}`
                    }]
            };
        }
        let output = `📜 **Audit History: ${params.name}**\n\n`;
        for (const audit of auditResponse.data.result) {
            output += `**${audit.sys_created_on}**\n`;
            output += `• User: ${audit.sys_created_by}\n`;
            output += `• Field: ${audit.fieldname}\n`;
            output += `• Old: ${audit.oldvalue || '(empty)'}\n`;
            output += `• New: ${audit.newvalue || '(empty)'}\n`;
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
        logger.error('Failed to get history:', error);
        // Audit might not be available
        return {
            content: [{
                    type: 'text',
                    text: `⚠️ Audit history not available for this property or table.

Note: Audit history requires sys_audit to be enabled for sys_properties table.`
                }]
        };
    }
}
exports.tool = {
    name: 'snow_property_history',
    description: 'Get audit history for a property',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Property name'
            },
            limit: {
                type: 'number',
                description: 'Number of history records',
                default: 10
            }
        },
        required: ['name']
    }
};
//# sourceMappingURL=snow_property_history.js.map