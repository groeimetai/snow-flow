"use strict";
/**
 * snow_create_project
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_project',
    description: 'Create project',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'project-management',
    use_cases: ['project-management', 'ppm', 'project-creation'],
    complexity: 'intermediate',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            start_date: { type: 'string' },
            end_date: { type: 'string' },
            project_manager: { type: 'string' }
        },
        required: ['name']
    }
};
async function execute(args, context) {
    const { name, description, start_date, end_date, project_manager } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const projectData = { name, description };
        if (start_date)
            projectData.start_date = start_date;
        if (end_date)
            projectData.end_date = end_date;
        if (project_manager)
            projectData.project_manager = project_manager;
        const response = await client.post('/api/now/table/pm_project', projectData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, project: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_project.js.map