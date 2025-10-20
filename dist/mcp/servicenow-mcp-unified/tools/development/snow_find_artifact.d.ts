/**
 * snow_find_artifact - Find ServiceNow artifacts using natural language
 *
 * Searches cached memory first for performance, then queries ServiceNow directly if needed.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
//# sourceMappingURL=snow_find_artifact.d.ts.map