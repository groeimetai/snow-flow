/**
 * snow_push_artifact - Push local changes back to ServiceNow
 *
 * Push locally edited artifact files back to ServiceNow with
 * validation and coherence checking.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_push_artifact.d.ts.map