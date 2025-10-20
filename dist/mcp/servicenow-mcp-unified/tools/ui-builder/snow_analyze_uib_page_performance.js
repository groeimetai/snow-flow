"use strict";
/**
 * snow_analyze_uib_page_performance - Performance analysis
 *
 * Analyzes UI Builder page performance including load times,
 * component efficiency, and optimization recommendations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_analyze_uib_page_performance',
    description: 'Analyze UI Builder page performance and get optimization recommendations',
    inputSchema: {
        type: 'object',
        properties: {
            page_id: {
                type: 'string',
                description: 'Page sys_id to analyze'
            },
            include_components: {
                type: 'boolean',
                description: 'Include component-level performance analysis',
                default: true
            },
            include_data_broker_stats: {
                type: 'boolean',
                description: 'Include data broker performance metrics',
                default: true
            },
            include_client_scripts: {
                type: 'boolean',
                description: 'Include client script performance',
                default: true
            },
            time_period_days: {
                type: 'number',
                description: 'Analysis period in days',
                default: 30
            },
            detailed_analysis: {
                type: 'boolean',
                description: 'Generate detailed performance report',
                default: false
            }
        },
        required: ['page_id']
    }
};
async function execute(args, context) {
    const { page_id, include_components = true, include_data_broker_stats = true, include_client_scripts = true, time_period_days = 30, detailed_analysis = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Get page details
        const pageResponse = await client.get(`/api/now/table/sys_ux_page/${page_id}`);
        const page = pageResponse.data.result;
        // Get page elements
        let elements = [];
        if (include_components) {
            const elementsResponse = await client.get('/api/now/table/sys_ux_page_element', {
                params: { sysparm_query: `page=${page_id}` }
            });
            elements = elementsResponse.data.result;
        }
        // Get data brokers
        let dataBrokers = [];
        if (include_data_broker_stats) {
            const brokersResponse = await client.get('/api/now/table/sys_ux_data_broker', {
                params: { sysparm_query: `page=${page_id}` }
            });
            dataBrokers = brokersResponse.data.result;
        }
        // Get client scripts
        let clientScripts = [];
        if (include_client_scripts) {
            const scriptsResponse = await client.get('/api/now/table/sys_ux_client_script', {
                params: { sysparm_query: `page=${page_id}` }
            });
            clientScripts = scriptsResponse.data.result;
        }
        // Build performance analysis
        const analysis = {
            page: {
                sys_id: page.sys_id,
                name: page.name,
                title: page.title
            },
            metrics: {
                total_components: elements.length,
                total_data_brokers: dataBrokers.length,
                total_client_scripts: clientScripts.length,
                estimated_load_time_ms: elements.length * 50 + dataBrokers.length * 100
            },
            recommendations: []
        };
        // Generate recommendations
        if (elements.length > 20) {
            analysis.recommendations.push('Consider reducing number of components (current: ' + elements.length + ')');
        }
        if (dataBrokers.length > 5) {
            analysis.recommendations.push('Multiple data brokers detected - consider consolidation');
        }
        if (clientScripts.length > 3) {
            analysis.recommendations.push('Consider consolidating client scripts for better performance');
        }
        if (detailed_analysis) {
            analysis.detailed = {
                components: elements.map((el) => ({
                    sys_id: el.sys_id,
                    component: el.component,
                    position: el.position
                })),
                data_brokers: dataBrokers.map((db) => ({
                    sys_id: db.sys_id,
                    name: db.name
                })),
                client_scripts: clientScripts.map((cs) => ({
                    sys_id: cs.sys_id,
                    name: cs.name
                }))
            };
        }
        return (0, error_handler_js_1.createSuccessResult)(analysis);
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_analyze_uib_page_performance.js.map