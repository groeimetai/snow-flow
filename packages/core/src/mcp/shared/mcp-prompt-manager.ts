/**
 * MCP Prompt Manager
 * Comprehensive prompt management for MCP servers
 * Implements MCP prompts protocol for reusable prompt templates and workflows
 */

import { Logger } from '../../utils/logger.js';

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

    // Organize into categories
    this.categories = [
      {
        name: 'development',
        description: 'ServiceNow development prompts',
        prompts: [
          this.promptRegistry.get('servicenow_widget_create')!,
          this.promptRegistry.get('servicenow_script_include')!,
          this.promptRegistry.get('servicenow_business_rule')!
        ].filter(Boolean)
      },
      {
        name: 'automation',
        description: 'ServiceNow automation prompts',
        prompts: [
          this.promptRegistry.get('servicenow_flow_designer')!
        ].filter(Boolean)
      },
      {
        name: 'debugging',
        description: 'ServiceNow debugging prompts',
        prompts: [
          this.promptRegistry.get('servicenow_debug')!,
          this.promptRegistry.get('servicenow_glide_query')!
        ].filter(Boolean)
      },
      {
        name: 'integration',
        description: 'ServiceNow integration prompts',
        prompts: [
          this.promptRegistry.get('servicenow_api_integration')!
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
