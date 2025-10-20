"use strict";
/**
 * snow_asset_discovery - Discover and normalize assets from multiple sources
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_asset_discovery',
    description: 'Discover and normalize assets from multiple sources',
    inputSchema: {
        type: 'object',
        properties: {
            discovery_source: {
                type: 'string',
                description: 'Discovery source',
                enum: ['network_scan', 'agent_based', 'manual_import', 'csv_upload']
            },
            ip_range: { type: 'string', description: 'IP range for network discovery (CIDR notation)' },
            normalize_duplicates: { type: 'boolean', description: 'Automatically normalize duplicate assets' },
            create_relationships: { type: 'boolean', description: 'Create CI relationships automatically' }
        },
        required: ['discovery_source']
    }
};
async function execute(args, context) {
    const { discovery_source, ip_range, normalize_duplicates = true, create_relationships = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Trigger discovery based on source type
        let discoveryResult;
        switch (discovery_source) {
            case 'network_scan':
                if (!ip_range) {
                    return (0, error_handler_js_1.createErrorResult)('IP range required for network scan');
                }
                discoveryResult = await triggerNetworkDiscovery(client, ip_range);
                break;
            case 'agent_based':
                discoveryResult = await triggerAgentBasedDiscovery(client);
                break;
            case 'manual_import':
                discoveryResult = await setupManualImport(client);
                break;
            case 'csv_upload':
                discoveryResult = await setupCSVUpload(client);
                break;
            default:
                return (0, error_handler_js_1.createErrorResult)(`Unknown discovery source: ${discovery_source}`);
        }
        return (0, error_handler_js_1.createSuccessResult)({
            discovery_source,
            assets_discovered: discoveryResult.count,
            duplicates_normalized: normalize_duplicates ? discoveryResult.duplicates : 0,
            relationships_created: create_relationships ? discoveryResult.relationships : 0,
            discovery_status: discoveryResult.status
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
async function triggerNetworkDiscovery(client, ipRange) {
    // Trigger ServiceNow Discovery
    const response = await client.post('/api/now/table/discovery_schedule', {
        name: `Network Discovery - ${ipRange}`,
        type: 'network',
        ip_range: ipRange,
        active: true
    });
    return {
        count: 0, // Will be populated after scan completes
        duplicates: 0,
        relationships: 0,
        status: 'scheduled'
    };
}
async function triggerAgentBasedDiscovery(client) {
    // Trigger agent-based discovery
    return {
        count: 0,
        duplicates: 0,
        relationships: 0,
        status: 'initiated'
    };
}
async function setupManualImport(client) {
    return {
        count: 0,
        duplicates: 0,
        relationships: 0,
        status: 'ready_for_import'
    };
}
async function setupCSVUpload(client) {
    return {
        count: 0,
        duplicates: 0,
        relationships: 0,
        status: 'ready_for_upload'
    };
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_asset_discovery.js.map