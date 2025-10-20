/**
 * snow_discover_automation_jobs - Discover automation jobs
 *
 * Discovers automation jobs (scheduled scripts, executions) in the instance.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_discover_automation_jobs.d.ts.map