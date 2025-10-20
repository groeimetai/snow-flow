/**
 * snow_create_uib_data_broker - Create data brokers
 *
 * Creates UI Builder data brokers for connecting pages to ServiceNow
 * data sources using official sys_ux_data_broker API.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_create_uib_data_broker.d.ts.map