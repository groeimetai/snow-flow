"use strict";
/**
 * snow_asset_compliance_report - Generate comprehensive asset compliance reports for auditing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_asset_compliance_report',
    description: 'Generate comprehensive asset compliance reports for auditing',
    // Metadata for tool discovery (not sent to LLM)
    category: 'asset-management',
    subcategory: 'reporting',
    use_cases: ['compliance', 'reporting', 'auditing'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            report_type: {
                type: 'string',
                description: 'Type of compliance report',
                enum: ['license_usage', 'asset_inventory', 'warranty_expiration', 'cost_analysis']
            },
            date_range: {
                type: 'string',
                description: 'Report date range',
                enum: ['30_days', '90_days', '1_year', 'all_time']
            },
            include_details: { type: 'boolean', description: 'Include detailed breakdown' },
            export_format: {
                type: 'string',
                description: 'Export format',
                enum: ['json', 'csv', 'pdf']
            }
        },
        required: ['report_type']
    }
};
async function execute(args, context) {
    const { report_type, date_range = '90_days', include_details = false, export_format = 'json' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Date range calculation
        const dateRangeMap = {
            '30_days': 30,
            '90_days': 90,
            '1_year': 365,
            'all_time': null
        };
        const days = dateRangeMap[date_range];
        let query = '';
        if (days) {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            query = `sys_created_on>=${startDate.toISOString()}`;
        }
        let reportData;
        let summary = '';
        switch (report_type) {
            case 'license_usage':
                reportData = await client.get(`/api/now/table/alm_license?sysparm_query=${query}`);
                summary = generateLicenseUsageReport(reportData.data.result, include_details);
                break;
            case 'asset_inventory':
                reportData = await client.get(`/api/now/table/alm_asset?sysparm_query=${query}`);
                summary = generateAssetInventoryReport(reportData.data.result, include_details);
                break;
            case 'warranty_expiration':
                const warrantyQuery = `warranty_expiration>=javascript:gs.daysAgoStart(0)^warranty_expiration<=javascript:gs.daysAgoStart(-90)${query ? '^' + query : ''}`;
                reportData = await client.get(`/api/now/table/alm_asset?sysparm_query=${warrantyQuery}`);
                summary = generateWarrantyReport(reportData.data.result, include_details);
                break;
            case 'cost_analysis':
                reportData = await client.get(`/api/now/table/alm_asset?sysparm_query=${query}`);
                summary = generateCostAnalysisReport(reportData.data.result, include_details);
                break;
            default:
                return (0, error_handler_js_1.createErrorResult)(`Unknown report type: ${report_type}`);
        }
        return (0, error_handler_js_1.createSuccessResult)({
            report_type,
            date_range,
            summary,
            export_format,
            generated_at: new Date().toISOString(),
            record_count: reportData.data.result.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
function generateLicenseUsageReport(licenses, includeDetails) {
    const totalLicenses = licenses.length;
    const totalCost = licenses.reduce((sum, lic) => sum + (parseFloat(lic.cost) || 0), 0);
    let report = `Total Licenses: ${totalLicenses}\n`;
    report += `Total Annual Cost: $${totalCost.toLocaleString()}\n`;
    if (includeDetails && licenses.length > 0) {
        report += '\nLicense Details:\n';
        licenses.slice(0, 10).forEach(lic => {
            report += `- ${lic.display_name}: ${lic.license_count} licenses\n`;
        });
    }
    return report;
}
function generateAssetInventoryReport(assets, includeDetails) {
    const totalAssets = assets.length;
    const byState = assets.reduce((acc, asset) => {
        acc[asset.state || 'unknown'] = (acc[asset.state || 'unknown'] || 0) + 1;
        return acc;
    }, {});
    let report = `Total Assets: ${totalAssets}\n`;
    report += 'Assets by State:\n';
    Object.entries(byState).forEach(([state, count]) => {
        report += `- ${state}: ${count}\n`;
    });
    return report;
}
function generateWarrantyReport(assets, includeDetails) {
    return `Assets with expiring warranties: ${assets.length}\n` +
        'Recommend planning for replacements or warranty extensions.';
}
function generateCostAnalysisReport(assets, includeDetails) {
    const totalValue = assets.reduce((sum, asset) => sum + (parseFloat(asset.cost) || 0), 0);
    const avgCost = assets.length > 0 ? totalValue / assets.length : 0;
    return `Total Portfolio Value: $${totalValue.toLocaleString()}\n` +
        `Average Asset Cost: $${avgCost.toLocaleString()}\n` +
        `Assets Analyzed: ${assets.length}`;
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_asset_compliance_report.js.map