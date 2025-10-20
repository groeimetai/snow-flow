/**
 * snow_query_table - Universal table querying
 *
 * Query any ServiceNow table with pagination, filtering, and field selection.
 * The most frequently used tool in Snow-Flow.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_query_table.d.ts.map