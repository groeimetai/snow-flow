"use strict";
/**
 * snow_create_field_map - Field mapping for transform maps
 *
 * Create field mappings within transform maps. Supports data transformation,
 * coalescing, and default values.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_field_map',
    description: 'Create field mapping within transform map for data transformation',
    inputSchema: {
        type: 'object',
        properties: {
            transformMapName: {
                type: 'string',
                description: 'Parent Transform Map name or sys_id'
            },
            sourceField: {
                type: 'string',
                description: 'Source field name'
            },
            targetField: {
                type: 'string',
                description: 'Target field name'
            },
            transform: {
                type: 'string',
                description: 'Transform script (JavaScript to transform value)'
            },
            coalesce: {
                type: 'boolean',
                description: 'Use as coalesce field for matching records',
                default: false
            },
            defaultValue: {
                type: 'string',
                description: 'Default value if source is empty'
            },
            choice: {
                type: 'boolean',
                description: 'Use choice list for mapping',
                default: false
            }
        },
        required: ['transformMapName', 'sourceField', 'targetField']
    }
};
async function execute(args, context) {
    const { transformMapName, sourceField, targetField, transform = '', coalesce = false, defaultValue = '', choice = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Find transform map
        let transformMapId = transformMapName;
        if (!transformMapName.match(/^[a-f0-9]{32}$/)) {
            const mapQuery = await client.get('/api/now/table/sys_transform_map', {
                params: {
                    sysparm_query: `name=${transformMapName}`,
                    sysparm_limit: 1
                }
            });
            if (!mapQuery.data.result || mapQuery.data.result.length === 0) {
                throw new Error(`Transform Map '${transformMapName}' not found`);
            }
            transformMapId = mapQuery.data.result[0].sys_id;
        }
        const fieldMapData = {
            map: transformMapId,
            source_field: sourceField,
            target_field: targetField,
            transform,
            coalesce,
            default_value: defaultValue,
            choice
        };
        const response = await client.post('/api/now/table/sys_transform_entry', fieldMapData);
        const fieldMap = response.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            field_map: {
                sys_id: fieldMap.sys_id,
                transform_map: transformMapId,
                source_field: sourceField,
                target_field: targetField,
                has_transform: !!transform,
                coalesce,
                has_default: !!defaultValue,
                choice
            },
            message: `Field mapping '${sourceField}' → '${targetField}' created successfully`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_field_map.js.map