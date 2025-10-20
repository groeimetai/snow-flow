/**
 * snow_create_escalation_rule - Create escalation rule
 *
 * Creates escalation rules for time-based actions. Defines escalation
 * timing, conditions, and automated responses.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_create_escalation_rule.d.ts.map