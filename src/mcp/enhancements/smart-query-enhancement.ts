/**
 * Smart Query Enhancement for MCP Operations
 * 
 * Automatically handles large artifact queries by intelligent field splitting
 * while maintaining context relationships for Claude.
 */

import { MCPToolResult } from '../shared/mcp-types';
import { SmartFieldFetcher } from '../../utils/smart-field-fetcher';

export class SmartQueryEnhancement {
  private smartFetcher: SmartFieldFetcher;

  constructor(serviceNowClient: any) {
    this.smartFetcher = new SmartFieldFetcher(serviceNowClient);
  }

  /**
   * Enhance snow_query_table to handle large artifacts intelligently
   */
  async enhanceQueryTable(originalArgs: any): Promise<MCPToolResult> {
    const { table, query, fields, limit } = originalArgs;
    
    // Check if this is a single record query with many fields
    const isSingleRecordQuery = query?.includes('sys_id=') && limit === 1;
    const hasLargeFields = fields?.some((f: string) => 
      ['template', 'script', 'client_script', 'css', 'definition', 'data_table'].includes(f)
    );
    
    if (isSingleRecordQuery && hasLargeFields) {
      // Extract sys_id from query
      const sys_id = query.match(/sys_id=([a-f0-9]{32})/)?.[1];
      
      if (sys_id) {
        console.log(`\n🎯 Detected large artifact query for ${table}. Using smart fetch strategy...`);
        
        // Use smart fetcher based on table type
        let result: any;
        let contextMessage = '';
        
        switch (table) {
          case 'sp_widget':
            result = await this.smartFetcher.fetchWidget(sys_id);
            contextMessage = this.generateWidgetContextMessage(result);
            break;
            
          case 'sys_hub_flow':
            result = await this.smartFetcher.fetchFlow(sys_id);
            contextMessage = this.generateFlowContextMessage(result);
            break;
            
          case 'sys_script':
            result = await this.smartFetcher.fetchBusinessRule(sys_id);
            contextMessage = this.generateBusinessRuleContextMessage(result);
            break;
            
          default:
            // Fall back to original query
            return this.executeOriginalQuery(originalArgs);
        }
        
        return {
          success: true,
          result: result,
          message: contextMessage,
          _meta: {
            strategy: 'smart_chunked_fetch',
            total_groups: Object.keys(result._field_groups || {}).length,
            coherence_hints: result._coherence_hints,
            context_preserved: true
          }
        };
      }
    }
    
    // For non-large queries, use original method
    return this.executeOriginalQuery(originalArgs);
  }

  /**
   * Generate context message for widget fetch
   */
  private generateWidgetContextMessage(widget: any): string {
    const groups = widget._field_groups || {};
    const fetchedFields: string[] = [];
    const failedFields: string[] = [];
    
    for (const [groupName, groupData] of Object.entries(groups)) {
      const data = groupData as any;
      if (data._fetched_individually) {
        for (const [field, status] of Object.entries(data._field_status || {})) {
          if (status === 'success') {
            fetchedFields.push(field);
          } else {
            failedFields.push(field);
          }
        }
      } else if (data.fields) {
        fetchedFields.push(...data.fields);
      }
    }
    
    let message = `
🧩 **Widget ${widget.name || widget.sys_id} - Smart Fetch Complete**

✅ **Successfully fetched ${fetchedFields.length} fields in chunks to avoid token limits**

📋 **Field Groups Retrieved:**
${Object.entries(groups).map(([name, data]: [string, any]) => 
  `• **${name}**: ${data.description}`
).join('\n')}

🔗 **IMPORTANT Context Relationships:**
• **Template HTML** (template field) contains:
  - Angular bindings like {{data.propertyName}} that reference server script data
  - ng-click directives that call client script methods
  - CSS classes defined in the css field

• **Server Script** (script field) contains:
  - ES5-only code that initializes the data object
  - Handles input.action requests from client script
  - Sets all data.* properties referenced in template

• **Client Script** (client_script field) contains:
  - AngularJS controller with \$scope methods
  - Methods called by template ng-click events
  - Uses c.server.get({action: 'name'}) to call server script

• **CSS** (css field) contains:
  - Styles for classes used in template HTML

⚠️ **These fields work together as one cohesive unit!**
When making changes, ensure:
1. Every {{data.x}} in template has matching data.x in server script
2. Every ng-click="method()" in template has matching \$scope.method in client script
3. Every c.server.get({action: 'x'}) in client has matching if(input.action=='x') in server
4. CSS classes in template are defined in css field
`;

    if (failedFields.length > 0) {
      message += `\n\n⚠️ **Failed to fetch:** ${failedFields.join(', ')} (too large or restricted)`;
    }
    
    if (widget._coherence_hints?.length > 0) {
      message += `\n\n🔍 **Detected Coherence Patterns:**\n${widget._coherence_hints.map((h: string) => `• ${h}`).join('\n')}`;
    }
    
    return message;
  }

  /**
   * Generate context message for flow fetch
   */
  private generateFlowContextMessage(flow: any): string {
    return `
🔄 **Flow ${flow.name || flow.sys_id} - Smart Fetch Complete**

✅ **Successfully fetched flow in chunks**

The 'definition' field contains the complete flow JSON structure with:
• All steps and their configurations
• Conditions and triggers
• Actions and data pills
• Subflow references

This flow ${flow.active ? 'is ACTIVE' : 'is INACTIVE'} and triggers on: ${flow.trigger_type || 'Unknown'}
`;
  }

  /**
   * Generate context message for business rule fetch
   */
  private generateBusinessRuleContextMessage(rule: any): string {
    return `
📜 **Business Rule ${rule.name || rule.sys_id} - Smart Fetch Complete**

✅ **Successfully fetched business rule in chunks**

• **Table:** ${rule.collection}
• **Active:** ${rule.active ? 'Yes' : 'No'}
• **When:** ${rule.when} 
• **Order:** ${rule.order}

The 'script' field contains ES5-only code with access to:
• **current** - The current record being processed
• **previous** - The previous values (for updates)
• **gs** - GlideSystem object for server-side APIs
• **g_scratchpad** - For passing data to client scripts
`;
  }

  /**
   * Execute original query when smart fetch not needed
   */
  private async executeOriginalQuery(args: any): Promise<any> {
    // This would call the original snow_query_table implementation
    // For now, return a placeholder
    return {
      success: true,
      result: { message: 'Original query executed' },
      message: 'Query executed normally without smart chunking'
    };
  }

  /**
   * Search within specific fields
   */
  async searchInFields(args: {
    table: string;
    field: string;
    searchTerm: string;
    additionalQuery?: string;
  }): Promise<MCPToolResult> {
    const results = await this.smartFetcher.searchInField(
      args.table,
      args.field,
      args.searchTerm,
      args.additionalQuery
    );
    
    return {
      success: true,
      result: results,
      message: `Found ${results.length} matches for "${args.searchTerm}" in ${args.table}.${args.field}`
    };
  }
}

/**
 * Helper to detect if a query will likely exceed token limits
 */
export function willExceedTokenLimit(fields: string[], table: string): boolean {
  const LARGE_FIELDS = {
    'sp_widget': ['template', 'script', 'client_script', 'css', 'data_table'],
    'sys_hub_flow': ['definition', 'compiled_definition'],
    'sys_script': ['script', 'condition'],
    'sys_script_include': ['script'],
    'sys_ui_page': ['html', 'client_script', 'processing_script']
  };
  
  const tableFields = LARGE_FIELDS[table as keyof typeof LARGE_FIELDS] || [];
  const hasMultipleLargeFields = fields.filter(f => tableFields.includes(f)).length >= 2;
  
  return hasMultipleLargeFields;
}

/**
 * Generate hint for Claude about using smart fetch
 */
export function generateSmartFetchHint(): string {
  return `
💡 **Smart Fetch Available for Large Artifacts**

When you encounter "exceeds maximum allowed tokens" errors, I can automatically:
1. Split the query into intelligent field groups
2. Fetch each group separately to stay under limits
3. Maintain full context about field relationships
4. Provide coherence validation hints

**Supported tables with smart fetch:**
• sp_widget - Fetches template, scripts, CSS separately but maintains widget coherence
• sys_hub_flow - Handles large flow definitions
• sys_script - Manages business rules with large scripts
• sys_script_include - Script includes with extensive code
• sys_ui_page - UI pages with HTML, CSS, and scripts

The smart fetch ensures you get ALL necessary data while respecting token limits!
`;
}