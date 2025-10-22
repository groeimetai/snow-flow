"use strict";
/**
 * snow_create_devops_pipeline - Create DevOps pipeline
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_devops_pipeline',
    description: 'Create DevOps pipeline for CI/CD automation',
    // Metadata for tool discovery (not sent to LLM)
    category: 'advanced',
    subcategory: 'specialized',
    use_cases: ['devops'],
    complexity: 'intermediate',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Pipeline name' },
            repository: { type: 'string', description: 'Source repository' },
            branch: { type: 'string', description: 'Branch to build' },
            stages: { type: 'array', items: { type: 'object' }, description: 'Pipeline stages' },
            triggers: { type: 'array', items: { type: 'string' }, description: 'Pipeline triggers' },
            environment: { type: 'string', description: 'Target environment' }
        },
        required: ['name', 'repository', 'branch']
    }
};
async function execute(args, context) {
    const { name, repository, branch, stages, triggers, environment } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const pipelineData = { name, repository, branch };
        if (stages)
            pipelineData.stages = JSON.stringify(stages);
        if (triggers)
            pipelineData.triggers = triggers.join(',');
        if (environment)
            pipelineData.environment = environment;
        const response = await client.post('/api/now/table/sn_devops_pipeline', pipelineData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, pipeline: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_devops_pipeline.js.map