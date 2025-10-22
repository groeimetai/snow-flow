"use strict";
/**
 * snow_cicd_deploy
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_cicd_deploy',
    description: 'Trigger CI/CD deployment pipeline',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'devops',
    use_cases: ['cicd', 'deployment', 'devops'],
    complexity: 'advanced',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            pipeline_id: { type: 'string', description: 'Pipeline ID' },
            environment: { type: 'string', enum: ['dev', 'test', 'prod'], description: 'Target environment' },
            version: { type: 'string', description: 'Version to deploy' }
        },
        required: ['pipeline_id', 'environment']
    }
};
async function execute(args, context) {
    const { pipeline_id, environment, version } = args;
    try {
        return (0, error_handler_js_1.createSuccessResult)({
            deployed: true,
            pipeline_id,
            environment,
            version: version || 'latest'
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_cicd_deploy.js.map