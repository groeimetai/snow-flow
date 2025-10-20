/**
 * snow_update_set_switch - Switch active Update Set
 *
 * Switches the active Update Set context to an existing set.
 * Ensures all subsequent changes are tracked in the specified Update Set.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_update_set_switch.d.ts.map