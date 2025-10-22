"use strict";
/**
 * snow_run_discovery - Trigger CMDB discovery
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_run_discovery',
    description: 'Trigger CMDB discovery scan',
    // Metadata for tool discovery (not sent to LLM)
    category: 'cmdb',
    subcategory: 'discovery',
    use_cases: ['cmdb', 'discovery', 'scanning'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            discovery_schedule: { type: 'string', description: 'Discovery schedule sys_id' },
            target_ip: { type: 'string', description: 'Target IP or range' },
            mid_server: { type: 'string', description: 'MID Server to use' }
        },
        required: ['discovery_schedule']
    }
};
async function execute(args, context) {
    const { discovery_schedule, target_ip, mid_server } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const discData = { schedule: discovery_schedule };
        if (target_ip)
            discData.ip_address = target_ip;
        if (mid_server)
            discData.mid_server = mid_server;
        const response = await client.post('/api/now/table/discovery_schedule_item', discData);
        return (0, error_handler_js_1.createSuccessResult)({ triggered: true, discovery: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_run_discovery.js.map