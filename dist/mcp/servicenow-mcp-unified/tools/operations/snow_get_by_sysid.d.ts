/**
 * snow_get_by_sysid - Get artifact by sys_id
 *
 * Retrieve any ServiceNow record by its sys_id with optional
 * field selection and display values.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_get_by_sysid.d.ts.map