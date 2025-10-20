/**
 * snow_pull_artifact - Pull artifact to local files
 *
 * Pull ServiceNow artifacts to local files for editing with Claude Code
 * native tools. Enables powerful multi-file editing and search.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_pull_artifact.d.ts.map