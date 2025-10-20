"use strict";
/**
 * snow_velocity_tracking - Velocity tracking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_velocity_tracking',
    description: 'Track team velocity and delivery metrics',
    inputSchema: {
        type: 'object',
        properties: {
            team: { type: 'string', description: 'Team name' },
            sprint: { type: 'string', description: 'Sprint identifier' },
            story_points: { type: 'number', description: 'Story points completed' },
            deployments: { type: 'number', description: 'Number of deployments' },
            lead_time: { type: 'number', description: 'Average lead time in hours' },
            mttr: { type: 'number', description: 'Mean time to recovery in minutes' }
        },
        required: ['team']
    }
};
async function execute(args, context) {
    const { team, sprint, story_points, deployments, lead_time, mttr } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const velocityData = { team };
        if (sprint)
            velocityData.sprint = sprint;
        if (story_points)
            velocityData.story_points = story_points;
        if (deployments)
            velocityData.deployments = deployments;
        if (lead_time)
            velocityData.lead_time = lead_time;
        if (mttr)
            velocityData.mttr = mttr;
        const response = await client.post('/api/now/table/sn_devops_velocity', velocityData);
        return (0, error_handler_js_1.createSuccessResult)({ tracked: true, velocity: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_velocity_tracking.js.map