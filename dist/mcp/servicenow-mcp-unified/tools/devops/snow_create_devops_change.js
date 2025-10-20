"use strict";
/**
 * snow_create_devops_change - Create DevOps change
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_devops_change',
    description: 'Create automated DevOps change request for deployments',
    inputSchema: {
        type: 'object',
        properties: {
            application: { type: 'string', description: 'Application to deploy' },
            version: { type: 'string', description: 'Version to deploy' },
            environment: { type: 'string', description: 'Target environment' },
            deployment_date: { type: 'string', description: 'Planned deployment date' },
            risk_assessment: { type: 'object', description: 'Risk assessment data' },
            rollback_plan: { type: 'string', description: 'Rollback procedure' }
        },
        required: ['application', 'version', 'environment', 'deployment_date']
    }
};
async function execute(args, context) {
    const { application, version, environment, deployment_date, risk_assessment, rollback_plan } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const changeData = {
            application,
            version,
            environment,
            deployment_date,
            type: 'standard',
            category: 'Software',
            short_description: `Deploy ${application} v${version} to ${environment}`
        };
        if (risk_assessment)
            changeData.risk_assessment = JSON.stringify(risk_assessment);
        if (rollback_plan)
            changeData.rollback_plan = rollback_plan;
        const response = await client.post('/api/now/table/change_request', changeData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, change: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_devops_change.js.map