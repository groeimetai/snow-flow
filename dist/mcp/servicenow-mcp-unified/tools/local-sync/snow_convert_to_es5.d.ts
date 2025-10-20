/**
 * snow_convert_to_es5 - Convert modern JavaScript to ES5
 *
 * Automatically convert ES6+ JavaScript to ES5 for ServiceNow Rhino engine.
 * Handles const/let, arrow functions, template literals, destructuring, etc.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_convert_to_es5.d.ts.map