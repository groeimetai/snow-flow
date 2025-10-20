/**
 * snow_execute_atf_test - Execute ATF test or suite
 *
 * Executes an ATF test or test suite and returns the results.
 * Tests run asynchronously in ServiceNow using sys_atf_test_result table.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_execute_atf_test.d.ts.map