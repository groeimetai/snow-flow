<p align="center">
  <picture>
    <img src="apps/website/public/logo.svg" alt="Snow-Flow logo" width="300">
  </picture>
</p>

<pre align="center">
    ▲  ▲        █▀▀▀ █▀▀▄ █▀▀█ █   █   █▀▀▀ █▀▀█ █▀▀▄ █▀▀▀
   ▲ ▼▲ ▼▲      ▀▀▀█ █  █ █  █ █ █ █   █    █  █ █  █ █▀▀
  ▲ ▼  ▼  ▼     ▀▀▀▀ ▀  ▀ ▀▀▀▀ ▀▀▀▀▀   ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀
</pre>

<h3 align="center">AI-Powered ServiceNow Development Platform</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/snow-flow"><img alt="npm" src="https://img.shields.io/npm/v/snow-flow?style=flat-square&logo=npm&color=CB3837" /></a>
  <a href="https://github.com/groeimetai/snow-flow"><img alt="GitHub stars" src="https://img.shields.io/github/stars/groeimetai/snow-flow?style=flat-square&logo=github" /></a>
  <a href="https://www.elastic.co/licensing/elastic-license"><img alt="License" src="https://img.shields.io/badge/license-Elastic--2.0-blue?style=flat-square" /></a>
  <a href="https://snow-flow.dev/en/mcp-reference"><img alt="Tools" src="https://img.shields.io/badge/MCP_tools-379+-purple?style=flat-square" /></a>
  <a href="https://portal.snow-flow.dev"><img alt="Enterprise" src="https://img.shields.io/badge/enterprise-available-green?style=flat-square" /></a>
</p>

<p align="center">
  <strong>The Open-Source ServiceNow Build Agent Alternative</strong><br>
  379+ MCP tools | 75+ LLM providers | Any IDE | 100% open source
</p>

<p align="center">
  <a href="https://snow-flow.dev/en/docs">Quick Start</a> •
  <a href="https://snow-flow.dev/en/mcp-reference">MCP Tools</a> •
  <a href="https://snow-flow.dev/en/tui-guide">TUI Guide</a> •
  <a href="https://snow-flow.dev/en/cli-reference">CLI Reference</a> •
  <a href="https://snow-flow.dev/en/oauth-setup">OAuth Setup</a> •
  <a href="https://portal.snow-flow.dev">Enterprise</a>
</p>

---

## Quick Start

```bash
# Install
npm install -g snow-flow

# Start the TUI
snow-flow

# Authenticate (in the TUI)
/auth
```

That's it. Snow-Flow auto-initializes on first run and guides you through authentication with ServiceNow and your preferred LLM provider.

---

## What is Snow-Flow?

Snow-Flow is an **open-source** AI development platform for ServiceNow. It uses the **Model Context Protocol (MCP)** to give AI assistants direct access to your ServiceNow instance through **379+ specialized tools**.

**Talk to your ServiceNow instance in plain English:**

```
> Create a dashboard widget showing P1 incidents with SLA countdown timers

> Build a business rule to auto-assign incidents based on category

> Show me all incidents assigned to my team from the last week

> Create a knowledge article explaining the password reset process
```

Snow-Flow handles everything: Update Set creation, ES5 validation, widget coherence checks, and deployment.

---

## Why Snow-Flow?

### vs ServiceNow Build Agent

| Feature | Snow-Flow | ServiceNow Build Agent |
|---------|-----------|------------------------|
| **Cost** | **Free** (open source) | $150K-$4.5M implementation |
| **AI Model** | **75+ providers** - Claude, GPT-4, Gemini, DeepSeek, Ollama | NowLLM only |
| **Development** | **Any IDE** - VS Code, Cursor, terminal, JetBrains | Browser-based Studio |
| **Integrations** | Jira, Azure DevOps, Confluence, GitHub | ServiceNow only |
| **Source Code** | 100% open source | Proprietary |
| **Self-hosted** | Yes | No |
| **Architecture** | Multi-agent orchestration | Single agent |

### Key Features

- **379+ MCP Tools** - Complete ServiceNow coverage across 15 categories
- **Any LLM Provider** - Claude, GPT-4, Gemini, DeepSeek, Llama, or free with Ollama
- **Built-in TUI** - Interactive terminal interface with keyboard shortcuts
- **ES5 Validation** - Catches Rhino engine errors before deployment
- **Update Set Management** - Automatic change tracking
- **Widget Coherence** - Validates HTML/Client/Server communication
- **Local Development** - Pull artifacts to local files, edit with your IDE, push back
- **Multi-IDE Support** - Claude Desktop, Cursor, Windsurf, Continue.dev

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

---

## MCP Tools Overview

Snow-Flow provides **379 tools** across **15 categories**:

| Category | Tools | Read | Write | Description |
|----------|-------|------|-------|-------------|
| **Platform Development** | 78 | 25 | 53 | Script includes, client scripts, UI development |
| **Automation** | 57 | 24 | 33 | Script execution, scheduled jobs, events |
| **Advanced AI/ML** | 52 | 44 | 8 | Classification, anomaly detection, predictions |
| **ITSM** | 45 | 17 | 28 | Incident, change, problem management |
| **Integration** | 33 | 13 | 20 | REST messages, transform maps, import sets |
| **Core Operations** | 30 | 14 | 16 | CRUD operations, queries, bulk operations |
| **UI Frameworks** | 19 | 4 | 15 | Portal widgets, UI pages, forms |
| **Security** | 18 | 9 | 9 | ACLs, policies, compliance |
| **CMDB** | 14 | 10 | 4 | CI management, relationships, discovery |
| **Reporting** | 10 | 3 | 7 | Reports, dashboards, KPIs |
| **UI Builder** | 9 | 2 | 7 | Now Experience components |
| **Asset Management** | 8 | 1 | 7 | Asset lifecycle, contracts |
| **Performance Analytics** | 3 | 2 | 1 | PA indicators, breakdowns |
| **ML Analytics** | 2 | 2 | 0 | Native ML features |
| **Workspace** | 1 | 0 | 1 | Agent Workspace config |

**Browse all tools:** [snow-flow.dev/en/mcp-reference](https://snow-flow.dev/en/mcp-reference)

---

## Setup Guide

### 1. Install Snow-Flow

```bash
npm install -g snow-flow
```

### 2. Start the TUI

```bash
snow-flow
```

On first run, Snow-Flow automatically creates:
- `.mcp.json` - MCP server configuration
- `CLAUDE.md` / `AGENTS.md` - AI instructions

### 3. Authenticate

In the TUI, type `/auth` to authenticate:

1. **LLM Provider** - Claude, GPT-4, Gemini, Ollama, etc.
2. **ServiceNow** - OAuth 2.0 (requires OAuth app in ServiceNow)

**Detailed OAuth setup:** [snow-flow.dev/en/oauth-setup](https://snow-flow.dev/en/oauth-setup)

---

## ServiceNow OAuth Setup

Create an OAuth application in your ServiceNow instance:

1. Navigate to **System OAuth → Application Registry**
2. Click **New → Create an OAuth API endpoint for external clients**
3. Configure:
   - **Name**: `Snow-Flow`
   - **Redirect URL**: `http://localhost:3005/callback`
4. Copy **Client ID** and **Client Secret**

In Snow-Flow TUI:
```
/auth
```

Follow the prompts to enter your instance URL and OAuth credentials.

---

## LLM Provider Configuration

Snow-Flow supports **75+ AI providers**. Configure via environment variables or `/auth`:

### Claude (Recommended)

```bash
export ANTHROPIC_API_KEY=sk-ant-api03-...
```

Or use Claude Pro/Max subscription via browser auth.

### OpenAI

```bash
export OPENAI_API_KEY=sk-...
```

### Google Gemini

```bash
export GOOGLE_API_KEY=AIza...
```

### 100% Free - Local Ollama

```bash
# Install: https://ollama.com
ollama pull llama3.3

export OLLAMA_BASE_URL=http://localhost:11434
```

---

## TUI Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+X` | Leader key (prefix for commands) |
| `Tab` | Switch to next agent |
| `F2` | Cycle through recent models |
| `Enter` | Submit message |
| `Shift+Enter` | Insert newline |
| `Esc` | Interrupt operation |
| `Ctrl+X H` | Show help |
| `Ctrl+X N` | New session |
| `Ctrl+X M` | List models |

**Full keyboard reference:** [snow-flow.dev/en/tui-guide](https://snow-flow.dev/en/tui-guide)

---

## CLI Commands

```bash
snow-flow                    # Start TUI
snow-flow auth login         # Authenticate
snow-flow auth list          # Show auth status
snow-flow sessions list      # List sessions
snow-flow config show        # Show configuration
snow-flow models             # List available models
snow-flow run "prompt"       # Run single prompt
snow-flow stats              # Show usage stats
```

**Full CLI reference:** [snow-flow.dev/en/cli-reference](https://snow-flow.dev/en/cli-reference)

---

## Use With Any AI IDE

Snow-Flow works with any MCP-compatible tool:

| Tool | Setup |
|------|-------|
| **Snow-Flow TUI** | Built-in, just run `snow-flow` |
| **Claude Desktop** | Copy `.mcp.json` to `~/Library/Application Support/Claude/` |
| **Cursor** | Copy to `.cursor/mcp.json` |
| **Windsurf** | Copy to `mcp_config.json` |
| **Continue.dev** | Add to `~/.continue/config.json` |

---

## Local Development Workflow

Pull ServiceNow artifacts for local editing:

```
> Pull the incident_dashboard widget to local files

Snow-Flow: Pulling widget...
  Created: .snow-flow/artifacts/sp_widget/incident_dashboard/
    - template.html
    - client_script.js
    - server_script.js
    - style.scss

# Edit files with your IDE...

> Push the incident_dashboard widget back to ServiceNow

Snow-Flow: Validating...
  ✓ ES5 syntax valid
  ✓ Widget coherence validated
  Deploying...
  ✓ Widget updated
```

---

## Enterprise Features

For teams needing external integrations:

| Integration | Features |
|-------------|----------|
| **Jira** | Bidirectional sync, JQL queries, sprint management |
| **Azure DevOps** | Work items, pipelines, PR tracking |
| **Confluence** | Documentation sync, KB generation |
| **Stakeholder Seats** | Read-only access for managers/analysts |

**Pricing:**

| Plan | Price | Users |
|------|-------|-------|
| Individual | $29/mo | 1 developer |
| Teams | $99/user/mo | 3+ users |
| Enterprise | Custom | 25+ seats, SSO, white-label |

**Start:** [portal.snow-flow.dev](https://portal.snow-flow.dev)

---

## Project Structure

```
your-project/
├── .env                    # Credentials (git-ignored)
├── .mcp.json               # MCP server configuration
├── CLAUDE.md               # AI instructions
└── .snow-flow/
    ├── artifacts/          # Local artifact cache
    └── token-cache.json    # OAuth tokens
```

---

## Troubleshooting

### "ServiceNow authentication failed"

1. Verify OAuth app in ServiceNow has Redirect URL: `http://localhost:3005/callback`
2. Check Client ID and Client Secret
3. Run `/auth` again

### PDI (Personal Developer Instance) OAuth fails

For PDI instances, you need to enable the OAuth client credentials grant type:

1. Navigate to **System Properties → All**
2. Create a new property: `glide.oauth.inbound.client.credential.grant_type.enabled`
3. Set value to: `true`
4. Run `/auth` again

### "ES5 validation errors"

ServiceNow uses Rhino (ES5). Use:
- `var` instead of `const`/`let`
- `function(){}` instead of `() => {}`
- String concatenation instead of template literals

### "Widget coherence failed"

Ensure HTML/client/server scripts communicate:
- Every `data.property` in server is used in HTML
- Every `ng-click="method()"` has matching `c.method` in client
- Every `c.server.get({action})` has matching handler in server

---

## Documentation

| Resource | URL |
|----------|-----|
| **Quick Start** | [snow-flow.dev/en/docs](https://snow-flow.dev/en/docs) |
| **MCP Tools Reference** | [snow-flow.dev/en/mcp-reference](https://snow-flow.dev/en/mcp-reference) |
| **TUI Guide** | [snow-flow.dev/en/tui-guide](https://snow-flow.dev/en/tui-guide) |
| **CLI Reference** | [snow-flow.dev/en/cli-reference](https://snow-flow.dev/en/cli-reference) |
| **OAuth Setup** | [snow-flow.dev/en/oauth-setup](https://snow-flow.dev/en/oauth-setup) |
| **Enterprise Portal** | [portal.snow-flow.dev](https://portal.snow-flow.dev) |
| **GitHub** | [github.com/groeimetai/snow-flow](https://github.com/groeimetai/snow-flow) |
| **npm** | [npmjs.com/package/snow-flow](https://www.npmjs.com/package/snow-flow) |

---

## Contributing

We welcome contributions! Snow-Flow is open source under the Elastic License 2.0.

- **Issues**: [github.com/groeimetai/snow-flow/issues](https://github.com/groeimetai/snow-flow/issues)
- **Discussions**: [github.com/groeimetai/snow-flow/discussions](https://github.com/groeimetai/snow-flow/discussions)

---

## License

**Elastic License 2.0**

- Free to use, modify, and redistribute
- Commercial use allowed
- Full source code access
- Cannot provide as a managed service to third parties

See [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Snow-Flow</strong> - Break free from vendor lock-in.<br>
  Use YOUR AI. Keep your freedom.
</p>

<p align="center">

```bash
npm install -g snow-flow && snow-flow
```

</p>
