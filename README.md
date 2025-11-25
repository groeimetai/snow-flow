<p align="center">
  <picture>
    <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="SnowCode logo" width="300">
  </picture>
</p>

<h1 align="center">SnowCode</h1>
<h3 align="center">AI-Powered ServiceNow Development IDE</h3>
<p align="center"><strong>Part of the Snow-Flow Enterprise Suite</strong></p>

<p align="center">
  <a href="https://github.com/groeimetai/snow-flow"><img alt="GitHub" src="https://img.shields.io/github/stars/groeimetai/snow-flow?style=flat-square" /></a>
  <a href="https://github.com/groeimetai/snow-flow"><img alt="Snow-Flow" src="https://img.shields.io/badge/snow--flow-350%2B%20tools-blue?style=flat-square" /></a>
  <a href="#enterprise-edition"><img alt="Enterprise" src="https://img.shields.io/badge/enterprise-available-green?style=flat-square" /></a>
</p>

# Snow-Flow

**The Free ServiceNow Build Agent Alternative**

[![npm](https://img.shields.io/npm/v/snow-flow?style=for-the-badge&logo=npm&color=CB3837)](https://www.npmjs.com/package/snow-flow)
[![License: Elastic-2.0](https://img.shields.io/badge/License-Elastic--2.0-blue.svg?style=for-the-badge)](https://www.elastic.co/licensing/elastic-license)
[![GitHub stars](https://img.shields.io/github/stars/groeimetai/snow-flow?style=for-the-badge&logo=github)](https://github.com/groeimetai/snow-flow)

**Built by developers, for developers.** Snow-Flow is an open-source ServiceNow development platform with 410+ MCP tools. Use any AI model you want - Claude, GPT-4, Gemini, Llama, or run completely free with Ollama.

---

## Get Started in 60 Seconds

```bash
# Install
npm install -g snow-flow

# Initialize (creates config files)
snow-flow init

# Authenticate (ServiceNow + optional enterprise services)
snow-flow auth login

# Start building
snow-flow swarm "create an incident dashboard widget"
```

That's it. You're now developing ServiceNow through conversation.

---

## Why Snow-Flow?

### vs ServiceNow Build Agent

| | Snow-Flow | ServiceNow Build Agent |
|---|---|---|
| **Price** | **Free** (open source) | $100-200/user/month + Pro Plus license |
| **AI Model** | **Any** - Claude, GPT-4, Gemini, Llama, Ollama | NowLLM only (locked in) |
| **Development** | **Local IDE** - VS Code, Cursor, terminal | Browser-based Studio only |
| **Enterprise Tools** | **Jira, Azure DevOps, Confluence** | ServiceNow ecosystem only |
| **Open Source** | **Yes** | No |

### What You Get

- **410+ MCP Tools** - Complete ServiceNow API coverage
- **Any LLM Provider** - Claude, GPT-4, Gemini, Mistral, DeepSeek, Groq, or free local models
- **Local Development** - Pull artifacts to local files, edit with your favorite IDE
- **Enterprise Integrations** - Jira, Azure DevOps, Confluence (paid tier)
- **ES5 Validation** - Catches Rhino engine errors before deployment
- **Update Set Management** - Automatic change tracking

---

## How It Works

Snow-Flow uses the Model Context Protocol (MCP) to give AI models direct access to ServiceNow. When you say "create an incident dashboard", the AI:

1. Creates an Update Set to track changes
2. Builds the widget (HTML, client script, server script)
3. Deploys to your ServiceNow instance
4. Validates ES5 compliance and widget coherence

All through natural conversation.

```bash
# Create widgets
snow-flow swarm "create incident dashboard with priority charts and SLA timers"

# Build automation
snow-flow swarm "create business rule to auto-assign incidents by category"

# Query data
snow-flow swarm "show me all P1 incidents from last week"

# Complex workflows
snow-flow swarm "analyze incident patterns and create a knowledge article with recommendations"
```

---

## Configuration

### ServiceNow OAuth Setup

1. In ServiceNow: **System OAuth → Application Registry → New**
2. Create OAuth endpoint with:
   - **Redirect URL**: `http://localhost:3005/callback`
   - **Refresh Token Lifespan**: `0` (unlimited)
3. Copy Client ID and Secret to `.env`:

```bash
SNOW_INSTANCE=your-instance.service-now.com
SNOW_CLIENT_ID=your-client-id
SNOW_CLIENT_SECRET=your-client-secret
```

### LLM Provider

Choose any provider:

```bash
# Claude (recommended)
DEFAULT_LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Or Claude Pro/Max subscription (no API key needed)
DEFAULT_LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=
# Then run: snow-flow auth login (opens browser)

# GPT-4
DEFAULT_LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Gemini
DEFAULT_LLM_PROVIDER=google
GOOGLE_API_KEY=...

# 100% Free - Local Ollama
DEFAULT_LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_OLLAMA_MODEL=llama3.3
```

---

## Enterprise Features

For teams that need external tool integrations:

### Jira Integration
- Sync stories/epics bidirectionally
- JQL queries from your AI assistant
- Automatic status updates
- Full workflow automation

### Azure DevOps Integration
- Work item sync (User Stories, Tasks, Bugs)
- Pipeline status integration
- Pull request tracking

### Confluence Integration
- Documentation sync
- Knowledge article generation
- Architecture diagram management

**Pricing:**
- **Individual**: $99/month (1 developer)
- **Teams**: $79/user/month (3+ users)
- **Enterprise**: $49/seat/month (25+ seats, white-label available)

Start at [portal.snow-flow.dev](https://portal.snow-flow.dev)

---

## Use With Any AI IDE

Snow-Flow works with any MCP-compatible tool:

| Tool | Setup |
|------|-------|
| **snow-code** (recommended) | Built-in, just run `snow-flow swarm` |
| **Claude Desktop** | Copy config to `claude_desktop_config.json` |
| **Cursor** | Copy config to `.cursor/mcp.json` |
| **Windsurf** | Copy config to `mcp_config.json` |
| **Continue.dev** | Copy config to `.continue/mcpServers/` |

```bash
# After snow-flow init, config is at:
cat .snow-code/config.json

# Copy to your AI tool's MCP config location
```

---

## Commands

```bash
# Core workflow
snow-flow init          # Initialize project
snow-flow auth login    # Authenticate (ServiceNow + enterprise)
snow-flow auth status   # Check authentication status
snow-flow swarm "task"  # Execute any ServiceNow task

# Direct commands
snow-flow deploy        # Deploy artifacts
snow-flow status        # System status
```

---

## Requirements

- **Node.js** 18+
- **ServiceNow** instance with OAuth configured
- **LLM Provider** - API key or Ollama for free local models

---

## Links

- **npm**: [npmjs.com/package/snow-flow](https://www.npmjs.com/package/snow-flow)
- **GitHub**: [github.com/groeimetai/snow-flow](https://github.com/groeimetai/snow-flow)
- **Enterprise Portal**: [portal.snow-flow.dev](https://portal.snow-flow.dev)
- **Issues**: [GitHub Issues](https://github.com/groeimetai/snow-flow/issues)

---

## License

Elastic License 2.0 - Free for commercial use, cannot resell as competing SaaS.

---

**Snow-Flow** - The free, open-source ServiceNow Build Agent alternative. Built by developers, for developers.

```bash
npm install -g snow-flow && snow-flow init && snow-flow auth login && snow-flow swarm "hello servicenow"
```
