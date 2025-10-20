/**
 * snow_trace_execution - Trace execution flow
 *
 * Traces execution flow with real-time tracking of scripts, REST calls, and errors.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_trace_execution.d.ts.map