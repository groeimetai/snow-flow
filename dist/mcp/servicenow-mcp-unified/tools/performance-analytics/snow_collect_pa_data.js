"use strict";
/**
 * snow_collect_pa_data - Collect PA data manually
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_collect_pa_data',
    description: 'Manually triggers Performance Analytics data collection for specific indicators',
    inputSchema: {
        type: 'object',
        properties: {
            indicator: { type: 'string', description: 'Indicator to collect data for' },
            start_date: { type: 'string', description: 'Collection start date' },
            end_date: { type: 'string', description: 'Collection end date' },
            recalculate: { type: 'boolean', description: 'Recalculate existing data', default: false }
        },
        required: ['indicator']
    }
};
async function execute(args, context) {
    const { indicator, start_date, end_date, recalculate } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const jobData = {
            indicator,
            status: 'pending',
            recalculate: recalculate || false
        };
        if (start_date)
            jobData.start_date = start_date;
        if (end_date)
            jobData.end_date = end_date;
        const response = await client.post('/api/now/table/pa_collection_jobs', jobData);
        return (0, error_handler_js_1.createSuccessResult)({
            collected: true,
            job: response.data.result,
            message: `PA data collection initiated for indicator ${indicator}`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_collect_pa_data.js.map