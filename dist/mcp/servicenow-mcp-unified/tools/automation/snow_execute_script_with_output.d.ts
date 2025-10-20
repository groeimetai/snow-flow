/**
 * snow_execute_script_with_output - Execute background scripts
 *
 * Execute server-side JavaScript in ServiceNow background scripts with
 * full output capture (gs.print, gs.info, gs.warn, gs.error).
 *
 * ⚠️ CRITICAL: ALL SCRIPTS MUST BE ES5 ONLY!
 * ServiceNow runs on Rhino engine - no const/let/arrow functions/template literals.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_execute_script_with_output.d.ts.map