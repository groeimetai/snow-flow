"use strict";
/**
 * snow_collect_metric
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_collect_metric',
    description: 'Collect metric data',
    // Metadata for tool discovery (not sent to LLM)
    category: 'automation',
    subcategory: 'monitoring',
    use_cases: ['metrics', 'data-collection', 'monitoring'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            metric_sys_id: { type: 'string', description: 'Metric definition sys_id' }
        },
        required: ['metric_sys_id']
    }
};
async function execute(args, context) {
    const { metric_sys_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const collectScript = `
var metric = new GlideRecord('metric_definition');
if (metric.get('${metric_sys_id}')) {
  var collector = new MetricBaseCollector();
  collector.collect(metric);
  gs.info('Metric collected: ' + metric.name);
}
    `;
        await client.post('/api/now/table/sys_script_execution', { script: collectScript });
        return (0, error_handler_js_1.createSuccessResult)({ collected: true, metric: metric_sys_id });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_collect_metric.js.map