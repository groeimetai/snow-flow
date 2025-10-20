/**
 * snow_auto_resolve_incident - Auto-resolve incidents
 *
 * Attempts automated resolution of technical incidents based on known patterns and previous solutions.
 * Includes dry-run mode for safety.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_auto_resolve_incident.d.ts.map