/**
 * snow_create_atf_test - Create Automated Test Framework test
 *
 * Creates an ATF test for automated testing of ServiceNow applications.
 * Uses sys_atf_test table.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_create_atf_test.d.ts.map