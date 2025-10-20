/**
 * snow_get_atf_results - Get ATF test results
 *
 * Retrieves ATF test execution results including pass/fail status,
 * error details, and execution time from sys_atf_test_result table.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_get_atf_results.d.ts.map