/**
 * snow_discover_data_sources - Data source discovery
 *
 * Discover available data sources for integration. Identifies import sets,
 * REST endpoints, and external databases.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_discover_data_sources.d.ts.map