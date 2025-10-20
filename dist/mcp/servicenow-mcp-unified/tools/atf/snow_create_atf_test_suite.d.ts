/**
 * snow_create_atf_test_suite - Create ATF test suite
 *
 * Creates an ATF test suite to group and run multiple tests together
 * using sys_atf_test_suite table.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_create_atf_test_suite.d.ts.map