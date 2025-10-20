/**
 * snow_ensure_active_update_set - Ensure active Update Set
 *
 * Ensures an Update Set is active and optionally syncs it as the user's
 * current Update Set in ServiceNow. Critical for change tracking.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_ensure_active_update_set.d.ts.map