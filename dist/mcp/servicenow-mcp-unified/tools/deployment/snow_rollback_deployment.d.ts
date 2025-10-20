/**
 * snow_rollback_deployment - Safe deployment rollback
 *
 * Rollback failed deployments by reverting to previous version
 * or deleting newly created artifacts.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_rollback_deployment.d.ts.map