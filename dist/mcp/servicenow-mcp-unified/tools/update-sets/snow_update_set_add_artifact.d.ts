/**
 * snow_update_set_add_artifact - Add artifact to Update Set
 *
 * Registers an artifact (widget, flow, script) in the active Update Set
 * for tracking. Maintains comprehensive change history for deployments.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_update_set_add_artifact.d.ts.map