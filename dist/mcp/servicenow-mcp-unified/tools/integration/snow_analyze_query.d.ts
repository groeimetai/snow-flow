/**
 * snow_analyze_query - Query optimization and analysis
 *
 * Analyze ServiceNow queries for performance bottlenecks, suggest
 * optimizations, and provide index recommendations.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_analyze_query.d.ts.map