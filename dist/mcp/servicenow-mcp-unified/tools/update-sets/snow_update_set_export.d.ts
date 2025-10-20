/**
 * snow_update_set_export - Export Update Set to XML
 *
 * Exports Update Set to XML format for backup, version control, or
 * manual migration between instances. Preserves all change records and metadata.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_update_set_export.d.ts.map