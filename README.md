# 🏔️ Snow-Flow

**Multi-LLM ServiceNow Development Platform**

[![License: Elastic-2.0](https://img.shields.io/badge/License-Elastic--2.0-blue.svg?style=for-the-badge)](https://www.elastic.co/licensing/elastic-license)
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
- ✅ **75+ LLM Providers**: Claude, GPT-4o, Gemini, Llama, Mistral, DeepSeek, Groq, or ANY provider via SnowCode
- ✅ **100% Free Option**: Ollama, LM Studio, Jan - run models locally offline
- ✅ **Local Development**: Pull artifacts to local files, edit with native tools
- ✅ **Local ML Training**: TensorFlow.js neural networks (runs locally, trains on ServiceNow data)
- ✅ **Universal Compatibility**: Works with SnowCode, Claude Code, Cursor, Windsurf, Continue.dev, Cline

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
- ✅ Detect and install SnowCode (recommended AI coding platform)
- ✅ Generate configuration files (`.env`, `.snowcode/config.json`)
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
DEFAULT_OLLAMA_MODEL=llama3.3
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

### SnowCode Setup

For detailed SnowCode configuration (MCP servers, environment variables, troubleshooting), see:

📖 **[SNOWCODE-SETUP.md](SNOWCODE-SETUP.md)** - Complete SnowCode configuration guide

**Quick checklist:**
- ✅ Use `"environment"` (not `"env"`) in `snowcode-config.json`
- ✅ Run `npm run build` to create `dist/` directory
- ✅ Verify MCP servers load when SnowCode starts
- ✅ Test tools actually execute (not just show code snippets)

### Start Developing

```bash
# Use Snow-Flow swarm for any ServiceNow task
snow-flow swarm "create incident dashboard widget with real-time charts"

# Or launch SnowCode with Snow-Flow tools pre-loaded
snowcode
```

---

## 💡 LLM Provider Options

Snow-Flow works with **75+ LLM providers** through SnowCode and Models.dev. Choose ANY model that fits your needs!

### 🌟 Popular Providers

| Category | Providers | Cost | Best For |
|----------|-----------|------|----------|
| **🚀 Premium Cloud** | Claude (Anthropic), GPT-4o (OpenAI), Gemini (Google) | $10-100/mo | Best quality, production use |
| **💰 Cost-Effective** | Claude Haiku, GPT-4o-mini, Gemini Flash | $1-20/mo | High volume, simple tasks |
| **🆓 100% Free Local** | Ollama, LM Studio, Jan, LocalAI | $0 | Offline, privacy, unlimited use |
| **⚡ Specialized** | DeepSeek (coding), Perplexity (research), Groq (speed) | $5-50/mo | Specific use cases |
| **🏢 Enterprise** | Azure OpenAI, AWS Bedrock, GCP Vertex AI | Custom | Enterprise compliance |

### 🔓 Full Provider List (75+)

**Via SnowCode + Models.dev:**
- **Anthropic**: Claude Sonnet 4.5, Claude Haiku 4.5, Claude Opus 4.1
- **OpenAI**: GPT-5, GPT-4o, GPT-4o-mini
- **Google**: Gemini 2.0 Flash, Gemini 2.5 Pro, Gemini 2.5 Flash
- **Meta**: Llama 3.3 (8B, 70B), Llama 3.2, Llama 3.1 (405B)
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
ollama pull llama3.3

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
| **Offline/Private Development** | Ollama (Llama 3.3) | 100% free, runs locally |
| **Code Generation Focus** | DeepSeek Coder | Specialized for coding |
| **Large Context (200K+ tokens)** | Gemini 2.5 Pro | 2M token context |
| **Ultra-Fast Prototyping** | Groq (Llama 3.3/Mixtral) | 800+ tokens/sec |

**💡 Pro Tip:** Mix providers! Use cheap models for testing, expensive models for complex widgets.

---

## 🎯 ServiceNow OAuth Setup

Snow-Flow uses OAuth 2.0 with localhost callback for secure ServiceNow access:

### Step 1: Create OAuth Application in ServiceNow

1. **Log into ServiceNow** as administrator
2. **Navigate to:** System OAuth → Application Registry
3. **Click:** New → "Create an OAuth API endpoint for external clients"
4. **Configure the following fields:**
   - **Name:** `Snow-Flow Integration`
   - **Redirect URL:** `http://localhost:3005/callback` ⚠️ **CRITICAL: Must be exactly this!**
   - **Refresh Token Lifespan:** `0` (unlimited)
   - **Access Token Lifespan:** `1800` (30 minutes)
5. **Save** the application
6. **Copy** the generated Client ID and Client Secret

### Step 2: Add Credentials to Environment

Add the credentials to your `.env` file:

```bash
SNOW_INSTANCE=your-instance.service-now.com
SNOW_CLIENT_ID=your-client-id-from-step-1
SNOW_CLIENT_SECRET=your-client-secret-from-step-1
```

### Step 3: Authenticate

```bash
snow-flow auth login
```

**What happens:**
1. Snow-Flow starts a temporary localhost server on port 3005
2. Your browser opens automatically to ServiceNow's OAuth page
3. You click "Allow" to authorize Snow-Flow
4. **Choose one option:**
   - **Option A (Automatic):** Browser redirects back to localhost automatically
   - **Option B (Manual):** Copy the callback URL from browser and paste it in the terminal
5. Snow-Flow exchanges the code for access tokens
6. Done! All MCP servers are now authenticated

**Manual URL paste option:**
If the browser doesn't redirect automatically, or you prefer manual control:
1. After clicking "Allow" in ServiceNow, your browser redirects to a URL like:
   ```
   http://localhost:3005/callback?code=abc123&state=xyz789
   ```
2. Copy this ENTIRE URL from your browser address bar
3. Paste it in the Snow-Flow terminal when prompted
4. Snow-Flow will extract the code and complete authentication

### ⚠️ Troubleshooting

**Error: "Invalid redirect_uri"**

This means the redirect URL in your ServiceNow OAuth application doesn't match. Fix it:

1. Go to: System OAuth → Application Registry
2. Find your Snow-Flow application (search for the Client ID)
3. Edit the **Redirect URL** field
4. Change it to: `http://localhost:3005/callback` (exactly this, no typos!)
5. Save and try `snow-flow auth login` again

**Error: "Port 3005 is already in use"**

Another application is using port 3005. Fix it:

1. Stop any application using port 3005
2. Or change the port in `.env`:
   ```bash
   SNOW_OAUTH_REDIRECT_PORT=3006
   ```
3. Update the redirect URL in ServiceNow to match the new port

**Using in GitHub Codespaces or Remote Environments**

The localhost callback works automatically through port forwarding in:
- ✅ GitHub Codespaces (automatic port forwarding)
- ✅ VS Code Remote SSH (automatic port forwarding)
- ✅ Local development (direct localhost access)

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

### Native ServiceNow PI Solution Builder

**🆕 Build Predictive Intelligence solutions conversationally!** Create, train, and activate production-ready ML models directly in ServiceNow through natural language.

**⚠️ Important:** These tools build **native ServiceNow PI solutions** that run INSIDE ServiceNow. Requires Predictive Intelligence license.

**Complete Workflow:**
```bash
# 1. Create PI solution definition
snow-flow swarm "create predictive intelligence solution to predict incident category based on description"

# 2. Train the model (runs in ServiceNow)
snow-flow swarm "train the incident category predictor solution"

# 3. Monitor training progress
snow-flow swarm "check training status of incident category predictor"

# 4. Activate for production use
snow-flow swarm "activate incident category predictor solution"

# 5. Make predictions
snow-flow swarm "predict category for incident INC0010001"
```

**Available PI Tools:**
- `snow_create_pi_solution` - Create solution definitions (classification, regression, similarity, clustering)
- `snow_train_pi_solution` - Trigger training (10-30 min in ServiceNow)
- `snow_monitor_pi_training` - Check training progress and metrics
- `snow_activate_pi_solution` - Activate for production predictions
- `snow_list_pi_solutions` - List all PI solutions with metrics

**Example Use Cases:**
```bash
# Incident auto-categorization
snow-flow swarm "build PI solution to auto-categorize incidents based on short_description and description"

# Change risk prediction
snow-flow swarm "create regression model to predict change implementation duration"

# Similar incident finder
snow-flow swarm "build similarity solution to find related incidents for knowledge reuse"

# Work assignment optimization
snow-flow swarm "create PI solution to predict best assignment group for new incidents"
```

**Key Benefits:**
- ✅ **Native ServiceNow:** Models run directly in ServiceNow (no external dependencies)
- ✅ **Production Ready:** Fully integrated with ServiceNow workflows
- ✅ **Auto-retrain:** Automatic retraining on schedule
- ✅ **High Performance:** Enterprise-grade ML infrastructure
- ✅ **Conversational:** Build complex ML solutions through natural language

**Comparison:**

| Feature | Native PI Builder (NEW!) | Local ML Training |
|---------|-------------------------|-------------------|
| **Runs Where** | Inside ServiceNow | Locally on your machine |
| **License** | PI license required | Free (no license) |
| **Production** | ✅ Yes | ❌ Experimental only |
| **Auto-retrain** | ✅ Yes | ❌ Manual |
| **Integration** | ✅ Native | ⚠️ Via API |
| **Performance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Best For** | Production ML in ServiceNow | Dev/testing without license |

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

Snow-Flow uses SnowCode's native Task() system for intelligent agent teams:

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
| **Cursor** | Copy `.snowcode/config.json` → `.cursor/mcp.json` |
| **Windsurf** | Copy `.snowcode/config.json` → `mcp_config.json` |
| **Continue.dev** | Copy `.snowcode/config.json` → `.continue/mcpServers/snow-flow.json` |
| **Cline** | Copy `.snowcode/config.json` → `.vscode/mcp.json` |
| **GitHub Copilot** | Copy `.snowcode/config.json` → `.vscode/mcp.json` |

**Quick setup:**
```bash
# After snow-flow init, copy MCP config to your AI assistant
snow-flow init

# For Cursor
cp .snowcode/config.json .cursor/mcp.json

# For Windsurf
cp .snowcode/config.json mcp_config.json

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
OLLAMA_MODEL=llama3.3

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
- **AI Coding Assistant**: SnowCode (auto-installed) or others
- **Memory**: 4GB RAM recommended for ML training
- **Storage**: 1GB free space for models and artifacts

---

## 🆘 Support & Resources

- **Documentation**: Generated during `snow-flow init`
- **GitHub**: https://github.com/groeimetai/snow-flow
- **NPM**: https://www.npmjs.com/package/snow-flow
- **Issues**: Bug reports and feature requests welcome

---

## 🏢 Open Source vs Enterprise Features

Snow-Flow follows an **Open Core** business model. The core framework is 100% open source (Elastic License 2.0), with optional enterprise features available for organizations requiring advanced integrations and support.

### Open Source (Elastic License 2.0) - 100% Free Forever

The current Snow-Flow release includes:

- ✅ **411 ServiceNow Tools** - Complete API coverage via 2 MCP servers
- ✅ **75+ LLM Providers** - Claude, GPT-4o, Gemini, Llama, Ollama, Groq, Mistral, DeepSeek, etc.
- ✅ **Conversational Development** - Build widgets, flows, workspaces through natural language
- ✅ **Local Development Bridge** - Pull/push artifacts, edit with native tools
- ✅ **Local ML Training** - TensorFlow.js neural networks (experimental, runs on your machine)
- ✅ **Native ServiceNow ML** - Predictive Intelligence solution builder (create/train/activate/predict)
- ✅ **Widget Deployment & Validation** - Coherence checking, ES5 validation
- ✅ **UI Builder Integration** - Complete Now Experience Framework development
- ✅ **Multi-Agent Orchestration** - SPARC methodology, swarm coordination
- ✅ **Update Set Management** - Full lifecycle, auto-sync current update set
- ✅ **Background Script Execution** - With output capture and auto-confirm mode
- ✅ **Universal Compatibility** - Works with SnowCode, Claude Code, Cursor, Windsurf, Continue.dev, Cline

**Use for:** Solo developers, small teams, learning, proof-of-concepts, community projects

### Enterprise Features (Commercial License) 🔒

Premium integrations for enterprise ServiceNow teams:

- 🔒 **Jira Backlog Sync** - Bi-directional sync with AI-powered requirement parsing
  - Auto-import stories/epics from Jira to ServiceNow tasks
  - Real-time webhook updates (Jira ↔ ServiceNow)
  - AI extracts acceptance criteria, technical requirements
  - Developer workflow: `snow-flow dev start SNOW-456` loads full Jira context

- 🔒 **Azure DevOps Integration** - Complete ALM integration
  - Work item sync (User Stories, Tasks, Bugs)
  - Pull request tracking to ServiceNow
  - Build pipeline status integration
  - Test results auto-documented

- 🔒 **Confluence Documentation Sync** - Auto-sync technical documentation
  - Confluence pages → ServiceNow knowledge articles
  - Technical specs → Implementation guides
  - Architecture diagrams → Attachment sync

- 🔒 **Enterprise SSO/SAML** - Single sign-on integration (in development)
  - SAML 2.0, OAuth 2.0, OIDC
  - Active Directory/LDAP integration
  - Role-based access control (RBAC) with read-only enforcement for stakeholders

- 🔒 **Advanced Audit Logging** - Comprehensive activity tracking
  - Every AI action logged with audit trail
  - Compliance reporting (SOX, GDPR, HIPAA)
  - Tamper-proof log storage

- 🔒 **SLA-Backed Support** - Enterprise support agreements
  - 24/7 support with 4-hour response SLA
  - Dedicated technical account manager
  - Priority feature requests
  - Custom integration development

- 🔒 **Advanced ML Features** - Enhanced predictive intelligence
  - Auto-retrain on schedule
  - A/B testing for ML models
  - Multi-model ensembles
  - Custom feature engineering

**Use for:** Enterprise teams (20+ developers), consulting firms (Capgemini/Accenture/Deloitte), ISVs, production deployments

### Pricing (Coming Q2 2025)

Enterprise features will be available via seat-based commercial license:

**License Format:** `SNOW-[TIER]-[ORG]-[DEV_SEATS]/[STAKEHOLDER_SEATS]-[EXPIRY]-[CHECKSUM]`

**Seat Types:**
- **Developer Seats:** Full read/write access to all 410+ MCP tools via CLI/TUI
- **Stakeholder Seats:** Read-only CLI/TUI access for queries and analytics (no write operations)

**Pricing Tiers:**
- **Professional:** €499/month (5 developer seats + 2 stakeholder seats)
- **Team:** €999/month (20 developer seats + 10 stakeholder seats)
- **Enterprise:** €1,999/month (unlimited seats)

All tiers include:
- All open source features
- Enterprise integrations (Jira/Azure DevOps/Confluence)
- Enterprise SSO/SAML (in development)
- Audit logging
- Seat tracking and management
- Email support (SLA varies by tier)

**License Management:**
- License parsing (developer/stakeholder seat counts)
- Role assignment and tracking
- Seat usage display in CLI
- User management in enterprise portal

**Role-Based Access Control:**
- Stakeholder read-only enforcement (290/380 tools classified for permission control)
- Seat limit enforcement at connection time
- Active session tracking and monitoring
- Role-based permission validation

Contact [sales@snow-flow.dev](mailto:sales@snow-flow.dev) for enterprise license.

**Strategic Partners:** Consulting firms and ISVs - contact us for partnership opportunities.

### Why Open Core?

1. **Community-Driven Innovation** - Core features benefit from community contributions
2. **Transparent Development** - All core development happens in public
3. **No Lock-In** - Open source core means you can self-host and modify
4. **Sustainable Development** - Enterprise revenue funds ongoing development
5. **Enterprise Confidence** - Commercial license provides support and guarantees

### Features

**Open Source**
- Native ServiceNow Predictive Intelligence tools
- UI Builder complete integration
- 75+ LLM provider support
- Local development bridge
- Seat-based licensing infrastructure

**Stakeholder Seats & RBAC**
- Stakeholder read-only enforcement (290/380 tools classified as read/write)
- Seat limit enforcement with active session tracking
- Role-based access control (developer/stakeholder/admin)
- Session management API endpoints

**Enterprise (Commercial License)**
- Jira, Azure DevOps, Confluence integrations (in development)
- Enterprise SSO/SAML (in development)
- Advanced audit logging
- Multi-tenant architecture
- White-label options
- AI-powered code review
- Automated testing frameworks

See [MONETIZATION_STRATEGY.md](./MONETIZATION_STRATEGY.md) for complete business model details.

---

## 💰 Pricing & Plans

Snow-Flow offers a transparent 3-tier pricing model designed for individual developers, teams, and service integrators.

### 🆓 Open Source (Free Forever)

**350+ ServiceNow MCP Tools** - Zero cost, full access to core framework

**What's Included:**
- ✅ All 350+ ServiceNow tools (ITSM, CMDB, Flow Designer, UI Builder, etc.)
- ✅ Local MCP servers (self-hosted)
- ✅ Unlimited ServiceNow instances
- ✅ Community support (GitHub Discussions)
- ✅ Elastic License 2.0 (free commercial use)

**Perfect for:** Individual developers, students, learning, open source projects

```bash
npm install -g snow-flow
snow-flow init
# Start building immediately - no credit card required!
```

---

### 👤 Individual Plan - $99/month

**Everything in Open Source +** enterprise tools & managed SaaS infrastructure

**What's Included:**
- ✅ **40+ Enterprise MCP Tools:**
  - 🔷 Azure DevOps (10 tools) - work items, pipelines, PRs
  - 🟦 Jira (8 tools) - backlog sync, JQL queries, issue tracking
  - 📚 Confluence (8 tools) - documentation sync, page management
  - 🤖 ML & Analytics (15+ tools) - predictive intelligence, forecasting
- ✅ **Fully Managed SaaS** - hosted on Google Cloud (europe-west4)
- ✅ **Zero Maintenance** - automatic updates, no server management
- ✅ **Email Support** - business hours support (24h response time)
- ✅ **99.9% SLA** - enterprise-grade reliability

**Perfect for:** Freelance consultants, solo practitioners, side projects

**How it works:**
1. Subscribe at [portal.snow-flow.dev](https://portal.snow-flow.dev)
2. Receive enterprise license key
3. Add key to Snow-Flow config - enterprise MCP servers auto-activate
4. Start using Jira/Azure/Confluence tools immediately

---

### 👥 Teams Plan - $79/user/month

**Everything in Individual +** team collaboration & priority support

**What's Included:**
- ✅ All Individual plan features
- ✅ **Team Dashboard** - centralized license management
- ✅ **Usage Analytics** - track team tool usage and costs
- ✅ **Priority Support** - 4-hour response time, Slack channel
- ✅ **Team Onboarding** - setup session with solutions architect
- ✅ **Volume Discount** - save 20% vs Individual ($79 vs $99/user)

**Minimum:** 3 users
**Perfect for:** Development teams, agencies, consulting firms

---

### 🏢 Enterprise (Service Integrators)

**Wholesale pricing** for service integrators (Capgemini, Accenture, etc.)

**What's Included:**
- ✅ All Teams plan features
- ✅ **White-Label Portal** - branded customer experience
- ✅ **Wholesale Pricing** - $49/seat/month (50+ seats)
- ✅ **Partner Margins** - resell at $69-79/seat, keep 40-75% margin
- ✅ **24/7 Priority Support** - dedicated support team
- ✅ **Custom Integrations** - build custom MCP tools for your organization
- ✅ **Deployment Flexibility** - cloud or on-premise options
- ✅ **SOC 2 / ISO 27001** - enterprise compliance ready

**Minimum:** 25 seats
**Perfect for:** Service integrators, large consulting firms, managed service providers

**ROI Example:**
- Wholesale cost: $49/seat × 50 consultants = $2,450/month
- Resell at: $69/seat × 50 consultants = $3,450/month
- **Your margin: $1,000/month (41%)** + faster delivery = more projects

**Contact:** [sales@snow-flow.dev](mailto:sales@snow-flow.dev) for custom enterprise pricing

---

### 📊 Plan Comparison

| Feature | Open Source | Individual | Teams | Enterprise |
|---------|-------------|------------|-------|------------|
| **ServiceNow Tools** | 350+ tools | 350+ tools | 350+ tools | 350+ tools |
| **Enterprise Tools** | ❌ | 40+ tools | 40+ tools | 40+ tools |
| **Jira/Azure/Confluence** | ❌ | ✅ | ✅ | ✅ |
| **Managed SaaS** | ❌ Self-hosted | ✅ Cloud-hosted | ✅ Cloud-hosted | ✅ Cloud-hosted |
| **Support** | Community | Email (24h) | Priority (4h) | 24/7 Dedicated |
| **SLA** | None | 99.9% | 99.9% | 99.95% |
| **White-Label** | ❌ | ❌ | ❌ | ✅ |
| **Team Dashboard** | ❌ | ❌ | ✅ | ✅ |
| **Custom Integrations** | ❌ | ❌ | ❌ | ✅ |
| **Price** | **Free** | **$99/mo** | **$79/user/mo** | **$49/seat/mo** |

---

### 🎯 Which Plan is Right for You?

**Choose Open Source if:**
- You're learning ServiceNow development
- You're working on personal/open source projects
- You only need ServiceNow tools (no Jira/Azure/Confluence)
- You can self-host MCP servers locally

**Choose Individual if:**
- You're a freelance consultant or solo practitioner
- You need Jira/Azure/Confluence integration
- You want zero server maintenance (managed SaaS)
- You bill clients and can expense the subscription

**Choose Teams if:**
- You're a development team (3-25 people)
- You need team collaboration and analytics
- You want priority support and onboarding
- You want to save 20% vs Individual pricing

**Choose Enterprise if:**
- You're a service integrator (Capgemini, Accenture, etc.)
- You have 25+ consultants using ServiceNow
- You want to resell Snow-Flow to your customers
- You need white-label branding and custom integrations

---

### 💳 Payment & Billing

- **Monthly billing** - cancel anytime, no annual commitment required
- **Annual discount** - save 2 months (pay for 10, get 12)
- **Payment methods** - credit card, wire transfer (Enterprise only)
- **Invoicing** - automatic monthly invoices for accounting
- **Tax** - prices exclude VAT/sales tax (added at checkout)

**Start free trial:** 14-day free trial on Individual/Teams plans - no credit card required

👉 **[Get Started](https://portal.snow-flow.dev/signup)** | **[Contact Sales](mailto:sales@snow-flow.dev)**

---

## 📄 License

**Core Framework:** Elastic License 2.0 - see [LICENSE](LICENSE) file for details.

**What this means:**
- ✅ Free to use, modify, and redistribute
- ✅ Can be used commercially
- ✅ Full source code access
- ⚠️ Cannot provide Snow-Flow as a managed service to third parties
- ⚠️ Cannot remove or obscure licensing/copyright notices

**Trademark:** "Snow-Flow" name and logo are protected trademarks - see [TRADEMARK.md](./TRADEMARK.md).

**Enterprise Features:** Commercial license required - contact [sales@snow-flow.dev](mailto:sales@snow-flow.dev).

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
