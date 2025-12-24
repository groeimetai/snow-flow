<p align="center">
  <picture>
    <img src="apps/website/public/logo.svg" alt="Snow-Flow logo" width="300">
  </picture>
</p>

<pre>
    ▲  ▲        █▀▀▀ █▀▀▄ █▀▀█ █   █   █▀▀▀ █▀▀█ █▀▀▄ █▀▀▀
   ▲ ▼▲ ▼▲      ▀▀▀█ █  █ █  █ █ █ █   █    █  █ █  █ █▀▀
  ▲ ▼  ▼  ▼     ▀▀▀▀ ▀  ▀ ▀▀▀▀ ▀▀▀▀▀   ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀
</pre>
<h3 align="center">AI-Powered ServiceNow Development Platform</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/snow-flow"><img alt="npm" src="https://img.shields.io/npm/v/snow-flow?style=flat-square&logo=npm&color=CB3837" /></a>
  <a href="https://github.com/groeimetai/snow-flow"><img alt="GitHub stars" src="https://img.shields.io/github/stars/groeimetai/snow-flow?style=flat-square&logo=github" /></a>
  <a href="https://www.elastic.co/licensing/elastic-license"><img alt="License" src="https://img.shields.io/badge/license-Elastic--2.0-blue?style=flat-square" /></a>
  <a href="#"><img alt="Tools" src="https://img.shields.io/badge/MCP_tools-410+-purple?style=flat-square" /></a>
  <a href="https://portal.snow-flow.dev"><img alt="Enterprise" src="https://img.shields.io/badge/enterprise-available-green?style=flat-square" /></a>
</p>

<p align="center">
  <strong>The Free ServiceNow Build Agent Alternative</strong><br>
  410+ MCP tools | Any LLM provider | Local development | Open source
</p>

---

## Quick Start

```bash
npm install -g snow-flow
snow-flow
```

That's it. Snow-Flow starts an interactive TUI that auto-initializes on first run. Type `/auth` to authenticate with ServiceNow and your preferred LLM provider.

---

## What is Snow-Flow?

Snow-Flow is an AI-powered development platform for ServiceNow. It uses the **Model Context Protocol (MCP)** to give AI assistants direct access to your ServiceNow instance through 410+ specialized tools.

**Talk to your ServiceNow instance in plain English:**

```
You: Create a dashboard widget showing P1 incidents with SLA countdown timers

You: Build a business rule to auto-assign incidents based on category and location

You: Pull the incident form widget to local files so I can debug it

You: Analyze incident trends from the last 30 days and create a knowledge article
```

Snow-Flow handles everything: Update Set creation, ES5 validation, widget coherence checks, and deployment.

---

## Why Snow-Flow?

### vs ServiceNow Build Agent

| Feature | Snow-Flow | ServiceNow Build Agent |
|---------|-----------|------------------------|
| **Cost** | **Free** (open source) | $100-200/user/month + Pro Plus |
| **AI Model** | **Any** - Claude, GPT-4, Gemini, Llama, Ollama | NowLLM only |
| **Development** | **Local IDE** - VS Code, Cursor, terminal | Browser-based Studio |
| **Enterprise Tools** | **Jira, Azure DevOps, Confluence** | ServiceNow ecosystem only |
| **Open Source** | Yes | No |
| **Self-hosted** | Yes | No |

### What You Get

- **410+ MCP Tools** - Complete ServiceNow API coverage across 18 specialized servers
- **Any LLM Provider** - Claude, GPT-4, Gemini, Mistral, DeepSeek, Groq, or 100% free with Ollama
- **Built-in TUI** - Interactive terminal interface for conversational development
- **Local Development** - Pull artifacts to local files, edit with your favorite IDE, push back
- **ES5 Validation** - Catches Rhino engine errors before deployment (ServiceNow uses ES5)
- **Update Set Management** - Automatic change tracking for all development work
- **Widget Coherence** - Validates HTML/Client/Server script communication
- **Multi-IDE Support** - Works with Claude Desktop, Cursor, Windsurf, Continue.dev

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  Snow-Flow TUI                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  You: Create an incident dashboard widget with priority charts  │
│                                                                 │
│  ┌─ Snow-Flow ─────────────────────────────────────────────┐   │
│  │ 1. Creating Update Set: "Feature: Incident Dashboard"   │   │
│  │ 2. Building widget template (HTML)...                   │   │
│  │ 3. Writing server script (ES5 validated)...             │   │
│  │ 4. Writing client controller...                         │   │
│  │ 5. Validating widget coherence...                       │   │
│  │ 6. Deploying to dev12345.service-now.com...            │   │
│  │ ✓ Widget deployed: incident_dashboard                   │   │
│  │                                                         │   │
│  │ Preview: https://dev12345.service-now.com/sp?id=...    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  You: _                                                         │
└─────────────────────────────────────────────────────────────────┘
```

Snow-Flow's MCP servers give your AI assistant direct access to ServiceNow APIs. When you make a request:

1. **Update Set** - Automatically created to track all changes
2. **Development** - AI builds the artifact using appropriate MCP tools
3. **Validation** - ES5 syntax check, widget coherence, schema validation
4. **Deployment** - Direct deployment to your ServiceNow instance
5. **Verification** - Confirms deployment and provides direct URLs

---

## MCP Tools Overview

Snow-Flow provides **410+ tools** across **18 specialized MCP servers**:

| Server | Tools | Capabilities |
|--------|-------|--------------|
| **Operations** | 24 | CRUD operations, queries, user management |
| **Automation** | 15 | Background scripts, scheduled jobs, events |
| **Deployment** | 12 | Widgets, pages, flows, artifact management |
| **Platform Dev** | 18 | Business rules, client scripts, UI policies |
| **Integration** | 14 | REST messages, transform maps, MID Server management |
| **Update Sets** | 8 | Create, complete, export, switch |
| **CMDB** | 22 | CI management, relationships, discovery |
| **Reporting** | 16 | Reports, dashboards, KPIs, analytics |
| **Machine Learning** | 12 | Predictive Intelligence, TensorFlow.js |
| **Flow Designer** | 10 | Flows, subflows, actions |
| **Workspace** | 8 | Agent Workspace, UI Builder |
| **Knowledge** | 10 | Articles, categories, feedback |
| **Service Catalog** | 14 | Items, variables, workflows |
| **Security** | 12 | ACLs, policies, compliance |
| **Local Dev** | 6 | Pull/push artifacts, local file sync |
| **Orchestration** | 8 | Multi-agent coordination |
| **Memory** | 6 | Persistent context, search |
| **Performance** | 8 | Metrics, optimization, monitoring |

**All tools follow the `snow_*` naming convention** and are automatically available to any MCP-compatible AI assistant.

---

## Setup

### 1. Install Snow-Flow

```bash
npm install -g snow-flow
```

### 2. Start Snow-Flow

```bash
snow-flow
```

On first run, Snow-Flow automatically creates:
- `.mcp.json` - MCP server configuration
- `.env` - Environment variables template
- `CLAUDE.md` / `AGENTS.md` - AI instructions

### 3. Authenticate

In the TUI, type:

```
/auth
```

This opens an interactive authentication flow for:
- **LLM Provider** - Claude, GPT-4, Gemini, Ollama, etc.
- **ServiceNow** - OAuth 2.0 authentication
- **Enterprise** - Jira, Azure DevOps, Confluence (optional)

---

## ServiceNow OAuth Setup

Create an OAuth application in your ServiceNow instance:

1. Navigate to **System OAuth → Application Registry**
2. Click **New → Create an OAuth API endpoint for external clients**
3. Configure:
   - **Name**: `Snow-Flow`
   - **Redirect URL**: `http://localhost:3005/callback`
   - **Refresh Token Lifespan**: `0` (unlimited)
4. Copy **Client ID** and **Client Secret**

Add to your `.env` file:

```bash
SNOW_INSTANCE=your-instance.service-now.com
SNOW_CLIENT_ID=your-client-id
SNOW_CLIENT_SECRET=your-client-secret
```

---

## LLM Provider Configuration

Snow-Flow supports **75+ AI providers** via [models.dev](https://models.dev). Configure in `.env`:

### Claude (Recommended)

```bash
DEFAULT_LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-api03-...
```

Or use Claude Pro/Max subscription (browser-based auth via `/auth`).

### OpenAI GPT-4

```bash
DEFAULT_LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

### Google Gemini

```bash
DEFAULT_LLM_PROVIDER=google
GOOGLE_API_KEY=AIza...
```

### 100% Free - Local Ollama

```bash
# Install Ollama: https://ollama.com
ollama pull llama3.3

# Configure
DEFAULT_LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_OLLAMA_MODEL=llama3.3
```

### Other Providers

DeepSeek, Mistral, Groq, Together, Replicate, and 70+ more. See [models.dev](https://models.dev) for the full list.

---

## Commands Reference

### TUI Commands (inside Snow-Flow)

| Command | Description |
|---------|-------------|
| `/auth` | Authenticate with LLM, ServiceNow, and Enterprise |
| `/help` | Show available commands |
| `/clear` | Clear conversation history |
| `/compact` | Toggle compact output mode |
| `/exit` | Exit Snow-Flow |

### CLI Commands

```bash
snow-flow              # Start the TUI (auto-initializes on first run)
snow-flow --version    # Show Snow-Flow version
snow-flow --help       # Show help information
```

---

## Use With Any AI IDE

Snow-Flow works with any MCP-compatible AI tool:

| Tool | Config Location | Setup |
|------|-----------------|-------|
| **Snow-Flow TUI** | Built-in | Just run `snow-flow` |
| **Claude Desktop** | `~/Library/Application Support/Claude/claude_desktop_config.json` | Copy MCP config |
| **Cursor** | `.cursor/mcp.json` | Copy `.mcp.json` |
| **Windsurf** | `mcp_config.json` | Copy `.mcp.json` |
| **Continue.dev** | `~/.continue/config.json` | Add to `mcpServers` |

After running `snow-flow` once, copy the generated `.mcp.json` to your AI tool's configuration location.

---

## Local Development Workflow

Snow-Flow supports pulling ServiceNow artifacts to local files for debugging:

```
You: Pull the incident_dashboard widget to local files

Snow-Flow: Pulling widget to local files...
  Created: .snow-flow/artifacts/sp_widget/incident_dashboard/
    - template.html
    - client_script.js
    - server_script.js
    - style.scss

You: [Edit files locally with your favorite IDE]

You: Push the incident_dashboard widget back to ServiceNow

Snow-Flow: Validating changes...
  ✓ ES5 syntax valid
  ✓ Widget coherence validated
  Deploying to ServiceNow...
  ✓ Widget updated successfully
```

This workflow gives you:
- **Full IDE features** - Search, refactor, version control
- **Offline editing** - Work without constant API calls
- **Diff support** - See exactly what changed
- **Team collaboration** - Share artifacts via git

---

## MID Server Management

Snow-Flow includes tools for managing ServiceNow MID Servers for on-premise integrations and Discovery:

### Available Tools

| Tool | Description |
|------|-------------|
| `snow_configure_mid_server` | List, configure, validate, and restart MID Servers |
| `snow_test_mid_connectivity` | Test connectivity to external endpoints |
| `snow_manage_mid_capabilities` | Manage MID Server capabilities |

### Example Usage

```
You: List all MID Servers and their status

You: Test connectivity from MID-Server-01 to api.example.com:443

You: Validate and configure the new MID Server for Discovery

You: Run a full diagnostic from MID-Server-02 to our database server
```

### MID Server Actions

- **list** - List all MID Servers with status and capabilities
- **status** - Get detailed status and health score
- **configure** - Update IP address, network range, memory settings
- **validate** - Mark a MID Server as validated
- **restart** - Queue a restart command
- **assign_application** - Assign applications to MID Servers

### Connectivity Tests

- **test_endpoint** - Test HTTP/HTTPS endpoint accessibility
- **test_port** - Test TCP/UDP port connectivity
- **ping** - ICMP ping test
- **dns_lookup** - DNS resolution test
- **full_diagnostic** - Run all tests at once

---

## Enterprise Features

For teams that need external tool integrations:

### Jira Integration
- Bidirectional story/epic sync
- JQL queries from your AI assistant
- Automatic status updates
- Sprint and backlog management

### Azure DevOps Integration
- Work item sync (Stories, Tasks, Bugs)
- Pipeline status monitoring
- Pull request tracking
- Board management

### Confluence Integration
- Documentation sync
- Knowledge article generation
- Architecture diagram management
- Space and page management

### Stakeholder Seats
- Read-only access for non-developers
- Safe querying without deployment risk
- Perfect for managers and analysts

**Pricing:**
| Plan | Price | Features |
|------|-------|----------|
| **Individual** | $99/month | 1 developer, all integrations |
| **Teams** | $79/user/month | 3+ users, shared workspace |
| **Enterprise** | $49/seat/month | 25+ seats, white-label, SSO |

Start at [portal.snow-flow.dev](https://portal.snow-flow.dev)

---

## Project Structure

After running `snow-flow`:

```
your-project/
├── .env                    # Environment configuration (DO NOT COMMIT)
├── .env.example            # Template for environment variables
├── .mcp.json               # MCP server configuration
├── CLAUDE.md               # AI instructions for Claude Code
├── AGENTS.md               # AI instructions for other LLMs
├── .snow-code/             # Snow-Flow TUI configuration
│   └── config.json         # MCP servers config
├── .claude/                # Claude Code configuration
│   └── config.json         # Claude-specific MCP config
└── .snow-flow/             # Snow-Flow workspace
    ├── memory/             # Persistent agent memory
    ├── artifacts/          # Local artifact cache
    └── token-cache.json    # OAuth token cache
```

---

## Requirements

- **Node.js** 18 or higher
- **ServiceNow** instance with OAuth 2.0 configured
- **LLM Provider** - Any provider supported by [models.dev](https://models.dev)

---

## Troubleshooting

### "ServiceNow authentication failed"

1. Verify OAuth credentials in `.env`
2. Check OAuth app configuration in ServiceNow
3. Ensure redirect URL is `http://localhost:3005/callback`
4. Run `/auth` again in the TUI

### "MCP servers not loading"

1. Ensure you ran `snow-flow` at least once (creates config files)
2. Check `.mcp.json` exists in your project directory
3. Restart Snow-Flow

### "ES5 validation errors"

ServiceNow runs on Mozilla Rhino (ES5 only). Common fixes:
- Use `var` instead of `const`/`let`
- Use `function() {}` instead of arrow functions `() => {}`
- Use string concatenation instead of template literals
- Use traditional `for` loops instead of `for...of`

### "Widget coherence failed"

Ensure your widget's HTML, client script, and server script communicate properly:
- Every `data.property` in server script is used in HTML
- Every `ng-click="method()"` in HTML has matching `c.method` in client script
- Every `c.server.get({action})` has matching `if(input.action)` in server script

---

## Security

- **Credentials** - Stored locally in `.env` (git-ignored by default)
- **OAuth Tokens** - Cached locally, auto-refreshed
- **Enterprise** - JWT-based authentication, credentials never leave your machine
- **API Calls** - Direct to ServiceNow, no proxy (except Enterprise MCP features)

**Never commit `.env` files to version control.**

---

## Contributing

We welcome contributions! Snow-Flow is open source under the Elastic License 2.0.

- **Issues**: [github.com/groeimetai/snow-flow/issues](https://github.com/groeimetai/snow-flow/issues)
- **Discussions**: [github.com/groeimetai/snow-flow/discussions](https://github.com/groeimetai/snow-flow/discussions)

---

## Links

| Resource | URL |
|----------|-----|
| **npm** | [npmjs.com/package/snow-flow](https://www.npmjs.com/package/snow-flow) |
| **GitHub** | [github.com/groeimetai/snow-flow](https://github.com/groeimetai/snow-flow) |
| **Documentation** | [snow-flow.dev/docs](https://snow-flow.dev/docs) |
| **Enterprise Portal** | [portal.snow-flow.dev](https://portal.snow-flow.dev) |

---

## License

**Elastic License 2.0**

- Free to use, modify, and redistribute
- Can be used commercially
- Full source code access
- Cannot provide Snow-Flow as a managed service to third parties
- Cannot remove licensing/copyright notices

See [LICENSE](LICENSE) for full details.

---

<p align="center">
  <strong>Snow-Flow</strong> - The free, open-source ServiceNow Build Agent alternative.<br>
  Built by developers, for developers.
</p>

<p align="center">

```bash
npm install -g snow-flow && snow-flow
```

</p>
