/**
 * snow_create_ux_experience - Create UX experience
 *
 * STEP 1: Create UX Experience Record (sys_ux_experience) -
 * The top-level container for the workspace.
 * ⚠️ REQUIRES: Now Experience Framework (UXF) enabled.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_create_ux_experience.d.ts.map