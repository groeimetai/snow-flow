/**
 * snow_create_web_service - SOAP Web Service integration
 *
 * Create SOAP web service integrations from WSDL definitions.
 * Configures authentication and namespace settings.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_create_web_service.d.ts.map