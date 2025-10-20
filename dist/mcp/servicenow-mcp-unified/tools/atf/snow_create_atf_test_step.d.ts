/**
 * snow_create_atf_test_step - Add test step to ATF test
 *
 * Adds a test step to an existing ATF test. Steps define the actions
 * and assertions for testing using the sys_atf_step table.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_create_atf_test_step.d.ts.map