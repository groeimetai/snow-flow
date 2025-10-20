/**
 * snow_list_supported_artifacts - List supported artifact types for local sync
 *
 * Returns comprehensive list of ServiceNow artifact types that can be pulled/pushed via local sync.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_list_supported_artifacts.d.ts.map