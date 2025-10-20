/**
 * snow_cleanup_test_artifacts - Cleanup test data
 *
 * Safely cleanup test artifacts from ServiceNow (dry-run enabled by default).
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_cleanup_test_artifacts.d.ts.map