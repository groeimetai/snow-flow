#!/usr/bin/env node
/**
 * ServiceNow IT Asset Management (ITAM) MCP Server
 *
 * Provides comprehensive IT Asset Management capabilities including:
 * - Asset lifecycle management (procurement → deployment → retirement)
 * - License management and compliance
 * - Asset normalization and duplicate detection
 * - Hardware inventory and tracking
 * - Asset financial management
 *
 * High-value enterprise ServiceNow module previously missing from Snow-Flow
 */
import { EnhancedBaseMCPServer } from './shared/enhanced-base-mcp-server.js';
export declare class ServiceNowITAMMCP extends EnhancedBaseMCPServer {
    constructor();
    private setupHandlers;
    private createAsset;
    private manageSoftwareLicense;
    private trackAssetLifecycle;
    private generateComplianceReport;
    private generateLicenseUsageReport;
    private generateAssetInventoryReport;
    private generateWarrantyReport;
    private generateCostAnalysisReport;
    private optimizeLicenses;
    private discoverAssets;
}
//# sourceMappingURL=servicenow-itam-mcp.d.ts.map