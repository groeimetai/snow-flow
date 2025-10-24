# SnowCode Setup Guide for Snow-Flow

This guide explains how to properly configure SnowCode to use Snow-Flow's MCP tools.

## Quick Start

### 1. Copy Example Config

```bash
cp snowcode-config.example.json snowcode-config.json
```

### 2. Update Environment Variables

Edit `snowcode-config.json` and replace the `${VARIABLE}` placeholders with your actual values:

```json
{
  "$schema": "https://snowcode.ai/config.json",
  "name": "snow-flow-snowcode",
  "description": "SnowCode configuration for Snow-Flow ServiceNow development",
  "model": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-5-20250929",
    "temperature": 1.0
  },
  "mcp": {
    "servicenow-unified": {
      "type": "local",
      "command": ["node", "dist/mcp/servicenow-mcp-unified/index.js"],
      "environment": {
        "SNOW_INSTANCE": "your-instance.service-now.com",
        "SNOW_CLIENT_ID": "your-client-id",
        "SNOW_CLIENT_SECRET": "your-client-secret",
        "SNOW_USERNAME": "your-username",
        "SNOW_PASSWORD": "your-password"
      },
      "enabled": true
    },
    "snow-flow": {
      "type": "local",
      "command": ["node", "dist/mcp/snow-flow-mcp.js"],
      "environment": {
        "SNOW_FLOW_ENV": "production"
      },
      "enabled": true
    }
  },
  "tools": {
    "enabled": true,
    "requireApproval": false
  },
  "theme": "servicenow",
  "instructions": [
    "AGENTS.md",
    "CLAUDE.md",
    ".snowcode/AGENTS.md"
  ],
  "cwd": "/path/to/your/snow-flow/installation"
}
```

### 3. Build Snow-Flow

```bash
npm run build
```

This creates the `dist/` directory with the MCP server files.

### 4. Start SnowCode

```bash
snowcode
```

## Critical Configuration Details

### ⚠️ Common Mistakes

1. **Using `"env"` instead of `"environment"`**
   ```json
   // ❌ WRONG - Tools won't load!
   "env": { "SNOW_INSTANCE": "..." }

   // ✅ CORRECT
   "environment": { "SNOW_INSTANCE": "..." }
   ```

2. **Wrong command path**
   ```json
   // ❌ WRONG - File doesn't exist
   "command": ["node", "src/mcp/servicenow-mcp-unified/index.js"]

   // ✅ CORRECT - Must point to dist/ after build
   "command": ["node", "dist/mcp/servicenow-mcp-unified/index.js"]
   ```

3. **Forgetting to build**
   - Always run `npm run build` after pulling updates
   - The `dist/` directory must exist before starting SnowCode

### Environment Variables

**Required for ServiceNow MCP:**
- `SNOW_INSTANCE` - Your ServiceNow instance URL (e.g., `dev12345.service-now.com`)
- `SNOW_CLIENT_ID` - OAuth client ID
- `SNOW_CLIENT_SECRET` - OAuth client secret
- `SNOW_USERNAME` - ServiceNow username
- `SNOW_PASSWORD` - ServiceNow password

**Optional for Snow-Flow MCP:**
- `SNOW_FLOW_ENV` - Environment (default: `production`)

## Verifying MCP Tools are Loaded

### Check Tool Availability

When SnowCode starts, you should see the MCP servers loading in the logs:

```
[MCP] Loading servicenow-unified...
[MCP] Loaded 370+ tools from servicenow-unified
[MCP] Loading snow-flow...
[MCP] Loaded 176+ tools from snow-flow
```

### Test Tool Execution

In SnowCode, try a simple command:

```
Create an Update Set named "Test Update Set"
```

The agent should:
1. ✅ Call `snow_update_set_manage()` function
2. ✅ Show the actual function call in the response
3. ✅ Return the Update Set sys_id

**If the agent only shows code snippets instead of calling tools, check:**
- Is `snowcode-config.json` using `"environment"` (not `"env"`)?
- Did you run `npm run build` after updating Snow-Flow?
- Are the MCP servers enabled (`"enabled": true`)?
- Do the `dist/` files exist?

## MCP Tool Categories

### ServiceNow Unified MCP (370+ tools)

**Core Operations:**
- `snow_query_table` - Query any ServiceNow table
- `snow_create_record` - Create records
- `snow_update_record` - Update records

**Development:**
- `snow_update_set_manage` - Manage Update Sets (v8.2.0+)
- `snow_deploy` - Deploy widgets, pages, etc.
- `snow_pull_artifact` - Local widget sync

**UI Builder:**
- `snow_create_uib_page` - Create UI Builder pages
- `snow_add_uib_page_element` - Add components
- `snow_create_uib_data_broker` - Connect data sources

**Workspace:**
- `snow_create_complete_workspace` - Create agent workspaces
- `snow_create_workspace_tab` - Add tabs

### Snow-Flow MCP (176+ tools)

**Orchestration:**
- `swarm_init` - Initialize agent swarms
- `agent_spawn` - Create specialized agents
- `task_orchestrate` - Complex task coordination

**Memory:**
- `memory_search` - Search persistent memory
- `memory_usage` - Memory analytics

**ML (TensorFlow.js):**
- `neural_train` - Train neural networks
- `neural_patterns` - Pattern recognition

## Troubleshooting

### Problem: "Tools not available"

**Solution:**
1. Check `snowcode-config.json` exists
2. Verify `"environment"` key (not `"env"`)
3. Run `npm run build`
4. Restart SnowCode

### Problem: "Agent shows code instead of calling tools"

This usually means the MCP servers aren't loaded correctly.

**Solution:**
1. Check SnowCode logs for MCP loading errors
2. Verify `dist/` directory exists
3. Check command paths in config
4. Ensure `"enabled": true`

### Problem: "Module not found" errors

**Solution:**
```bash
# Rebuild everything
npm run build

# Verify dist files exist
ls -la dist/mcp/servicenow-mcp-unified/index.js
ls -la dist/mcp/snow-flow-mcp.js
```

## Advanced Configuration

### Per-Agent Tool Control

Disable tools globally but enable for specific agents:

```json
{
  "mcp": {
    "servicenow-unified": { "enabled": true }
  },
  "tools": {
    "servicenow-unified*": false  // Disable all by default
  },
  "agent": {
    "servicenow-dev": {
      "tools": {
        "servicenow-unified*": true  // Enable for this agent
      }
    }
  }
}
```

### Custom Tool Approval

Require approval for specific tools:

```json
{
  "tools": {
    "enabled": true,
    "requireApproval": true,
    "approvalPatterns": {
      "snow_execute_background_script": true,  // Always require approval
      "snow_update_set_manage": false          // Auto-approve
    }
  }
}
```

## Best Practices

### 1. Always Create Update Sets First

```javascript
// ✅ CORRECT workflow
const updateSet = await snow_update_set_manage({
  action: 'create',
  name: "Feature: X"
});
// ... develop ...
await snow_update_set_manage({ action: 'complete' });
```

### 2. Use Specific Tools Over Generic

```javascript
// ❌ Generic (slower)
await snow_query_table({ table: 'incident' });

// ✅ Specific (faster, better features)
await snow_query_incidents({ filters: { active: true } });
```

### 3. Use Local Sync for Widgets

```javascript
// ✅ CORRECT - No token limits!
await snow_pull_artifact({ sys_id: 'widget_sys_id' });
// ... edit locally ...
await snow_push_artifact({ sys_id: 'widget_sys_id' });

// ❌ WRONG - Token limits!
await snow_query_table({ table: 'sp_widget' });
```

## Getting Help

If you encounter issues:

1. **Check logs**: SnowCode shows detailed MCP loading logs
2. **Verify config**: Use `"environment"` (not `"env"`)
3. **Rebuild**: Always `npm run build` after updates
4. **GitHub Issues**: https://github.com/your-repo/snow-flow/issues

## Version Info

- **SnowCode**: Requires SnowCode v1.0+
- **Snow-Flow**: v8.3.0+
- **Node.js**: v18+ recommended
- **MCP Spec**: 1.0.0

---

**Last Updated**: 2025-10-22 (v8.3.0)
