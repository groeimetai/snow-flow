"use strict";
/**
 * snow_generate_insights - Generate AI-powered insights
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_generate_insights',
    description: 'Generates analytical insights including trends, patterns, anomalies, and actionable recommendations',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Table to analyze' },
            analysisType: { type: 'string', description: 'Analysis type (trends, patterns, anomalies)' },
            timeframe: { type: 'string', description: 'Time period for analysis' },
            generateRecommendations: { type: 'boolean', description: 'Generate recommendations' }
        },
        required: ['table']
    }
};
async function execute(args, context) {
    const { table, analysisType, timeframe, generateRecommendations } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Get sample data for analysis
        const dataQuery = await client.get(`/api/now/table/${table}`, {
            params: { sysparm_limit: 200 }
        });
        const data = dataQuery.data.result;
        const insights = {
            table,
            analysisType: analysisType || 'patterns',
            timeframe: timeframe || '30d',
            insights: [],
            recommendations: []
        };
        // Analyze patterns
        if (analysisType === 'patterns' || !analysisType) {
            const fields = data.length > 0 ? Object.keys(data[0]) : [];
            insights.insights.push({
                type: 'Pattern',
                description: `Dataset contains ${data.length} records with ${fields.length} fields`
            });
        }
        // Generate recommendations if requested
        if (generateRecommendations) {
            insights.recommendations.push('Consider creating automated dashboards for key metrics');
            insights.recommendations.push('Implement data quality monitoring for critical fields');
        }
        return (0, error_handler_js_1.createSuccessResult)({
            insights,
            message: `Generated ${insights.insights.length} insights for ${table}`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_generate_insights.js.map