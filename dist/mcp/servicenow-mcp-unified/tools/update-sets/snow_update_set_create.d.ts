/**
 * snow_update_set_create - Create new Update Set
 *
 * Creates a new Update Set for tracking changes. Essential for ServiceNow
 * change management and deployment tracking.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_update_set_create.d.ts.map