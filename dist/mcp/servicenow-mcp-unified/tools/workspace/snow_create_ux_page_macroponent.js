"use strict";
/**
 * snow_create_ux_page_macroponent - Create page macroponent
 *
 * STEP 3: Create Page Macroponent Record (sys_ux_macroponent) -
 * Defines the actual page content that will be displayed.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_ux_page_macroponent',
    description: 'STEP 3: Create Page Macroponent Record (sys_ux_macroponent) - Defines the actual page content that will be displayed.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'ui-frameworks',
    subcategory: 'workspace',
    use_cases: ['workspace', 'page', 'macroponent'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Page macroponent name (e.g., "My Home Page")'
            },
            root_component: {
                type: 'string',
                default: 'sn-canvas-panel',
                description: 'Root component to render (default: sn-canvas-panel for simple pages)'
            },
            composition: {
                type: 'object',
                description: 'JSON layout configuration (default: simple single column)'
            },
            description: {
                type: 'string',
                description: 'Page macroponent description'
            }
        },
        required: ['name']
    }
};
async function execute(args, context) {
    const { name, root_component = 'sn-canvas-panel', composition, description } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Default simple composition if not provided
        const defaultComposition = {
            layout: 'single-column',
            components: []
        };
        // Create macroponent
        const macroponentData = {
            name,
            root_component,
            composition: JSON.stringify(composition || defaultComposition),
            description: description || `Page macroponent: ${name}`,
            active: true
        };
        const response = await client.post('/api/now/table/sys_ux_macroponent', macroponentData);
        const macroponent = response.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            macroponent_sys_id: macroponent.sys_id,
            name: macroponent.name,
            root_component: macroponent.root_component,
            message: `Page Macroponent '${name}' created successfully`,
            next_step: 'Create Page Registry (Step 4) using snow_create_ux_page_registry'
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError ? error : error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_ux_page_macroponent.js.map