"use strict";
/**
 * Validate property value against its type and constraints
 * Uses official ServiceNow Table API on sys_properties
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tool = void 0;
exports.snow_property_validate = snow_property_validate;
const zod_1 = require("zod");
const servicenow_client_js_1 = require("../../../../utils/servicenow-client.js");
const mcp_logger_js_1 = require("../../../shared/mcp-logger.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const schema = zod_1.z.object({
    name: zod_1.z.string().describe('Property name'),
    value: zod_1.z.string().describe('Value to validate'),
});
async function snow_property_validate(args) {
    const params = schema.parse(args);
    const client = new servicenow_client_js_1.ServiceNowClient();
    const logger = new mcp_logger_js_1.MCPLogger('snow_property_validate');
    try {
        logger.info(`Validating property: ${params.name} = ${params.value}`);
        // Get property metadata
        const response = await client.searchRecords('sys_properties', `name=${params.name}`, 1);
        if (!response.success || !response.data?.result?.length) {
            return {
                content: [{
                        type: 'text',
                        text: `❌ Property not found: ${params.name}. Cannot validate.`
                    }]
            };
        }
        const property = response.data.result[0];
        const validationResults = [];
        let isValid = true;
        // Type validation
        if (property.type) {
            switch (property.type) {
                case 'boolean':
                    if (!['true', 'false', '1', '0'].includes(params.value.toLowerCase())) {
                        validationResults.push('❌ Value must be true/false');
                        isValid = false;
                    }
                    else {
                        validationResults.push('✅ Valid boolean value');
                    }
                    break;
                case 'integer':
                    if (!/^-?\d+$/.test(params.value)) {
                        validationResults.push('❌ Value must be an integer');
                        isValid = false;
                    }
                    else {
                        validationResults.push('✅ Valid integer value');
                    }
                    break;
                case 'float':
                case 'decimal':
                    if (!/^-?\d*\.?\d+$/.test(params.value)) {
                        validationResults.push('❌ Value must be a number');
                        isValid = false;
                    }
                    else {
                        validationResults.push('✅ Valid numeric value');
                    }
                    break;
                case 'string':
                default:
                    validationResults.push('✅ Valid string value');
            }
        }
        // Choices validation
        if (property.choices) {
            const validChoices = property.choices.split(',').map((c) => c.trim());
            if (!validChoices.includes(params.value)) {
                validationResults.push(`❌ Value must be one of: ${validChoices.join(', ')}`);
                isValid = false;
            }
            else {
                validationResults.push('✅ Valid choice');
            }
        }
        return {
            content: [{
                    type: 'text',
                    text: `🔍 **Property Validation: ${params.name}**

**Current Value:** ${property.value}
**New Value:** ${params.value}
**Type:** ${property.type || 'string'}
${property.choices ? `**Valid Choices:** ${property.choices}` : ''}

**Validation Results:**
${validationResults.join('\n')}

**Overall:** ${isValid ? '✅ VALID' : '❌ INVALID'}`
                }]
        };
    }
    catch (error) {
        logger.error('Validation failed:', error);
        throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
exports.tool = {
    name: 'snow_property_validate',
    description: 'Validate property value against its type and constraints',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Property name'
            },
            value: {
                type: 'string',
                description: 'Value to validate'
            }
        },
        required: ['name', 'value']
    }
};
//# sourceMappingURL=snow_property_validate.js.map