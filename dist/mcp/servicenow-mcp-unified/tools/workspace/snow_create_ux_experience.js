"use strict";
/**
 * snow_create_ux_experience - Create UX experience
 *
 * STEP 1: Create UX Experience Record (sys_ux_experience) -
 * The top-level container for the workspace.
 * ⚠️ REQUIRES: Now Experience Framework (UXF) enabled.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_ux_experience',
    description: 'STEP 1: Create UX Experience Record (sys_ux_experience) - The top-level container for the workspace. ⚠️ REQUIRES: Now Experience Framework (UXF) enabled. ALTERNATIVE: Use traditional form/list configurations if UXF unavailable.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'ui-frameworks',
    subcategory: 'workspace',
    use_cases: ['workspace', 'ux-experience', 'foundation'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Experience name (e.g., "My Workspace")'
            },
            root_macroponent: {
                type: 'string',
                description: 'Root macroponent sys_id (usually x_snc_app_shell_uib_app_shell, auto-detected if not provided)'
            },
            description: {
                type: 'string',
                description: 'Experience description'
            }
        },
        required: ['name']
    }
};
async function execute(args, context) {
    const { name, root_macroponent, description } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Create experience
        const experienceData = {
            name,
            description: description || `UX Experience: ${name}`,
            active: true
        };
        if (root_macroponent) {
            experienceData.root_macroponent = root_macroponent;
        }
        const response = await client.post('/api/now/table/sys_ux_experience', experienceData);
        const experience = response.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            experience_sys_id: experience.sys_id,
            name: experience.name,
            root_macroponent: experience.root_macroponent || null,
            message: `UX Experience '${name}' created successfully`,
            next_step: 'Create App Configuration (Step 2) using snow_create_ux_app_config',
            note: 'This experience requires Now Experience Framework (UXF) to be enabled'
        });
    }
    catch (error) {
        // Check if error is due to missing UXF plugin
        if (error.message && error.message.includes('sys_ux_experience')) {
            return (0, error_handler_js_1.createErrorResult)(new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.PLUGIN_MISSING, 'Now Experience Framework (UXF) plugin not installed or enabled', {
                details: {
                    plugin: 'com.snc.now_experience',
                    suggestion: 'Install Now Experience Framework from ServiceNow Store or use traditional form/list configurations',
                    alternative: 'Use Service Portal pages or traditional UI pages instead'
                }
            }));
        }
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError ? error : error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_ux_experience.js.map