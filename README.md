# 🏔️ Snow-Flow

**Multi-LLM ServiceNow Development Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/snow-flow.svg?style=for-the-badge&logo=node.js&color=339933)](https://nodejs.org)

**Talk to your ServiceNow instance through OpenCode • Multi-LLM Support • 2 Unified MCP Servers • 411 ServiceNow Tools • Works with ANY AI coding assistant**

---

## What is Snow-Flow?

Snow-Flow is a multi-LLM ServiceNow development platform that connects **OpenCode** (or Claude Code) with ServiceNow through specialized MCP (Model Context Protocol) servers. Instead of navigating ServiceNow's web interface, you develop through natural conversation with your AI coding assistant, using any LLM provider you prefer.

### Why OpenCode?

**OpenCode is the recommended platform for Snow-Flow** because it supports 75+ LLM providers, giving you complete flexibility:

| Feature | OpenCode (Recommended) | Claude Code (Also Supported) |
|---------|------------------------|------------------------------|
| **LLM Support** | 75+ providers (Claude, GPT, Gemini, Local) | Claude only |
| **Claude Pro/Max** | ✅ Use your existing subscription | ✅ Use your subscription |
| **Offline/Local** | ✅ 5 options (Ollama, LM Studio, etc.) | ❌ No |
| **Cost Flexibility** | ✅ Choose provider by task | ❌ Fixed pricing |
| **Free Options** | ✅ Multiple (Ollama, LM Studio, etc.) | ❌ Requires subscription |
| **Enterprise** | ✅ Custom/fine-tuned models | ❌ Claude only |

### Core Architecture

- **OpenCode Integration**: Native multi-agent coordination via Task() system
- **Unified MCP Servers**: 2 consolidated servers with 411 tools for complete ServiceNow access
- **Local Development Bridge**: Edit ServiceNow artifacts locally with native development tools
- **Machine Learning**: TensorFlow.js neural networks for ServiceNow data analysis
- **Conversational Interface**: Develop ServiceNow solutions through natural language
- **Multi-LLM Support**: Use ANY LLM provider - Claude, GPT, Gemini, or local models

### Key Capabilities

- **Universal ServiceNow Operations**: Query any table, manage incidents, deploy widgets
- **Local Artifact Editing**: Pull ServiceNow artifacts to local files, edit with native tools, push back
- **Multi-Agent Coordination**: OpenCode's native Task() system for complex workflows
- **Real Machine Learning**: Neural networks for incident classification and anomaly detection
- **Comprehensive API Coverage**: 411 tools across all major ServiceNow modules
- **Provider Flexibility**: Use Claude Pro, GPT-4o, local models, or any LLM provider

---

## 🚀 Quick Start

### Choose Your LLM Provider (5 Options)

Snow-Flow works with **any LLM provider**. Pick the option that fits your needs:

#### Option 1: Claude Pro/Max Subscription (Recommended if you have it)
**⭐ Use your EXISTING Claude Pro ($20/month) or Max ($40/month) subscription**
- ✅ No API key needed - OpenCode logs in with your Anthropic account
- ✅ No additional costs beyond your existing subscription
- ✅ Same Claude models, same quality, just via OpenCode

```bash
# .env configuration
DEFAULT_LLM_PROVIDER=anthropic
DEFAULT_ANTHROPIC_MODEL=claude-sonnet-4
ANTHROPIC_API_KEY=  # Leave empty - OpenCode will prompt login
```

#### Option 2: Pay-Per-Use APIs (No subscription)
**Use any cloud LLM provider with API keys**
- Claude API: $3/$15 per 1M tokens
- OpenAI GPT-4o: $2.50/$10 per 1M tokens
- Google Gemini Pro: $1.25/$5 per 1M tokens
- Groq (ultra-fast): FREE tier available

```bash
# .env configuration
DEFAULT_LLM_PROVIDER=anthropic  # or openai, google, groq, mistral
DEFAULT_ANTHROPIC_MODEL=claude-sonnet-4
ANTHROPIC_API_KEY=your-api-key  # Get from console.anthropic.com
```

#### Option 3: 100% Free with Ollama (Offline, Private)
**Run models locally on your machine - completely free and private**
- Install: https://ollama.com
- Popular models: llama3.1, llama3.2, codellama, mistral, deepseek-coder
- 100% FREE • 100% OFFLINE • 100% PRIVATE

```bash
# Install and start Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1
ollama serve

# .env configuration
DEFAULT_LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_OLLAMA_MODEL=llama3.1
```

#### Option 4: LM Studio (GUI + Local)
**Desktop app for local LLMs with beautiful GUI - easiest local option**
- Download: https://lmstudio.ai
- Supports: Llama 3.2, Mistral, Phi, Gemma, DeepSeek, Qwen 2.5
- No coding needed - point and click interface

```bash
# Start LM Studio, download a model, start server on port 1234

# .env configuration
DEFAULT_LLM_PROVIDER=openai  # LM Studio mimics OpenAI API
OPENAI_BASE_URL=http://localhost:1234/v1
DEFAULT_OPENAI_MODEL=llama-3.1-8b
```

#### Option 5: High-Performance Local (vLLM, LocalAI)
**Production-grade local inference - 2-4x faster than Ollama**
- vLLM: Ultra-fast inference server
- LocalAI: Most versatile, supports images + audio

```bash
# vLLM - Ultra-fast inference
pip install vllm
python -m vllm.entrypoints.openai.api_server --model llama3.1

# OR LocalAI - Most versatile
docker run -p 8080:8080 localai/localai

# .env configuration
DEFAULT_LLM_PROVIDER=openai
OPENAI_BASE_URL=http://localhost:8000/v1  # vLLM or http://localhost:8080/v1 for LocalAI
DEFAULT_OPENAI_MODEL=llama3.1
```

### Installation

```bash
# 1. Install OpenCode (recommended)
npm install -g opencode-ai

# OR use Claude Code (also supported)
# Download from: https://claude.com/claude-code

# 2. Install Snow-Flow
npm install -g snow-flow
```

### Setup

```bash
# 1. Initialize Snow-Flow
snow-flow init

# 2. Configure .env with your credentials
cp .env.example .env
# Edit .env with:
#   - ServiceNow credentials (OAuth)
#   - LLM provider selection (see 5 options above)
#   - API keys (if using pay-per-use providers)

# 3. Import OpenCode configuration (if using OpenCode)
opencode config import opencode-config.example.json

# 4. Authenticate with ServiceNow
snow-flow auth login
```

### Start Developing

```bash
# Use snow-flow swarm for any ServiceNow development task
snow-flow swarm "create incident dashboard widget with real-time charts"
```

OpenCode (or Claude Code) will automatically:
- ✅ Connect to Snow-Flow's 411 ServiceNow tools
- ✅ Use your configured LLM (Claude, GPT, Gemini, or local)
- ✅ Create real artifacts in ServiceNow
- ✅ Coordinate multiple agents for complex tasks

---

## 🎯 Quick Decision Guide

**Which LLM provider should you use?**

| Your Situation | Recommended Option | Monthly Cost |
|----------------|-------------------|--------------|
| Have Claude Pro/Max already | Option 1 (Claude Pro/Max) | $20-40 (existing) |
| Want best quality | Option 2 (Claude Sonnet 4 API) | ~$30-100 (usage) |
| Want 100% free | Option 3 (Ollama) or 4 (LM Studio) | $0 |
| Want offline/private | Option 3, 4, or 5 (all local) | $0 |
| Want performance | Option 5 (vLLM) | $0 |
| Want easiest setup | Option 4 (LM Studio GUI) | $0 |

**💡 Pro Tip:** Use Claude Pro/Max if you already have it (no extra cost!), or start with Ollama/LM Studio for free local development.

---

## Authentication

### ServiceNow OAuth Setup

Snow-Flow uses OAuth 2.0 Authorization Code Flow with browser authentication:

1. **Navigate to:** System OAuth → Application Registry
2. **Click:** New → **"Create an OAuth API endpoint for external clients"**
3. **Configure OAuth Application:**
   - **Name:** `Snow-Flow Integration`
   - **Redirect URL:** `http://localhost:3005/callback` ⚠️ **MUST be exactly this!**
   - **Refresh Token Lifespan:** `0` (unlimited - recommended)
   - **Access Token Lifespan:** `1800` (30 minutes)
4. **Save** - ServiceNow will generate:
   - Client ID (copy this)
   - Client Secret (copy this - shown only once!)
5. **Create `.env` file:**
   ```bash
   SNOW_INSTANCE=your-instance.service-now.com
   SNOW_CLIENT_ID=<your_client_id>
   SNOW_CLIENT_SECRET=<your_client_secret>

   # Choose your LLM provider (see 5 options above)
   DEFAULT_LLM_PROVIDER=anthropic
   DEFAULT_ANTHROPIC_MODEL=claude-sonnet-4
   ANTHROPIC_API_KEY=  # Leave empty for Claude Pro/Max subscription
   ```
6. **Run:** `snow-flow auth login`
   - Opens browser for ServiceNow login
   - Stores OAuth tokens locally

### Authentication Commands

```bash
# Login to ServiceNow
snow-flow auth login

# Check authentication status
snow-flow auth status

# Logout
snow-flow auth logout
```

### Common Authentication Issues

**❌ "Could not find artifact with sys_id xyz..."**
- **Real cause:** OAuth token expired
- **Solution:** `snow-flow auth login`

**❌ "Invalid redirect_uri"**
- **Cause:** Redirect URL mismatch in ServiceNow OAuth config
- **Solution:** Ensure redirect URL is exactly `http://localhost:3005/callback`

---

## Core Features

### 🤖 Multi-Agent Coordination

Snow-Flow uses OpenCode's native Task() system for intelligent agent coordination:
- **Solo Mode**: Simple tasks handled directly
- **Team Mode**: Complex tasks spawn specialized agent teams
- **Parallel Execution**: Multiple agents work simultaneously

**Available Agent Types:**
- `widget-creator` - Service Portal widget development
- `security-specialist` - ACL and compliance validation
- `ml-specialist` - Machine learning model training
- `performance-optimizer` - Code and query optimization
- `integration-specialist` - REST/SOAP integrations

### 🧠 Machine Learning Integration

Snow-Flow includes TensorFlow.js neural networks for ServiceNow data analysis:

```bash
# Train ML models conversationally
snow-flow swarm "train incident classifier on last 6 months of data"
snow-flow swarm "predict change risk for upcoming release"
snow-flow swarm "detect anomalies in incident patterns"
```

**ML Capabilities:**
- **Incident Classification**: LSTM networks for categorizing incidents
- **Change Risk Assessment**: Neural networks for change management
- **Anomaly Detection**: Autoencoder models for unusual patterns
- **Time Series Analysis**: Forecasting ServiceNow metrics

### 📦 MCP Server Architecture

**2 Unified MCP Servers (411 Tools):**

1. **ServiceNow Unified Server (235+ tools)**
   - Complete ServiceNow operations
   - Deployment & automation
   - Platform development
   - Integrations & properties
   - Security & compliance
   - Reporting & analytics
   - ML & AI capabilities
   - Knowledge & catalog
   - Change management
   - Virtual agent & flows
   - Workspaces & mobile
   - UI Builder & CMDB
   - Events, HR, CSM, DevOps
   - Local artifact development

2. **Snow-Flow Orchestration Server (176+ tools)**
   - Swarm coordination (swarm_init, agent_spawn)
   - Task orchestration
   - Neural network training (TensorFlow.js)
   - Memory management (memory_search, memory_usage)
   - Performance tracking
   - Agent discovery

**Essential Tools:**
- `snow_query_table` - Query any ServiceNow table
- `snow_pull_artifact` - Pull artifacts to local files
- `snow_deploy` - Deploy widgets and artifacts
- `snow_update` - Update existing artifacts
- `ml_train_incident_classifier` - Train neural networks
- `snow_execute_script_with_output` - Execute background scripts
- `swarm_init` - Initialize multi-agent swarms
- `agent_spawn` - Create specialized agents

### 🔧 Local Development Workflow

Snow-Flow bridges ServiceNow with local development tools:

```bash
# Pull any ServiceNow artifact to local files
snow_pull_artifact({ sys_id: 'widget_sys_id', table: 'sp_widget' })

# Edit locally using your AI coding assistant's native tools:
# - Full search and replace across all files
# - Multi-file editing and refactoring
# - Git integration and version control
# - Advanced code navigation

# Push changes back with validation
snow_push_artifact({ sys_id: 'widget_sys_id' })
```

**Local Development Features:**
- **Native Editing**: Use full AI coding assistant capabilities
- **File-based Development**: Work with artifacts as local files
- **Validation**: Coherence checking before pushing to ServiceNow
- **Version Control**: Integrate with Git workflows
- **Multi-artifact Support**: Widgets, scripts, flows, and more

---

## Architecture

### OpenCode Native Multi-Agent System

```
OpenCode (or Claude Code)
├── Task() system for multi-agent coordination
├── 75+ LLM provider support (OpenCode)
├── MCP server integration (411 tools)
├── Intelligent task routing
└── Resource optimization
```

### MCP Server Integration

```
Snow-Flow
├── ServiceNow Unified Server (235+ tools)
│   ├── Deployment (snow_deploy, snow_update)
│   ├── Operations (snow_query_table, CRUD)
│   ├── Automation (scripts, business rules)
│   ├── Platform Dev (UI pages, script includes)
│   ├── Integrations (REST, SOAP)
│   ├── Local Sync (pull/push artifacts)
│   └── Advanced (ML, UI Builder, workspaces)
│
└── Snow-Flow Orchestration (176+ tools)
    ├── Swarm (swarm_init, agent_spawn)
    ├── Memory (memory_search, memory_usage)
    ├── Neural (neural_train, neural_patterns)
    └── Performance (performance_report, token_usage)
```

---

## Examples

### Widget Development

```bash
snow-flow swarm "create incident dashboard with real-time counts by priority, ML-powered trend analysis, interactive charts, filtering, and mobile-responsive design"
```

### Process Mining

```bash
snow-flow swarm "analyze incident management process and provide optimization recommendations"
```

### Security Automation

```bash
snow-flow swarm "perform SOX compliance audit and generate remediation plan"
```

### Machine Learning

```bash
snow-flow swarm "train LSTM neural network to classify incidents by category based on description and short_description fields"
```

---

## Configuration

### Environment Variables

See `.env.example` for complete configuration options. Key variables:

```bash
# ============================================
# ServiceNow Configuration
# ============================================
SNOW_INSTANCE=your-instance.service-now.com
SNOW_CLIENT_ID=your-client-id
SNOW_CLIENT_SECRET=your-client-secret

# ============================================
# LLM Provider Selection
# ============================================
DEFAULT_LLM_PROVIDER=anthropic  # or openai, google, ollama, etc.

# ============================================
# Provider Options (choose one)
# ============================================

# Option 1: Claude Pro/Max Subscription
ANTHROPIC_API_KEY=  # Leave empty - OpenCode will prompt login

# Option 2: Pay-Per-Use API
ANTHROPIC_API_KEY=sk-ant-your-key
# OR
OPENAI_API_KEY=sk-your-key
GOOGLE_API_KEY=your-key

# Option 3: Ollama (Local)
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_OLLAMA_MODEL=llama3.1

# Option 4: LM Studio (Local)
OPENAI_BASE_URL=http://localhost:1234/v1
DEFAULT_OPENAI_MODEL=llama-3.1-8b

# Option 5: vLLM/LocalAI (Local)
OPENAI_BASE_URL=http://localhost:8000/v1
DEFAULT_OPENAI_MODEL=llama3.1
```

### OpenCode Configuration

Snow-Flow includes `opencode-config.example.json` with both MCP servers pre-configured:

```bash
# Import configuration
opencode config import opencode-config.example.json

# Or manually copy
cp opencode-config.example.json ~/.opencode/config.json
```

---

## Use Cases

### Development Teams
- **Conversational Development**: Build ServiceNow solutions through natural language
- **Local Tool Integration**: Use familiar development environments
- **Multi-agent Coordination**: Complex tasks handled by specialized agents
- **Real-time Validation**: Immediate feedback on ServiceNow artifacts
- **Multi-LLM Flexibility**: Use different providers for different tasks

### ServiceNow Administrators
- **Universal Operations**: Query and manage any ServiceNow table
- **Automated Analysis**: ML-powered insights from ServiceNow data
- **Batch Operations**: Handle large-scale operations efficiently
- **Process Intelligence**: Understand workflows through data analysis
- **Cost Optimization**: Use local models for routine tasks

### Solution Architects
- **Conversational Architecture**: Design solutions through AI discussion
- **Pattern Recognition**: Identify and apply best practices automatically
- **Cross-module Integration**: Coordinate development across modules
- **Risk Assessment**: Analyze impact of changes before implementation
- **Provider Selection**: Choose best LLM for each architecture phase

---

## Requirements

- **Node.js**: 18.0.0 or higher
- **ServiceNow**: Any supported version
- **AI Coding Assistant**: OpenCode (recommended) or Claude Code
- **LLM Provider**: Any of the 5 options above
- **Memory**: 4GB RAM recommended for ML training
- **Storage**: 1GB free space for models and artifacts

---

## Support & Resources

- **Documentation**: Comprehensive guides included
- **GitHub**: https://github.com/groeimetai/snow-flow
- **NPM**: https://www.npmjs.com/package/snow-flow
- **Issues**: Bug reports and feature requests welcome
- **OpenCode**: https://opencode.ai
- **Claude Code**: https://claude.com/claude-code

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Snow-Flow: Multi-LLM ServiceNow development through OpenCode** • 411 Tools • 2 MCP Servers • Any LLM Provider
