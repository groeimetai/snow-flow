# 🏔️ Snow-Flow

**Multi-LLM ServiceNow Development Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/snow-flow.svg?style=for-the-badge&logo=node.js&color=339933)](https://nodejs.org)

**Develop ServiceNow through conversation • 411 Tools • 2 MCP Servers • 75+ LLM Providers • Works with ANY AI coding assistant**

---

## What is Snow-Flow?

Snow-Flow transforms ServiceNow development into a **conversational experience**. Instead of clicking through ServiceNow's web interface, you develop through natural conversation with your AI coding assistant using **any LLM provider** you prefer.

### The Problem

Traditional ServiceNow development means:
- ❌ Manual navigation through complex web UIs
- ❌ Context switching between modules
- ❌ Repetitive clicking and form filling
- ❌ Limited to browser-based development
- ❌ Locked into specific AI providers

### The Solution

Snow-Flow provides:
- ✅ **Conversational Development**: Build through natural language
- ✅ **411 ServiceNow Tools**: Complete API coverage via 2 unified MCP servers
- ✅ **75+ LLM Providers**: Claude, GPT-4o, Gemini, Llama, Mistral, DeepSeek, Groq, or ANY provider via OpenCode
- ✅ **100% Free Option**: Ollama, LM Studio, Jan - run models locally offline
- ✅ **Local Development**: Pull artifacts to local files, edit with native tools
- ✅ **Local ML Training**: TensorFlow.js neural networks (runs locally, trains on ServiceNow data)
- ✅ **Universal Compatibility**: Works with OpenCode, Claude Code, Cursor, Windsurf, Continue.dev, Cline

---

## 🚀 Quick Start (3 Minutes)

### Installation

```bash
# Install Snow-Flow globally
npm install -g snow-flow

# Initialize your project
snow-flow init
```

Snow-Flow will automatically:
- ✅ Detect and install OpenCode (recommended AI coding platform)
- ✅ Generate configuration files (`.env`, `.opencode/config.json`)
- ✅ Set up 2 MCP servers with 411 ServiceNow tools
- ✅ Create documentation (`AGENTS.md`, `README.md`)

### Configuration

```bash
# Edit .env file with your credentials
vi .env
```

**Required settings:**
```bash
# ServiceNow OAuth
SNOW_INSTANCE=your-instance.service-now.com
SNOW_CLIENT_ID=your-client-id
SNOW_CLIENT_SECRET=your-client-secret

# Choose ONE LLM provider
DEFAULT_LLM_PROVIDER=anthropic  # or openai, google, ollama, etc.

# Option 1: Claude Pro/Max (leave API key empty)
ANTHROPIC_API_KEY=

# Option 2: Pay-per-use API
ANTHROPIC_API_KEY=sk-ant-your-key

# Option 3: Free local (Ollama)
DEFAULT_LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_OLLAMA_MODEL=llama3.1
```

### Authentication

```bash
# One command authenticates EVERYTHING
snow-flow auth login
```

**What happens:**
1. **Claude Pro/Max users**: Browser opens automatically for Anthropic login
2. **API key users**: Skips to step 2
3. **ServiceNow**: Browser opens for OAuth authentication
4. **Done**: You're ready to develop!

### Start Developing

```bash
# Use Snow-Flow swarm for any ServiceNow task
snow-flow swarm "create incident dashboard widget with real-time charts"

# Or launch OpenCode with Snow-Flow tools pre-loaded
opencode
```

---

## 💡 LLM Provider Options

Snow-Flow works with **75+ LLM providers** through OpenCode and Models.dev. Choose ANY model that fits your needs!

### 🌟 Popular Providers

| Category | Providers | Cost | Best For |
|----------|-----------|------|----------|
| **🚀 Premium Cloud** | Claude (Anthropic), GPT-4o (OpenAI), Gemini (Google) | $10-100/mo | Best quality, production use |
| **💰 Cost-Effective** | Claude Haiku, GPT-4o-mini, Gemini Flash | $1-20/mo | High volume, simple tasks |
| **🆓 100% Free Local** | Ollama, LM Studio, Jan, LocalAI | $0 | Offline, privacy, unlimited use |
| **⚡ Specialized** | DeepSeek (coding), Perplexity (research), Groq (speed) | $5-50/mo | Specific use cases |
| **🏢 Enterprise** | Azure OpenAI, AWS Bedrock, GCP Vertex AI | Custom | Enterprise compliance |

### 🔓 Full Provider List (75+)

**Via OpenCode + Models.dev:**
- **Anthropic**: Claude Sonnet 4.5, Claude Haiku 4.5, Claude Opus 4.1
- **OpenAI**: GPT-5, GPT-4o, GPT-4o-mini
- **Google**: Gemini 2.0 Flash, Gemini 1.5 Pro, Gemini 1.5 Flash
- **Meta**: Llama 3.1 (8B, 70B, 405B), Llama 3.2
- **Mistral AI**: Mistral Large, Mistral Medium, Mistral Small, Codestral
- **Cohere**: Command R, Command R+
- **DeepSeek**: DeepSeek Coder, DeepSeek Chat
- **Groq**: Ultra-fast inference for Llama, Mixtral, Gemma
- **Perplexity**: Web search-enabled models
- **OpenRouter**: 200+ models aggregator
- **Local Models**: Ollama, LM Studio, Jan, LocalAI, vLLM
- **Enterprise**: Azure OpenAI, AWS Bedrock, GCP Vertex AI
- **+ 60 more providers!** See [Models.dev](https://models.dev) for complete list

### 💡 Quick Setup Examples

**Claude Pro/Max (No API key needed):**
```bash
# .env
DEFAULT_LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=  # Leave empty!

# Authenticate
snow-flow auth login  # Opens browser automatically
```

**OpenAI GPT-4o:**
```bash
# .env
DEFAULT_LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...  # From platform.openai.com
```

**100% Free Local (Ollama):**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1

# .env
DEFAULT_LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
```

**Custom/Fine-tuned Models:**
```bash
# Any OpenAI-compatible endpoint works!
DEFAULT_LLM_PROVIDER=openai-compatible
OPENAI_BASE_URL=https://your-endpoint.com/v1
OPENAI_API_KEY=your-key
```

### 🎯 Recommendations by Use Case

| Use Case | Recommended Provider | Why |
|----------|---------------------|-----|
| **Production ServiceNow Development** | Claude Sonnet 4.5 | Best reasoning, ServiceNow knowledge |
| **Cost-Optimized Development** | GPT-4o-mini or Claude Haiku 4.5 | 10x cheaper, good quality |
| **Offline/Private Development** | Ollama (Llama 3.1) | 100% free, runs locally |
| **Code Generation Focus** | DeepSeek Coder | Specialized for coding |
| **Large Context (200K+ tokens)** | Gemini 1.5 Pro | 2M token context |
| **Ultra-Fast Prototyping** | Groq (Llama 3.1) | 800+ tokens/sec |

**💡 Pro Tip:** Mix providers! Use cheap models for testing, expensive models for complex widgets.

---

## 🎯 ServiceNow OAuth Setup

Snow-Flow uses OAuth 2.0 for secure ServiceNow access:

1. **Navigate to:** System OAuth → Application Registry
2. **Click:** New → "Create an OAuth API endpoint for external clients"
3. **Configure:**
   - **Name:** `Snow-Flow Integration`
   - **Redirect URL:** `http://localhost:3005/callback` ⚠️ **Must be exact!**
   - **Refresh Token Lifespan:** `0` (unlimited)
   - **Access Token Lifespan:** `1800` (30 minutes)
4. **Save** → Copy Client ID and Client Secret
5. **Add to `.env`** (see Configuration above)

---

## 🔥 Core Features

### Conversational Development

```bash
# Create widgets through conversation
snow-flow swarm "create incident dashboard with priority charts, SLA timers, and mobile-responsive design"

# Automate data operations
snow-flow swarm "create business rule to auto-assign incidents based on category and priority"

# Train ML models conversationally
snow-flow swarm "train incident classifier on last 6 months of data"
```

### 411 ServiceNow Tools (2 MCP Servers)

**ServiceNow Unified Server (235+ tools):**
- Complete CRUD operations on any table
- Widget deployment & validation
- UI Builder components
- Business rules & client scripts
- UI actions & policies
- REST/SOAP integrations
- Security & compliance
- Native ServiceNow ML & predictive analytics integration
- Local artifact development

**Snow-Flow Orchestration (176+ tools):**
- Multi-agent coordination
- Local ML training (TensorFlow.js - runs on your machine)
- Memory management
- Performance tracking
- Task orchestration

### Local Development Bridge

```bash
# Pull ServiceNow artifacts to local files
snow_pull_artifact({ sys_id: 'widget_sys_id', table: 'sp_widget' })

# Edit locally with full AI coding assistant capabilities:
# - Multi-file search & replace
# - Advanced refactoring
# - Git integration
# - Native code navigation

# Push back with validation
snow_push_artifact({ sys_id: 'widget_sys_id' })
```

### Local ML Training (Alternative to ServiceNow PI)

**⚠️ Important:** ML training runs **locally on your machine**, not in ServiceNow. This is an alternative to ServiceNow's Predictive Intelligence (PI) license.

**How it works:**
```
1. Fetch data from ServiceNow via OAuth2 API
2. Train TensorFlow.js models locally (Node.js)
3. Models saved in .snow-flow/ml-models/
4. Make predictions locally
5. Write results back to ServiceNow via API
```

**Examples:**
```bash
# Incident classification with LSTM networks (fetches ~5000 incidents)
snow-flow swarm "train incident classifier on description and short_description fields"

# Change risk assessment (fetches historical changes)
snow-flow swarm "predict change risk for upcoming releases"

# Anomaly detection (fetches system metrics)
snow-flow swarm "detect anomalies in incident patterns"
```

**Key Differences from ServiceNow PI:**

| Feature | ServiceNow PI (Licensed) | Snow-Flow Local ML (Free) |
|---------|--------------------------|----------------------------|
| **Runs Where** | Inside ServiceNow | Locally on your machine |
| **Cost** | $$$ License required | Free (no license) |
| **Training** | Automatic in ServiceNow | Manual via CLI |
| **Models** | Stored in ServiceNow | Stored in .snow-flow/ml-models |
| **Predictions** | Native in ServiceNow | Via custom API calls |
| **Import to PI** | N/A | ❌ Not possible |
| **Auto-retrain** | ✅ Yes | ❌ Manual |
| **Production Ready** | ✅ Yes | ⚠️ Experimental |

**Best For:**
- ✅ Development/testing without PI license
- ✅ One-off analyses and predictions
- ✅ Learning ML concepts with ServiceNow data
- ❌ Production deployments (use ServiceNow PI instead)

---

## 📋 Examples

### Widget Development
```bash
snow-flow swarm "create incident dashboard with:
- Real-time counts by priority
- ML-powered trend analysis
- Interactive charts (Chart.js)
- Mobile-responsive design
- Dark mode support"
```

### Process Automation
```bash
snow-flow swarm "create business rule for incident auto-assignment with:
- Auto-categorization based on description keywords
- Priority-based assignment rules
- Team workload balancing
- Email notifications to assignees"
```

### Security Automation
```bash
snow-flow swarm "perform SOX compliance audit on:
- User access controls
- Change management ACLs
- Data encryption settings
Generate remediation plan for any issues"
```

### Data Analysis
```bash
snow-flow swarm "analyze incident management process and identify:
- Bottlenecks
- Resolution time trends
- Common root causes
Provide optimization recommendations"
```

---

## 🤖 Multi-Agent Coordination

Snow-Flow uses OpenCode's native Task() system for intelligent agent teams:

**Available Agent Types:**
- `widget-creator` - Service Portal widget development
- `security-specialist` - ACL and compliance validation
- `ml-specialist` - Machine learning model training
- `performance-optimizer` - Code and query optimization
- `integration-specialist` - REST/SOAP integrations

**Automatic coordination:**
- **Solo Mode**: Simple tasks handled directly
- **Team Mode**: Complex tasks spawn specialized agent teams
- **Parallel Execution**: Multiple agents work simultaneously

---

## 🔧 Using with Other AI Coding Assistants

Snow-Flow works with **any MCP-compatible AI coding assistant**:

| AI Assistant | How to Connect |
|-------------|----------------|
| **Cursor** | Copy `.opencode/config.json` → `.cursor/mcp.json` |
| **Windsurf** | Copy `.opencode/config.json` → `mcp_config.json` |
| **Continue.dev** | Copy `.opencode/config.json` → `.continue/mcpServers/snow-flow.json` |
| **Cline** | Copy `.opencode/config.json` → `.vscode/mcp.json` |
| **GitHub Copilot** | Copy `.opencode/config.json` → `.vscode/mcp.json` |

**Quick setup:**
```bash
# After snow-flow init, copy MCP config to your AI assistant
snow-flow init

# For Cursor
cp .opencode/config.json .cursor/mcp.json

# For Windsurf
cp .opencode/config.json mcp_config.json

# Restart your AI assistant → 411 Snow-Flow tools available!
```

---

## 📚 Advanced Configuration

### Environment Variables

See `.env.example` for all options. Key variables:

```bash
# ServiceNow
SNOW_INSTANCE=your-instance.service-now.com
SNOW_CLIENT_ID=your-client-id
SNOW_CLIENT_SECRET=your-client-secret

# LLM Provider
DEFAULT_LLM_PROVIDER=anthropic  # or openai, google, ollama

# Provider-specific
ANTHROPIC_API_KEY=  # Leave empty for Claude Pro/Max
OPENAI_API_KEY=your-key
GOOGLE_API_KEY=your-key
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1

# Snow-Flow Features
LOG_LEVEL=info
ENABLE_PERFORMANCE_TRACKING=true
ENABLE_MEMORY_SYSTEM=true
```

### Authentication Commands

```bash
# Login (handles LLM + ServiceNow)
snow-flow auth login

# Check status
snow-flow auth status

# Logout
snow-flow auth logout
```

### Common Issues

**"Could not find artifact with sys_id..."**
- Cause: OAuth token expired
- Solution: `snow-flow auth login`

**"Invalid redirect_uri"**
- Cause: Redirect URL mismatch in ServiceNow
- Solution: Ensure redirect URL is exactly `http://localhost:3005/callback`

---

## 🎓 Use Cases

### Development Teams
- **Conversational development**: Build through natural language
- **Multi-LLM flexibility**: Choose best provider per task
- **Local tool integration**: Use familiar development environments
- **Real-time validation**: Immediate feedback on artifacts

### ServiceNow Administrators
- **Universal operations**: Query and manage any table
- **Automated analysis**: ML-powered insights
- **Batch operations**: Large-scale changes efficiently
- **Cost optimization**: Use local models for routine tasks

### Solution Architects
- **Pattern recognition**: Identify and apply best practices
- **Cross-module integration**: Coordinate complex solutions
- **Risk assessment**: Analyze impact before implementation
- **Provider selection**: Choose optimal LLM per phase

---

## ⚙️ Requirements

- **Node.js**: 18.0.0 or higher
- **ServiceNow**: Any supported version
- **LLM Provider**: Any of the supported options above
- **AI Coding Assistant**: OpenCode (auto-installed) or others
- **Memory**: 4GB RAM recommended for ML training
- **Storage**: 1GB free space for models and artifacts

---

## 🆘 Support & Resources

- **Documentation**: Generated during `snow-flow init`
- **GitHub**: https://github.com/groeimetai/snow-flow
- **NPM**: https://www.npmjs.com/package/snow-flow
- **Issues**: Bug reports and feature requests welcome

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Snow-Flow: Conversational ServiceNow Development**
• 411 Tools • 2 MCP Servers • 75+ LLM Providers • Universal Compatibility

**Get started in 3 minutes:**
```bash
npm install -g snow-flow
snow-flow init
snow-flow auth login
snow-flow swarm "create incident dashboard"
```
