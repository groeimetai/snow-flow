/**
 * MCP Prompt Manager
 * Comprehensive prompt management for MCP servers
 * Implements MCP prompts protocol for reusable prompt templates and workflows
 */

import { Logger } from '../utils/logger.js';

/**
 * Prompt argument definition
 */
export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * Prompt definition
 */
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
}

/**
 * Prompt message content types
 */
export interface MCPPromptTextContent {
  type: 'text';
  text: string;
}

export interface MCPPromptImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

export interface MCPPromptResourceContent {
  type: 'resource';
  resource: {
    uri: string;
    text?: string;
    blob?: string;
    mimeType?: string;
  };
}

export type MCPPromptContent = MCPPromptTextContent | MCPPromptImageContent | MCPPromptResourceContent;

/**
 * Prompt message (role + content)
 */
export interface MCPPromptMessage {
  role: 'user' | 'assistant';
  content: MCPPromptContent;
}

/**
 * Result from getting a prompt
 */
export interface MCPPromptResult {
  description?: string;
  messages: MCPPromptMessage[];
}

/**
 * Prompt category for organization
 */
export interface PromptCategory {
  name: string;
  description: string;
  prompts: MCPPrompt[];
}

/**
 * Prompt handler function type
 */
export type PromptHandler = (args: Record<string, string>) => Promise<MCPPromptResult>;

/**
 * MCP Prompt Manager
 * Manages prompt templates, registration, and execution
 */
export class MCPPromptManager {
  private logger: Logger;
  private promptRegistry: Map<string, MCPPrompt> = new Map();
  private promptHandlers: Map<string, PromptHandler> = new Map();
  private categories: PromptCategory[] = [];

  constructor(serverName: string = 'mcp-server') {
    this.logger = new Logger(`PromptManager:${serverName}`);
    this.initializeDefaultPrompts();
  }

  /**
   * Initialize default ServiceNow prompts
   */
  private initializeDefaultPrompts(): void {
    // ServiceNow Development Prompts
    this.registerPrompt(
      {
        name: 'servicenow_widget_create',
        description: 'Generate a ServiceNow Service Portal widget with best practices',
        arguments: [
          { name: 'widget_name', description: 'Name for the widget', required: true },
          { name: 'description', description: 'Widget description and purpose', required: true },
          { name: 'features', description: 'Comma-separated list of features', required: false }
        ]
      },
      async (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Create a ServiceNow Service Portal widget with the following specifications:

**Widget Name:** ${args.widget_name}
**Description:** ${args.description}
${args.features ? `**Features:** ${args.features}` : ''}

Please generate:
1. Server Script (ES5 compatible)
2. Client Script (AngularJS)
3. HTML Template
4. CSS/SCSS styles
5. Link function (if needed)

Follow ServiceNow best practices:
- Use ES5 syntax only (var, function, no arrow functions)
- Implement proper error handling
- Include data binding between server and client
- Add meaningful comments`
            }
          }
        ]
      })
    );

    this.registerPrompt(
      {
        name: 'servicenow_script_include',
        description: 'Generate a ServiceNow Script Include with proper structure',
        arguments: [
          { name: 'class_name', description: 'Name for the Script Include class', required: true },
          { name: 'purpose', description: 'Purpose and functionality description', required: true },
          { name: 'methods', description: 'Comma-separated list of method names', required: false }
        ]
      },
      async (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Create a ServiceNow Script Include with the following specifications:

**Class Name:** ${args.class_name}
**Purpose:** ${args.purpose}
${args.methods ? `**Methods:** ${args.methods}` : ''}

Requirements:
- Use ES5 syntax only
- Implement as a proper class using ServiceNow patterns
- Include JSDoc comments
- Add error handling
- Make it client-callable if appropriate`
            }
          }
        ]
      })
    );

    this.registerPrompt(
      {
        name: 'servicenow_business_rule',
        description: 'Generate a ServiceNow Business Rule',
        arguments: [
          { name: 'name', description: 'Business Rule name', required: true },
          { name: 'table', description: 'Target table', required: true },
          { name: 'when', description: 'When to run (before/after/async)', required: true },
          { name: 'operation', description: 'Operation (insert/update/delete/query)', required: true },
          { name: 'description', description: 'What the rule should do', required: true }
        ]
      },
      async (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Create a ServiceNow Business Rule with the following specifications:

**Name:** ${args.name}
**Table:** ${args.table}
**When:** ${args.when}
**Operation:** ${args.operation}
**Description:** ${args.description}

Requirements:
- Use ES5 syntax only
- Include proper condition logic
- Add error handling
- Include logging with gs.info/warn/error
- Follow ServiceNow best practices for performance`
            }
          }
        ]
      })
    );

    this.registerPrompt(
      {
        name: 'servicenow_flow_designer',
        description: 'Design a ServiceNow Flow Designer flow',
        arguments: [
          { name: 'flow_name', description: 'Name for the flow', required: true },
          { name: 'trigger', description: 'Trigger type and conditions', required: true },
          { name: 'actions', description: 'Description of actions to perform', required: true }
        ]
      },
      async (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Design a ServiceNow Flow Designer flow:

**Flow Name:** ${args.flow_name}
**Trigger:** ${args.trigger}
**Actions:** ${args.actions}

Please provide:
1. Flow structure and trigger configuration
2. Action sequence with inputs/outputs
3. Error handling paths
4. Subflow recommendations if applicable
5. Testing considerations`
            }
          }
        ]
      })
    );

    this.registerPrompt(
      {
        name: 'servicenow_debug',
        description: 'Help debug a ServiceNow issue',
        arguments: [
          { name: 'error_message', description: 'Error message or symptom', required: true },
          { name: 'context', description: 'Where the error occurs (widget, script, flow, etc.)', required: true },
          { name: 'code_snippet', description: 'Relevant code if available', required: false }
        ]
      },
      async (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Help debug this ServiceNow issue:

**Error/Symptom:** ${args.error_message}
**Context:** ${args.context}
${args.code_snippet ? `**Code:**\n\`\`\`javascript\n${args.code_snippet}\n\`\`\`` : ''}

Please:
1. Analyze the error
2. Identify potential causes
3. Suggest debugging steps
4. Provide a solution
5. Recommend preventive measures

Remember: ServiceNow uses ES5 JavaScript (Rhino engine)`
            }
          }
        ]
      })
    );

    this.registerPrompt(
      {
        name: 'servicenow_glide_query',
        description: 'Generate a GlideRecord query',
        arguments: [
          { name: 'table', description: 'Table to query', required: true },
          { name: 'conditions', description: 'Query conditions in plain language', required: true },
          { name: 'fields', description: 'Fields to retrieve', required: false },
          { name: 'operation', description: 'Operation type (query/insert/update/delete)', required: false }
        ]
      },
      async (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Generate a GlideRecord query:

**Table:** ${args.table}
**Conditions:** ${args.conditions}
${args.fields ? `**Fields:** ${args.fields}` : ''}
${args.operation ? `**Operation:** ${args.operation}` : '**Operation:** query'}

Requirements:
- Use ES5 syntax
- Include null checks
- Add proper error handling
- Use encoded queries where appropriate
- Include comments explaining the query`
            }
          }
        ]
      })
    );

    this.registerPrompt(
      {
        name: 'servicenow_api_integration',
        description: 'Create a ServiceNow REST API integration',
        arguments: [
          { name: 'api_name', description: 'Name for the integration', required: true },
          { name: 'endpoint', description: 'External API endpoint', required: true },
          { name: 'method', description: 'HTTP method (GET/POST/PUT/DELETE)', required: true },
          { name: 'description', description: 'What the integration should do', required: true }
        ]
      },
      async (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Create a ServiceNow REST API integration:

**Integration Name:** ${args.api_name}
**Endpoint:** ${args.endpoint}
**Method:** ${args.method}
**Description:** ${args.description}

Please provide:
1. REST Message configuration
2. HTTP Method setup
3. Authentication handling
4. Request/Response processing
5. Error handling
6. Script Include wrapper for reusability`
            }
          }
        ]
      })
    );

    // ========== NEW PROMPTS (v9.0.150) ==========

    this.registerPrompt(
      {
        name: 'servicenow_client_script',
        description: 'Generate a ServiceNow Client Script for forms',
        arguments: [
          { name: 'table', description: 'Target table name', required: true },
          { name: 'type', description: 'Script type: onLoad, onChange, onSubmit, onCellEdit', required: true },
          { name: 'field_name', description: 'Field name (required for onChange)', required: false },
          { name: 'description', description: 'What the script should do', required: true }
        ]
      },
      async (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Create a ServiceNow Client Script:

**Table:** ${args.table}
**Type:** ${args.type}
${args.field_name ? `**Field Name:** ${args.field_name}` : ''}
**Description:** ${args.description}

Requirements:
- Use ES5 syntax only (no arrow functions, use var not const/let)
- Use g_form API for form manipulation
- Use g_user for user context
- Include proper null checks
- Add meaningful comments
- Handle async operations with GlideAjax if needed

Client Script APIs available:
- g_form: setValue, getValue, setVisible, setMandatory, setReadOnly, showFieldMsg
- g_user: hasRole, getClientData, userName, userID
- GlideAjax: for server-side calls`
            }
          }
        ]
      })
    );

    this.registerPrompt(
      {
        name: 'servicenow_ui_policy',
        description: 'Design a ServiceNow UI Policy for field control',
        arguments: [
          { name: 'table', description: 'Target table name', required: true },
          { name: 'conditions', description: 'When the policy should apply (plain language)', required: true },
          { name: 'actions', description: 'What fields to show/hide/make mandatory/readonly', required: true }
        ]
      },
      async (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Design a ServiceNow UI Policy:

**Table:** ${args.table}
**Conditions:** ${args.conditions}
**Actions:** ${args.actions}

Please provide:
1. UI Policy configuration (name, short description, order)
2. Condition builder setup (field conditions)
3. UI Policy Actions (visible, mandatory, read only)
4. Reverse if false setting recommendation
5. Any script actions needed (ES5 only)

Best practices:
- Set appropriate execution order (lower = first)
- Use "Reverse if false" for toggle behavior
- Consider mobile/service portal compatibility
- Document the business requirement`
            }
          }
        ]
      })
    );

    this.registerPrompt(
      {
        name: 'servicenow_ui_action',
        description: 'Create a ServiceNow UI Action (button/link)',
        arguments: [
          { name: 'table', description: 'Target table name', required: true },
          { name: 'action_name', description: 'Name for the UI Action', required: true },
          { name: 'type', description: 'Type: form_button, form_link, list_button, list_link, list_context', required: true },
          { name: 'description', description: 'What the action should do', required: true },
          { name: 'condition', description: 'When to show the action (optional)', required: false }
        ]
      },
      async (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Create a ServiceNow UI Action:

**Table:** ${args.table}
**Name:** ${args.action_name}
**Type:** ${args.type}
**Description:** ${args.description}
${args.condition ? `**Condition:** ${args.condition}` : ''}

Please provide:
1. UI Action configuration (name, order, action name)
2. Condition script (ES5) if needed
3. Client script (onclick) if client-side
4. Server script if server-side
5. Role restrictions if applicable

Requirements:
- ES5 syntax only
- Include current.update() awareness
- Handle form validation if needed
- Add confirmation dialogs for destructive actions
- Use gsftSubmit() for form submission with server script`
            }
          }
        ]
      })
    );

    this.registerPrompt(
      {
        name: 'servicenow_acl',
        description: 'Design a ServiceNow Access Control List (ACL) rule',
        arguments: [
          { name: 'table', description: 'Target table name (or * for all)', required: true },
          { name: 'operation', description: 'Operation: read, write, create, delete, execute', required: true },
          { name: 'field', description: 'Specific field (optional, leave empty for record-level)', required: false },
          { name: 'requirements', description: 'Who should have access and under what conditions', required: true }
        ]
      },
      async (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Design a ServiceNow ACL rule:

**Table:** ${args.table}
**Operation:** ${args.operation}
${args.field ? `**Field:** ${args.field}` : '**Level:** Record-level ACL'}
**Requirements:** ${args.requirements}

Please provide:
1. ACL configuration (name, operation, admin overrides)
2. Required roles
3. Condition builder setup
4. Script (ES5) if advanced logic needed

ACL Best Practices:
- Use roles over scripts when possible (performance)
- Consider inheritance from parent tables
- Test with impersonation
- Document the security requirement
- Use gs.hasRole() in scripts
- Return true/false from script

Available script objects:
- current: the record being accessed
- gs.getUser(): current user
- gs.hasRole('role_name'): role check`
            }
          }
        ]
      })
    );

    this.registerPrompt(
      {
        name: 'servicenow_notification',
        description: 'Create a ServiceNow Email Notification',
        arguments: [
          { name: 'table', description: 'Target table name', required: true },
          { name: 'event', description: 'Trigger event or condition', required: true },
          { name: 'recipients', description: 'Who should receive the notification', required: true },
          { name: 'content', description: 'What information to include', required: true }
        ]
      },
      async (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Create a ServiceNow Email Notification:

**Table:** ${args.table}
**Trigger:** ${args.event}
**Recipients:** ${args.recipients}
**Content:** ${args.content}

Please provide:
1. Notification configuration (name, table, when to send)
2. Condition builder or advanced condition script
3. Recipients configuration (users, groups, email fields)
4. Email template with:
   - Subject line (with variables)
   - Body (HTML with variables)
   - Mail script if dynamic content needed

Variable syntax:
- \${current.field_name} - current record fields
- \${current.field_name.getDisplayValue()} - display values
- \${mail_script:script_name} - mail script output
- \${template:template_name} - include template

Best practices:
- Use getDisplayValue() for reference fields
- Test with email logging enabled
- Consider digest notifications for bulk
- Include record link: \${URI_REF}`
            }
          }
        ]
      })
    );

    this.registerPrompt(
      {
        name: 'servicenow_scheduled_job',
        description: 'Create a ServiceNow Scheduled Job (Scheduled Script Execution)',
        arguments: [
          { name: 'name', description: 'Job name', required: true },
          { name: 'schedule', description: 'When to run (daily, weekly, hourly, cron expression)', required: true },
          { name: 'description', description: 'What the job should do', required: true }
        ]
      },
      async (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Create a ServiceNow Scheduled Job:

**Name:** ${args.name}
**Schedule:** ${args.schedule}
**Description:** ${args.description}

Please provide:
1. Scheduled Job configuration (name, run as, conditional)
2. Schedule definition (run type, time, repeat interval)
3. Script (ES5 only) with:
   - Clear purpose comment
   - Logging for monitoring
   - Error handling
   - Performance considerations

Best practices:
- Use GlideRecord with limits for large tables
- Add gs.info() logging for job tracking
- Include try/catch for error handling
- Consider using a Script Include for complex logic
- Test with "Execute Now" before scheduling
- Set appropriate "Run as" user for security context

Schedule examples:
- Daily at 2 AM: Run type "Daily", Time "02:00:00"
- Every hour: Run type "Periodically", Repeat interval "3600"
- Weekly Monday: Run type "Weekly", Day "Monday"`
            }
          }
        ]
      })
    );

    this.registerPrompt(
      {
        name: 'servicenow_transform_map',
        description: 'Design a ServiceNow Transform Map for data import',
        arguments: [
          { name: 'source_table', description: 'Import Set table (source)', required: true },
          { name: 'target_table', description: 'Target ServiceNow table', required: true },
          { name: 'field_mappings', description: 'Describe the field mappings needed', required: true },
          { name: 'special_handling', description: 'Any coalesce, transforms, or lookups needed', required: false }
        ]
      },
      async (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Design a ServiceNow Transform Map:

**Source Table:** ${args.source_table}
**Target Table:** ${args.target_table}
**Field Mappings:** ${args.field_mappings}
${args.special_handling ? `**Special Handling:** ${args.special_handling}` : ''}

Please provide:
1. Transform Map configuration (name, source, target, active)
2. Field Maps with:
   - Direct mappings (source field → target field)
   - Coalesce fields for matching existing records
   - Choice action (create/ignore/reject)
3. Transform Scripts if needed:
   - onStart: initialization
   - onBefore: pre-row processing
   - onAfter: post-row processing
   - onComplete: final processing

Best practices:
- Always set coalesce fields to prevent duplicates
- Use source_script for data transformation
- Log import statistics in onComplete
- Handle reference field lookups properly
- Test with small dataset first
- Use "Run business rules" appropriately`
            }
          }
        ]
      })
    );

    this.registerPrompt(
      {
        name: 'servicenow_catalog_item',
        description: 'Design a ServiceNow Service Catalog Item',
        arguments: [
          { name: 'name', description: 'Catalog Item name', required: true },
          { name: 'category', description: 'Catalog category', required: true },
          { name: 'description', description: 'What the item provides/does', required: true },
          { name: 'variables', description: 'User input fields needed', required: true },
          { name: 'fulfillment', description: 'How the request will be fulfilled (workflow, flow, script)', required: false }
        ]
      },
      async (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Design a ServiceNow Service Catalog Item:

**Name:** ${args.name}
**Category:** ${args.category}
**Description:** ${args.description}
**Variables:** ${args.variables}
${args.fulfillment ? `**Fulfillment:** ${args.fulfillment}` : ''}

Please provide:
1. Catalog Item configuration:
   - Name, short description, description
   - Category assignment
   - Icon and picture
   - Availability (desktop, mobile, service portal)

2. Variables (user input fields):
   - Variable types (Single Line Text, Reference, Select Box, etc.)
   - Mandatory settings
   - Default values
   - Variable sets for reuse

3. Variable Client Scripts (ES5) if needed:
   - Catalog Client Scripts for dynamic behavior
   - Use g_form API

4. Fulfillment:
   - Flow Designer flow (recommended)
   - Or workflow
   - Or catalog script

5. Pricing/approval if applicable:
   - Price, recurring price
   - Approval rules

Best practices:
- Group related variables with Variable Sets
- Use Reference Qualifiers for filtered lookups
- Add help text for user guidance
- Test in Service Portal`
            }
          }
        ]
      })
    );

    // Organize into categories
    this.categories = [
      {
        name: 'development',
        description: 'ServiceNow development prompts for scripts and widgets',
        prompts: [
          this.promptRegistry.get('servicenow_widget_create')!,
          this.promptRegistry.get('servicenow_script_include')!,
          this.promptRegistry.get('servicenow_business_rule')!,
          this.promptRegistry.get('servicenow_client_script')!
        ].filter(Boolean)
      },
      {
        name: 'platform',
        description: 'ServiceNow platform configuration prompts',
        prompts: [
          this.promptRegistry.get('servicenow_ui_policy')!,
          this.promptRegistry.get('servicenow_ui_action')!,
          this.promptRegistry.get('servicenow_acl')!
        ].filter(Boolean)
      },
      {
        name: 'automation',
        description: 'ServiceNow automation and workflow prompts',
        prompts: [
          this.promptRegistry.get('servicenow_flow_designer')!,
          this.promptRegistry.get('servicenow_notification')!,
          this.promptRegistry.get('servicenow_scheduled_job')!
        ].filter(Boolean)
      },
      {
        name: 'debugging',
        description: 'ServiceNow debugging and troubleshooting prompts',
        prompts: [
          this.promptRegistry.get('servicenow_debug')!,
          this.promptRegistry.get('servicenow_glide_query')!
        ].filter(Boolean)
      },
      {
        name: 'integration',
        description: 'ServiceNow integration and data import prompts',
        prompts: [
          this.promptRegistry.get('servicenow_api_integration')!,
          this.promptRegistry.get('servicenow_transform_map')!
        ].filter(Boolean)
      },
      {
        name: 'catalog',
        description: 'ServiceNow Service Catalog prompts',
        prompts: [
          this.promptRegistry.get('servicenow_catalog_item')!
        ].filter(Boolean)
      }
    ];
  }

  /**
   * Register a new prompt with its handler
   */
  registerPrompt(prompt: MCPPrompt, handler: PromptHandler): void {
    this.promptRegistry.set(prompt.name, prompt);
    this.promptHandlers.set(prompt.name, handler);
    this.logger.debug(`Registered prompt: ${prompt.name}`);
  }

  /**
   * Unregister a prompt
   */
  unregisterPrompt(name: string): boolean {
    const deleted = this.promptRegistry.delete(name);
    this.promptHandlers.delete(name);
    if (deleted) {
      this.logger.debug(`Unregistered prompt: ${name}`);
    }
    return deleted;
  }

  /**
   * List all registered prompts
   */
  listPrompts(): MCPPrompt[] {
    return Array.from(this.promptRegistry.values());
  }

  /**
   * Get a specific prompt by name
   */
  getPrompt(name: string): MCPPrompt | undefined {
    return this.promptRegistry.get(name);
  }

  /**
   * Execute a prompt with arguments and return the result
   */
  async executePrompt(name: string, args: Record<string, string> = {}): Promise<MCPPromptResult> {
    const prompt = this.promptRegistry.get(name);
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`);
    }

    const handler = this.promptHandlers.get(name);
    if (!handler) {
      throw new Error(`No handler registered for prompt: ${name}`);
    }

    // Validate required arguments
    if (prompt.arguments) {
      for (const arg of prompt.arguments) {
        if (arg.required && !args[arg.name]) {
          throw new Error(`Missing required argument: ${arg.name}`);
        }
      }
    }

    this.logger.debug(`Executing prompt: ${name}`, { args });
    return await handler(args);
  }

  /**
   * Get prompts by category
   */
  getPromptsByCategory(categoryName: string): MCPPrompt[] {
    const category = this.categories.find(c => c.name === categoryName);
    return category ? category.prompts : [];
  }

  /**
   * Get all categories
   */
  getCategories(): PromptCategory[] {
    return this.categories;
  }

  /**
   * Search prompts by name or description
   */
  searchPrompts(query: string): MCPPrompt[] {
    const lowerQuery = query.toLowerCase();
    return this.listPrompts().filter(prompt =>
      prompt.name.toLowerCase().includes(lowerQuery) ||
      (prompt.description && prompt.description.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get prompt statistics
   */
  getPromptStats(): {
    total: number;
    categories: { [key: string]: number };
  } {
    const categories: { [key: string]: number } = {};

    for (const category of this.categories) {
      categories[category.name] = category.prompts.length;
    }

    return {
      total: this.promptRegistry.size,
      categories
    };
  }

  /**
   * Clear all registered prompts (useful for testing)
   */
  clearPrompts(): void {
    this.promptRegistry.clear();
    this.promptHandlers.clear();
    this.categories = [];
    this.logger.debug('All prompts cleared');
  }
}
