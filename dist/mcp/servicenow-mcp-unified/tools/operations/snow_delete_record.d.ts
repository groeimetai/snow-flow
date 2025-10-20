/**
 * snow_delete_record - Safe record deletion
 *
 * Delete records with safety checks, dependency validation, and
 * optional soft delete capability.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_delete_record.d.ts.map