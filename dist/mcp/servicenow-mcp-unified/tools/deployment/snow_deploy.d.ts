/**
 * snow_deploy - Deploy ServiceNow artifacts with validation
 *
 * Deploys widgets, pages, flows, and other artifacts to ServiceNow
 * with automatic ES5 validation, coherence checking, and Update Set management.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_deploy.d.ts.map