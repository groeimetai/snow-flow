/**
 * snow_create_workflow_activity - Create workflow activity
 *
 * Creates workflow activities within existing workflows. Configures
 * activity types, conditions, and execution order.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_create_workflow_activity.d.ts.map