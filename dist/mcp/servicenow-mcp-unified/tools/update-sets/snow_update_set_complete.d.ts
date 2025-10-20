/**
 * snow_update_set_complete - Complete Update Set
 *
 * Marks an Update Set as complete, preventing further changes.
 * Prepares the set for testing, review, and migration to other instances.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_update_set_complete.d.ts.map