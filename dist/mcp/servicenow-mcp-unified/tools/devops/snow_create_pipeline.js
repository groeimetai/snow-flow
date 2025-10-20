"use strict";
/**
 * snow_create_pipeline - Create DevOps pipeline
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_pipeline',
    description: 'Create CI/CD pipeline',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string' },
            source_control: { type: 'string' },
            stages: { type: 'array', items: { type: 'object' } }
        },
        required: ['name']
    }
};
async function execute(args, context) {
    const { name, source_control, stages = [] } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const pipelineData = { name };
        if (source_control)
            pipelineData.source_control = source_control;
        if (stages.length > 0)
            pipelineData.stages = JSON.stringify(stages);
        const response = await client.post('/api/now/table/cicd_pipeline', pipelineData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, pipeline: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_pipeline.js.map