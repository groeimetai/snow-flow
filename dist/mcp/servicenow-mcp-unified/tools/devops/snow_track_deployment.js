"use strict";
/**
 * snow_track_deployment - Track deployment
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_track_deployment',
    description: 'Track application deployment through DevOps pipeline',
    inputSchema: {
        type: 'object',
        properties: {
            application: { type: 'string', description: 'Application name' },
            version: { type: 'string', description: 'Version being deployed' },
            environment: { type: 'string', description: 'Target environment' },
            pipeline: { type: 'string', description: 'Pipeline used' },
            change_request: { type: 'string', description: 'Associated change request' },
            status: { type: 'string', description: 'Deployment status' },
            start_time: { type: 'string', description: 'Deployment start time' }
        },
        required: ['application', 'version', 'environment']
    }
};
async function execute(args, context) {
    const { application, version, environment, pipeline, change_request, status, start_time } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const deploymentData = {
            application,
            version,
            environment,
            status: status || 'in_progress',
            start_time: start_time || new Date().toISOString()
        };
        if (pipeline)
            deploymentData.pipeline = pipeline;
        if (change_request)
            deploymentData.change_request = change_request;
        const response = await client.post('/api/now/table/sn_devops_deployment', deploymentData);
        return (0, error_handler_js_1.createSuccessResult)({ tracked: true, deployment: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_track_deployment.js.map