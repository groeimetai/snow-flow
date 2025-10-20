"use strict";
/**
 * snow_create_solution_package - Create solution packages
 *
 * Creates comprehensive solution packages containing multiple related artifacts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_solution_package',
    description: 'Creates comprehensive solution packages containing multiple related artifacts (widgets, scripts, rules). Manages dependencies and generates deployment documentation.',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Solution package name' },
            description: { type: 'string', description: 'Package description' },
            artifacts: {
                type: 'array',
                description: 'Artifacts to include in the package',
                items: {
                    type: 'object',
                    properties: {
                        type: { type: 'string', enum: ['widget', 'script_include', 'business_rule', 'table'] },
                        create: { type: 'object', description: 'Artifact creation configuration' },
                    },
                },
            },
            new_update_set: { type: 'boolean', description: 'Force new update set', default: true },
        },
        required: ['name', 'artifacts'],
    }
};
async function execute(args, context) {
    const { name, description, artifacts, new_update_set = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const results = {
            package_name: name,
            created_artifacts: [],
            update_set_id: null,
            errors: []
        };
        // Step 1: Create Update Set for the package
        if (new_update_set) {
            const updateSetResponse = await client.post('/api/now/table/sys_update_set', {
                name: `${name} - Solution Package`,
                description: description || `Solution package: ${name}`,
                state: 'in progress'
            });
            results.update_set_id = updateSetResponse.data.result.sys_id;
            // Set as current Update Set
            await client.put(`/api/now/table/sys_update_set/${results.update_set_id}`, {
                is_current: true
            });
        }
        // Step 2: Create each artifact
        for (const artifact of artifacts) {
            try {
                const tableMap = {
                    widget: 'sp_widget',
                    script_include: 'sys_script_include',
                    business_rule: 'sys_script',
                    table: 'sys_db_object'
                };
                const tableName = tableMap[artifact.type];
                if (!tableName) {
                    results.errors.push(`Unsupported artifact type: ${artifact.type}`);
                    continue;
                }
                const createResponse = await client.post(`/api/now/table/${tableName}`, artifact.create);
                results.created_artifacts.push({
                    type: artifact.type,
                    sys_id: createResponse.data.result.sys_id,
                    name: createResponse.data.result.name || createResponse.data.result.id,
                    table: tableName
                });
            }
            catch (artifactError) {
                results.errors.push({
                    type: artifact.type,
                    error: artifactError.message
                });
            }
        }
        // Step 3: Generate deployment documentation
        const documentation = {
            package: name,
            description,
            created_at: new Date().toISOString(),
            update_set: results.update_set_id,
            artifacts: results.created_artifacts,
            total_artifacts: results.created_artifacts.length,
            total_errors: results.errors.length
        };
        const message = `✅ Solution Package Created\n\n` +
            `Package: ${name}\n` +
            `Update Set: ${results.update_set_id}\n` +
            `Artifacts Created: ${results.created_artifacts.length}\n` +
            `Errors: ${results.errors.length}\n\n` +
            `Artifacts:\n${results.created_artifacts.map((a) => `- ${a.type}: ${a.name} (${a.sys_id})`).join('\n')}` +
            (results.errors.length > 0 ? `\n\nErrors:\n${results.errors.map((e) => `- ${typeof e === 'string' ? e : e.error}`).join('\n')}` : '');
        return (0, error_handler_js_1.createSuccessResult)({
            ...results,
            documentation
        }, { message });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError
            ? error
            : new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.NETWORK_ERROR, `Solution package creation failed: ${error.message}`, { originalError: error }));
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_solution_package.js.map