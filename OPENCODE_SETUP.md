# 🚀 Snow-Flow with OpenCode - Simple Setup

**Use ANY LLM with Snow-Flow through OpenCode**

OpenCode provides everything you need:
- ✅ 75+ LLM providers (Claude, GPT, Gemini, local models)
- ✅ Multi-agent coordination
- ✅ MCP protocol support
- ✅ Terminal UI
- ✅ Model selection

Snow-Flow provides:
- ✅ 235+ ServiceNow tools via MCP
- ✅ Complete ServiceNow development capabilities

---

## Quick Start (5 Minutes)

### 1. Install OpenCode

```bash
npm install -g @opencode/cli
```

### 2. Install Snow-Flow

```bash
npm install -g snow-flow
```

### 3. Configure ServiceNow Credentials

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your ServiceNow details
# SNOW_INSTANCE=your-instance.service-now.com
# SNOW_CLIENT_ID=your-client-id
# SNOW_CLIENT_SECRET=your-client-secret
```

### 4. Configure OpenCode for Snow-Flow

There are two ways to configure OpenCode:

#### Option A: Automatic (Recommended)

```bash
# Run from Snow-Flow directory
opencode config import opencode-config.example.json
```

#### Option B: Manual

Edit `~/.opencode/config.json`:

```json
{
  "mcp": {
    "servicenow-unified": {
      "type": "local",
      "command": "node",
      "args": ["dist/mcp/servicenow-mcp-unified/index.js"],
      "env": {
        "SNOW_INSTANCE": "your-instance.service-now.com",
        "SNOW_CLIENT_ID": "your-client-id",
        "SNOW_CLIENT_SECRET": "your-client-secret"
      },
      "enabled": true
    }
  }
}
```

**⚠️ Important:** Update the `args` path to match your Snow-Flow installation location:
- Global install: Usually in `/usr/local/lib/node_modules/snow-flow/dist/mcp/servicenow-mcp-unified/index.js`
- Local install: `./node_modules/snow-flow/dist/mcp/servicenow-mcp-unified/index.js`

To find your installation:
```bash
npm list -g snow-flow
```

### 5. Start OpenCode

```bash
opencode
```

### 6. Start Developing!

In OpenCode, you can now use Snow-Flow tools:

```
> Create a ServiceNow incident widget with real-time status updates

> Deploy a business rule that auto-assigns incidents based on category

> Build a complete Change Management dashboard with approval workflow
```

---

## Model Selection

OpenCode supports 75+ LLM providers out of the box:

### Use Claude (Default)
```bash
opencode config set model.provider anthropic
opencode config set model.model claude-sonnet-4
```

### Use GPT-4
```bash
opencode config set model.provider openai
opencode config set model.model gpt-4o
```

### Use Gemini
```bash
opencode config set model.provider google
opencode config set model.model gemini-pro
```

### Use Local Models (Free!)
```bash
# First install Ollama: https://ollama.com
ollama pull llama3.1

opencode config set model.provider ollama
opencode config set model.model llama3.1
```

### Cost-Optimized Setup
```bash
# Use GPT-4o-mini for cost savings (85% cheaper than Claude)
opencode config set model.model gpt-4o-mini
```

---

## ServiceNow OAuth Setup

Snow-Flow uses OAuth 2.0 for secure ServiceNow access:

1. **In ServiceNow:** System OAuth → Application Registry
2. **Create:** "OAuth API endpoint for external clients"
3. **Configure:**
   - Name: `Snow-Flow Integration`
   - Redirect URL: `http://localhost:3005/callback`
   - Refresh Token Lifespan: `0` (unlimited)
4. **Copy** Client ID and Client Secret to `.env`

---

## Available Tools

OpenCode will automatically discover all 235+ Snow-Flow tools:

### Categories
- **CRUD Operations**: Query, create, update, delete any ServiceNow table
- **Widgets**: Create Service Portal widgets with HTML/CSS/JS
- **Business Rules**: Server-side automation scripts
- **UI Policies**: Form behavior and field interactions
- **Flow Designer**: Workflow automation
- **Reports & Dashboards**: Data visualization
- **User Management**: Access control and permissions
- **Change Management**: CAB workflows
- **CMDB**: Configuration item management
- **And much more...**

### Tool Discovery

To see all available tools in OpenCode:
```
> What ServiceNow tools are available?
```

OpenCode will list all 235+ tools with descriptions.

---

## Advanced Configuration

### Per-Task Model Selection

OpenCode allows you to switch models mid-conversation:

```
> Use GPT-4o-mini for this next task

> Switch to Claude Sonnet for complex reasoning

> Use local Llama model for privacy
```

### Multiple Agents

OpenCode supports running multiple agents in parallel:

```
> Create a widget AND write unit tests in parallel
```

OpenCode will automatically:
1. Spawn 2 agents
2. Coordinate their work
3. Merge results

### Environment Variables

Snow-Flow MCP server respects these environment variables:

```bash
# Required
SNOW_INSTANCE=your-instance.service-now.com

# OAuth (Recommended)
SNOW_CLIENT_ID=your-client-id
SNOW_CLIENT_SECRET=your-client-secret

# OR Basic Auth
SNOW_USERNAME=your-username
SNOW_PASSWORD=your-password

# Optional
LOG_LEVEL=debug  # For troubleshooting
```

---

## Troubleshooting

### OpenCode can't find MCP tools

**Check MCP server path:**
```bash
# Find where Snow-Flow is installed
npm list -g snow-flow

# Update config with correct path
opencode config set mcp.servicenow-unified.args '["<path>/dist/mcp/servicenow-mcp-unified/index.js"]'
```

### Authentication errors

**Verify credentials:**
```bash
# Test ServiceNow connection
curl -u "client_id:client_secret" \
  https://your-instance.service-now.com/api/now/table/sys_user?sysparm_limit=1
```

### MCP server crashes

**Enable debug logging:**
```bash
LOG_LEVEL=debug opencode
```

Check OpenCode logs for MCP server output.

---

## Comparison: OpenCode vs Claude Code

| Feature | OpenCode | Claude Code |
|---------|----------|-------------|
| **LLM Support** | 75+ providers | Claude only |
| **Cost** | Free + your API costs | Claude Pro ($20/month) |
| **Local Models** | ✅ Yes (Ollama) | ❌ No |
| **MCP Support** | ✅ Yes | ✅ Yes |
| **Multi-Agent** | ✅ Yes | ✅ Yes |
| **Open Source** | ✅ Yes | ❌ No |
| **Model Control** | ✅ Full control | ❌ Fixed (Claude) |

---

## Example Workflows

### Create Incident Widget
```
> Create a Service Portal widget that displays open incidents with:
  - Real-time status updates
  - Priority-based color coding
  - Click to view incident details
  - Filter by category
```

### Automate Assignment
```
> Create a business rule that:
  - Triggers on incident creation
  - Checks incident category
  - Auto-assigns to appropriate team based on category
  - Sends notification to assignee
```

### Build Dashboard
```
> Create a dashboard with:
  - Incident volume trend (last 30 days)
  - SLA compliance metrics
  - Top 10 incident categories
  - Average resolution time
```

---

## Getting Help

- **OpenCode Docs**: https://opencode.ai/docs
- **Snow-Flow Issues**: https://github.com/groeimetai/snow-flow/issues
- **MCP Protocol**: https://modelcontextprotocol.io

---

## What's Next?

With OpenCode + Snow-Flow you can:

✅ Use the cheapest LLM for simple tasks
✅ Use the smartest LLM for complex tasks
✅ Mix models per task type
✅ Work offline with local models
✅ Have full cost control
✅ Maintain privacy with self-hosted models

**Snow-Flow provides the ServiceNow expertise, OpenCode provides the flexibility.**

Happy developing! 🚀
