/**
 * snow_create_knowledge_article - Create knowledge article
 *
 * Creates a knowledge article in ServiceNow Knowledge Base with full support for
 * knowledge base references, categories, metadata, and workflow states.
 */
import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
export declare const toolDefinition: MCPToolDefinition;
export declare function execute(args: any, context: ServiceNowContext): Promise<ToolResult>;
export declare const version = "1.0.0";
export declare const author = "Snow-Flow SDK Migration";
//# sourceMappingURL=snow_create_knowledge_article.d.ts.map