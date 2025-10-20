/**
 * snow_validate_sysid - Validate sys_id existence and consistency
 *
 * Validates sys_id existence across tables and maintains artifact tracking
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_validate_sysid.d.ts.map