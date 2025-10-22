"use strict";
/**
 * snow_create_ux_app_config - Create UX app configuration
 *
 * STEP 2: Create UX App Configuration Record (sys_ux_app_config) -
 * Contains workspace settings and links to the experience from Step 1.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_ux_app_config',
    description: 'STEP 2: Create UX App Configuration Record (sys_ux_app_config) - Contains workspace settings and links to the experience from Step 1.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'ui-frameworks',
    subcategory: 'workspace',
    use_cases: ['workspace', 'configuration', 'ux-experience'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'App config name (e.g., "My Workspace Config")'
            },
            experience_sys_id: {
                type: 'string',
                description: 'Experience sys_id from Step 1'
            },
            description: {
                type: 'string',
                description: 'App configuration description'
            },
            list_config_id: {
                type: 'string',
                description: 'List menu configuration sys_id (optional)'
            }
        },
        required: ['name', 'experience_sys_id']
    }
};
async function execute(args, context) {
    const { name, experience_sys_id, description, list_config_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Validate experience exists
        const experienceCheck = await client.get(`/api/now/table/sys_ux_experience/${experience_sys_id}`);
        if (!experienceCheck.data.result) {
            throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.VALIDATION_ERROR, `Experience '${experience_sys_id}' not found`, { details: { experience_sys_id } });
        }
        // Create app config
        const appConfigData = {
            name,
            experience_assoc: experience_sys_id,
            description: description || `App configuration for ${name}`,
            active: true
        };
        if (list_config_id) {
            appConfigData.list_config_id = list_config_id;
        }
        const response = await client.post('/api/now/table/sys_ux_app_config', appConfigData);
        const appConfig = response.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            app_config_sys_id: appConfig.sys_id,
            name: appConfig.name,
            experience_sys_id,
            list_config_id: appConfig.list_config_id || null,
            message: `UX App Configuration '${name}' created successfully`,
            next_step: 'Create Page Macroponent (Step 3) using snow_create_ux_page_macroponent'
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError ? error : error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_ux_app_config.js.map