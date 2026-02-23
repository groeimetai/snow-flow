# MCP Prompts - Snow-Flow ServiceNow Templates

This document describes the MCP Prompts feature in Snow-Flow, providing reusable prompt templates for ServiceNow development tasks.

## What are MCP Prompts?

MCP (Model Context Protocol) Prompts are standardized, reusable prompt templates that can be discovered and invoked by MCP clients. They provide:

- **Consistency**: Same prompt structure across all clients
- **Discoverability**: Clients can list available prompts
- **Arguments**: Typed parameters for customization
- **Best Practices**: Built-in ServiceNow standards (ES5, patterns)

## Available Prompts (15 total)

### Development Category (4 prompts)

| Prompt                      | Description                    | Required Args                             |
| --------------------------- | ------------------------------ | ----------------------------------------- |
| `servicenow_widget_create`  | Generate Service Portal widget | widget_name, description                  |
| `servicenow_script_include` | Create Script Include class    | class_name, purpose                       |
| `servicenow_business_rule`  | Generate Business Rule         | name, table, when, operation, description |
| `servicenow_client_script`  | Create Client Script           | table, type, description                  |

### Platform Category (3 prompts)

| Prompt                 | Description                  | Required Args                         |
| ---------------------- | ---------------------------- | ------------------------------------- |
| `servicenow_ui_policy` | Design UI Policy             | table, conditions, actions            |
| `servicenow_ui_action` | Create UI Action button/link | table, action_name, type, description |
| `servicenow_acl`       | Design Access Control rule   | table, operation, requirements        |

### Automation Category (3 prompts)

| Prompt                     | Description               | Required Args                     |
| -------------------------- | ------------------------- | --------------------------------- |
| `servicenow_flow_designer` | Design Flow Designer flow | flow_name, trigger, actions       |
| `servicenow_notification`  | Create Email Notification | table, event, recipients, content |
| `servicenow_scheduled_job` | Create Scheduled Job      | name, schedule, description       |

### Debugging Category (2 prompts)

| Prompt                   | Description                | Required Args          |
| ------------------------ | -------------------------- | ---------------------- |
| `servicenow_debug`       | Debug ServiceNow issues    | error_message, context |
| `servicenow_glide_query` | Generate GlideRecord query | table, conditions      |

### Integration Category (2 prompts)

| Prompt                       | Description                 | Required Args                              |
| ---------------------------- | --------------------------- | ------------------------------------------ |
| `servicenow_api_integration` | Create REST API integration | api_name, endpoint, method, description    |
| `servicenow_transform_map`   | Design Transform Map        | source_table, target_table, field_mappings |

### Catalog Category (1 prompt)

| Prompt                    | Description                 | Required Args                          |
| ------------------------- | --------------------------- | -------------------------------------- |
| `servicenow_catalog_item` | Design Service Catalog Item | name, category, description, variables |

## Usage

### Via MCP Protocol

```javascript
// List all available prompts
const prompts = await mcpClient.listPrompts()

// Get a specific prompt with arguments
const result = await mcpClient.getPrompt("servicenow_widget_create", {
  widget_name: "user_profile",
  description: "Display user profile information",
  features: "avatar, edit button, activity feed",
})

// Result contains messages array ready for LLM
console.log(result.messages)
```

### Via MCPPromptManager (Server-side)

```typescript
import { MCPPromptManager } from "./mcp-prompt-manager.js"

const manager = new MCPPromptManager("my-server")

// List prompts
const prompts = manager.listPrompts()

// Execute prompt
const result = await manager.executePrompt("servicenow_business_rule", {
  name: "Set Priority",
  table: "incident",
  when: "before",
  operation: "insert",
  description: "Auto-set priority based on impact and urgency",
})

// Search prompts
const debugPrompts = manager.searchPrompts("debug")

// Get by category
const devPrompts = manager.getPromptsByCategory("development")
```

## Creating Custom Prompts

You can register custom prompts in your MCP server:

```typescript
import { MCPPromptManager } from "./mcp-prompt-manager.js"

const manager = new MCPPromptManager("my-server")

// Register a custom prompt
manager.registerPrompt(
  {
    name: "my_custom_prompt",
    description: "My custom ServiceNow prompt",
    arguments: [
      { name: "param1", description: "First parameter", required: true },
      { name: "param2", description: "Optional parameter", required: false },
    ],
  },
  async (args) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Custom prompt with ${args.param1} and ${args.param2 || "default"}`,
        },
      },
    ],
  }),
)
```

## Best Practices

### All Prompts Include:

1. **ES5 Syntax Requirement** - ServiceNow uses Rhino engine
2. **Error Handling** - Proper try/catch patterns
3. **Logging** - gs.info/warn/error usage
4. **Performance** - Query optimization tips
5. **Security** - ACL and role considerations

### When to Use Prompts:

- **UI Applications**: Prompt selector for stakeholders
- **Standardization**: Consistent output across teams
- **Onboarding**: New developers learn patterns
- **Enterprise**: Portal integration for non-technical users

### When to Use CLAUDE.md/AGENTS.md Instead:

- **CLI/Agent workflows**: System prompts loaded at session start
- **Complex context**: Multi-file operations
- **Persistent rules**: Always-active guidelines

## API Reference

### MCPPromptManager

```typescript
class MCPPromptManager {
  // List all prompts
  listPrompts(): MCPPrompt[]

  // Get specific prompt
  getPrompt(name: string): MCPPrompt | undefined

  // Execute prompt with args
  executePrompt(name: string, args: Record<string, string>): Promise<MCPPromptResult>

  // Register custom prompt
  registerPrompt(prompt: MCPPrompt, handler: PromptHandler): void

  // Unregister prompt
  unregisterPrompt(name: string): boolean

  // Get prompts by category
  getPromptsByCategory(category: string): MCPPrompt[]

  // Get all categories
  getCategories(): PromptCategory[]

  // Search prompts
  searchPrompts(query: string): MCPPrompt[]

  // Get statistics
  getPromptStats(): { total: number; categories: Record<string, number> }
}
```

### Types

```typescript
interface MCPPrompt {
  name: string
  description?: string
  arguments?: MCPPromptArgument[]
}

interface MCPPromptArgument {
  name: string
  description?: string
  required?: boolean
}

interface MCPPromptResult {
  description?: string
  messages: MCPPromptMessage[]
}

interface MCPPromptMessage {
  role: "user" | "assistant"
  content: MCPPromptContent
}
```

## Version History

- **v9.0.150**: Added 8 new prompts (client script, UI policy, UI action, ACL, notification, scheduled job, transform map, catalog item), expanded categories
- **v9.0.149**: Initial release with 7 prompts (widget, script include, business rule, flow designer, debug, glide query, API integration)
