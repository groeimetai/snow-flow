"use strict";
/**
 * snow_cleanup_test_artifacts - Cleanup test data
 *
 * Safely cleanup test artifacts from ServiceNow (dry-run enabled by default).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_cleanup_test_artifacts',
    description: 'Safely cleanup test artifacts from ServiceNow (dry-run enabled by default for safety)',
    inputSchema: {
        type: 'object',
        properties: {
            artifact_type: {
                type: 'string',
                description: 'Type of artifacts to clean up',
                enum: ['incidents', 'requests', 'test_data', 'all']
            },
            name_pattern: {
                type: 'string',
                description: 'Pattern to match artifact names (e.g., "TEST", "DEMO")',
                default: 'TEST'
            },
            dry_run: {
                type: 'boolean',
                description: 'Preview cleanup without executing (default: true for safety)',
                default: true
            },
            limit: {
                type: 'number',
                description: 'Maximum number of records to clean up',
                default: 10,
                maximum: 100
            }
        },
        required: ['artifact_type']
    }
};
async function execute(args, context) {
    const { artifact_type, name_pattern = 'TEST', dry_run = true, limit = 10 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const cleanupResults = {
            artifact_type,
            name_pattern,
            dry_run,
            items_found: 0,
            items_deleted: 0,
            artifacts: []
        };
        const tables = [];
        if (artifact_type === 'incidents' || artifact_type === 'all')
            tables.push('incident');
        if (artifact_type === 'requests' || artifact_type === 'all')
            tables.push('sc_request');
        for (const table of tables) {
            const query = `short_descriptionLIKE${name_pattern}`;
            const response = await client.get(`/api/now/table/${table}`, {
                params: {
                    sysparm_query: query,
                    sysparm_limit: limit
                }
            });
            const records = response.data.result || [];
            cleanupResults.items_found += records.length;
            for (const record of records) {
                cleanupResults.artifacts.push({
                    table,
                    sys_id: record.sys_id,
                    number: record.number,
                    short_description: record.short_description
                });
                if (!dry_run) {
                    await client.delete(`/api/now/table/${table}/${record.sys_id}`);
                    cleanupResults.items_deleted++;
                }
            }
        }
        const message = dry_run
            ? `Found ${cleanupResults.items_found} test artifacts. Run with dry_run=false to delete.`
            : `Deleted ${cleanupResults.items_deleted} test artifacts successfully.`;
        return (0, error_handler_js_1.createSuccessResult)({
            message,
            ...cleanupResults
        }, { artifact_type, dry_run, items_found: cleanupResults.items_found });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_cleanup_test_artifacts.js.map