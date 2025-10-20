/**
 * snow_export_artifact - Export ServiceNow artifacts
 *
 * Exports widgets, applications to JSON/XML format for backup or migration
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_export_artifact.d.ts.map