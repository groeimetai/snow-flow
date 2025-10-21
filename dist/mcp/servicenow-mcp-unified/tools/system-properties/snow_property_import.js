"use strict";
/**
 * Import system properties from JSON
 * Uses official ServiceNow Table API on sys_properties
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tool = void 0;
exports.snow_property_import = snow_property_import;
const zod_1 = require("zod");
const servicenow_client_js_1 = require("../../../../utils/servicenow-client.js");
const mcp_logger_js_1 = require("../../../shared/mcp-logger.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const schema = zod_1.z.object({
    properties: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).describe('JSON object with property names as keys'),
    overwrite: zod_1.z.boolean().optional().default(false).describe('Overwrite existing properties'),
    dry_run: zod_1.z.boolean().optional().default(false).describe('Preview changes without applying'),
});
async function snow_property_import(args) {
    const params = schema.parse(args);
    const client = new servicenow_client_js_1.ServiceNowClient();
    const logger = new mcp_logger_js_1.MCPLogger('snow_property_import');
    try {
        logger.info('Importing properties', { count: Object.keys(params.properties).length, overwrite: params.overwrite, dry_run: params.dry_run });
        const results = {
            would_create: [],
            would_update: [],
            would_skip: [],
            created: [],
            updated: [],
            skipped: [],
            failed: []
        };
        for (const [name, data] of Object.entries(params.properties)) {
            try {
                // Check if exists
                const existing = await client.searchRecords('sys_properties', `name=${name}`, 1);
                const exists = existing.success && existing.data?.result?.length > 0;
                if (params.dry_run) {
                    if (exists && params.overwrite) {
                        results.would_update.push(name);
                    }
                    else if (exists && !params.overwrite) {
                        results.would_skip.push(name);
                    }
                    else {
                        results.would_create.push(name);
                    }
                    continue;
                }
                if (exists && !params.overwrite) {
                    results.skipped.push(name);
                    continue;
                }
                const propertyData = typeof data === 'object' ? data : { value: data };
                if (exists) {
                    // Update
                    const sys_id = existing.data.result[0].sys_id;
                    const result = await client.updateRecord('sys_properties', sys_id, {
                        value: propertyData.value,
                        ...(propertyData.description && { description: propertyData.description }),
                        ...(propertyData.type && { type: propertyData.type }),
                        ...(propertyData.suffix && { suffix: propertyData.suffix }),
                        ...(propertyData.choices && { choices: propertyData.choices }),
                        ...(propertyData.is_private !== undefined && { is_private: propertyData.is_private ? 'true' : 'false' })
                    });
                    if (result.success) {
                        results.updated.push(name);
                    }
                    else {
                        results.failed.push(`${name}: ${result.error}`);
                    }
                }
                else {
                    // Create
                    logger.trackAPICall('CREATE', 'sys_properties', 1);
                    const result = await client.createRecord('sys_properties', {
                        name,
                        value: propertyData.value,
                        description: propertyData.description || `Imported by Snow-Flow`,
                        type: propertyData.type || 'string',
                        suffix: propertyData.suffix || 'global',
                        choices: propertyData.choices || '',
                        is_private: propertyData.is_private ? 'true' : 'false'
                    });
                    if (result.success) {
                        results.created.push(name);
                    }
                    else {
                        results.failed.push(`${name}: ${result.error}`);
                    }
                }
            }
            catch (error) {
                logger.error(`Failed to import property ${name}:`, error);
                results.failed.push(`${name}: ${error}`);
            }
        }
        if (params.dry_run) {
            return {
                content: [{
                        type: 'text',
                        text: `🔍 **Import Preview (Dry Run)**

Would create: ${results.would_create.length}
${results.would_create.slice(0, 10).map(n => `• ${n}`).join('\n')}${results.would_create.length > 10 ? `\n... and ${results.would_create.length - 10} more` : ''}

Would update: ${results.would_update.length}
${results.would_update.slice(0, 10).map(n => `• ${n}`).join('\n')}${results.would_update.length > 10 ? `\n... and ${results.would_update.length - 10} more` : ''}

Would skip: ${results.would_skip.length}
${results.would_skip.slice(0, 10).map(n => `• ${n}`).join('\n')}${results.would_skip.length > 10 ? `\n... and ${results.would_skip.length - 10} more` : ''}

✅ Run with dry_run: false to apply changes`
                    }]
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: `📥 **Import Results**

✅ Created: ${results.created.length}
🔄 Updated: ${results.updated.length}
⏭️ Skipped: ${results.skipped.length}
${results.failed.length > 0 ? `❌ Failed: ${results.failed.length}\n${results.failed.join('\n')}` : ''}

Total processed: ${Object.keys(params.properties).length}`
                }]
        };
    }
    catch (error) {
        logger.error('Import failed:', error);
        throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Import failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
exports.tool = {
    name: 'snow_property_import',
    description: 'Import system properties from JSON',
    inputSchema: {
        type: 'object',
        properties: {
            properties: {
                type: 'object',
                description: 'JSON object with property names as keys'
            },
            overwrite: {
                type: 'boolean',
                description: 'Overwrite existing properties',
                default: false
            },
            dry_run: {
                type: 'boolean',
                description: 'Preview changes without applying',
                default: false
            }
        },
        required: ['properties']
    }
};
//# sourceMappingURL=snow_property_import.js.map