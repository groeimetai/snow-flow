/**
 * snow_batch_api - Batch API operations (80% API reduction)
 *
 * Execute multiple API operations in a single request using ServiceNow's
 * Batch API, dramatically reducing network overhead and improving performance.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_batch_api.d.ts.map