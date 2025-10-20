/**
 * snow_update_set_preview - Preview Update Set changes
 *
 * Generates a detailed preview of all changes contained in an Update Set.
 * Shows modified tables, fields, and potential deployment impacts.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_update_set_preview.d.ts.map