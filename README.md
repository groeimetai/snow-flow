# 🏔️ Snow-Flow

**Conversational ServiceNow Development Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/snow-flow.svg?style=for-the-badge&logo=node.js&color=339933)](https://nodejs.org)

**Talk to your ServiceNow instance through Claude Code • 2 Unified MCP Servers • 411 ServiceNow Tools • Complete UX Workspace Creation • Claude Agent SDK Integration**

---

## What is Snow-Flow?

Snow-Flow is a conversational ServiceNow development platform that bridges Claude Code with ServiceNow through specialized MCP (Model Context Protocol) servers. Instead of navigating ServiceNow's web interface, you develop through natural conversation with Claude Code, which orchestrates multi-agent workflows to handle complex ServiceNow operations.

### Core Architecture

- **Claude Agent SDK Integration**: Powered by @anthropic-ai/claude-agent-sdk for orchestration
- **Unified MCP Servers**: 2 consolidated servers with 411 tools for complete ServiceNow access
- **Local Development Bridge**: Edit ServiceNow artifacts locally with native development tools
- **Machine Learning**: TensorFlow.js neural networks for ServiceNow data analysis
- **Conversational Interface**: Develop ServiceNow solutions through natural language

### Key Capabilities

- **Universal ServiceNow Operations**: Query any table, manage incidents, deploy widgets
- **Local Artifact Editing**: Pull ServiceNow artifacts to local files, edit with native tools, push back
- **Claude Agent SDK Coordination**: Orchestration managed by official Anthropic SDK
- **Real Machine Learning**: Neural networks for incident classification and anomaly detection
- **Comprehensive API Coverage**: 411 tools across all major ServiceNow modules

## Quick Start

### Prerequisites 

⚠️ **CRITICAL:** Claude Code must be installed and running BEFORE using Snow-Flow to prevent stdio connection errors!

```bash
# 1. FIRST: Install Claude Code
npm install -g @anthropic-ai/claude-code

# 2. Login and start Claude Code
claude login
cd /your/project/directory
claude --dangerously-skip-permissions
```

### Installation

```bash
# 2. THEN: Install Snow-Flow (while Claude Code is running)
npm install -g snow-flow
```

### Basic Usage

```bash
# Initialize configuration
snow-flow init

# Authenticate with ServiceNow
snow-flow auth login

# Create anything in ServiceNow through conversation
snow-flow swarm "create incident dashboard widget with real-time charts"
```

### Authentication

```bash
# Authenticate with ServiceNow
snow-flow auth login

# Verify connection
snow-flow auth status
```

#### ServiceNow OAuth Configuration

⚠️ **IMPORTANT:** Snow-Flow uses OAuth 2.0 Authorization Code Flow with browser authentication. Follow these exact steps:

1. **Navigate to:** System OAuth → Application Registry
2. **Click:** New → **"Create an OAuth API endpoint for external clients"**
3. **Configure OAuth Application:**
   - **Name:** `Snow-Flow Integration` (or any name you prefer)
   - **Redirect URL:** `http://localhost:3005/callback` ⚠️ **MUST be exactly this!**
   - **Refresh Token Lifespan:** `0` (unlimited - recommended)
   - **Access Token Lifespan:** `1800` (30 minutes)
4. **Save** - ServiceNow will auto-generate:
   - Client ID (copy this)
   - Client Secret (copy this - shown only once!)
5. **Create `.env` file** in your project with:
   ```bash
   SNOW_INSTANCE=your-instance.service-now.com
   SNOW_CLIENT_ID=<your_client_id>
   SNOW_CLIENT_SECRET=<your_client_secret>
   ```
6. **Run:** `snow-flow auth login`
   - Opens browser automatically for ServiceNow login
   - Redirects to `http://localhost:3005/callback` after authentication
   - Stores OAuth tokens locally for future use

**Why this exact redirect URL?**
Snow-Flow starts a local OAuth callback server on port 3005. ServiceNow must redirect to **exactly** `http://localhost:3005/callback` - any mismatch (wrong port, missing `/callback`) will cause "Invalid redirect_uri" errors.

#### Common Authentication Issues

**❌ "Could not find artifact with sys_id xyz..."**
- **Real cause:** OAuth token expired (misleading error message)
- **Solution:** `snow-flow auth login`
- **Note:** Fixed in v4.5.3 with clear OAuth error messages

**❌ Stdio connection errors**
- **Cause:** Claude Code not running before Snow-Flow  
- **Solution:** Start Claude Code first: `claude --dangerously-skip-permissions`

**❌ Permission errors**
- **Cause:** Not logged into Claude Code
- **Solution:** `claude login` before using Snow-Flow

## Core Features

### 🤖 Intelligent Agent Coordination

Snow-Flow's Queen Agent makes strategic decisions about task execution:
- **Solo Mode**: Simple tasks handled directly
- **Team Mode**: Complex tasks spawn specialized agent teams
- **Parallel Execution**: Multiple agents work simultaneously for maximum speed

**Available Agent Types:**
- `widget-creator` - Service Portal widget development
- `security-specialist` - ACL and compliance validation
- `ml-specialist` - Machine learning model training
- `performance-optimizer` - Code and query optimization
- `integration-specialist` - REST/SOAP integrations

### Machine Learning Integration

Snow-Flow includes TensorFlow.js neural networks for ServiceNow data analysis through the swarm command:

```bash
# Train ML models and analyze ServiceNow data conversationally
snow-flow swarm "train incident classifier on last 6 months of data"
snow-flow swarm "predict change risk for upcoming release"
snow-flow swarm "detect anomalies in incident patterns"
```

**ML Capabilities (via swarm command):**
- **Incident Classification**: LSTM networks for categorizing incidents
- **Change Risk Assessment**: Neural networks for change management
- **Anomaly Detection**: Autoencoder models for identifying unusual patterns
- **Time Series Analysis**: Forecasting for ServiceNow metrics

### MCP Server Architecture

**2 Unified MCP Servers (411 Tools):**
- **ServiceNow Unified Server (235+ tools)**: Complete ServiceNow operations including deployment, automation, platform dev, integrations, properties, security, reporting, ML, knowledge, catalog, change management, virtual agent, flows, workspaces, mobile, UI Builder, CMDB, events, HR, CSM, DevOps, and local development
- **Snow-Flow Orchestration Server (176+ tools)**: Swarm coordination, agent spawning, task orchestration, neural training (TensorFlow.js), memory management, and performance tracking

**Essential Tools:**
- `snow_query_table` - Query any ServiceNow table with flexible filtering
- `snow_pull_artifact` - Pull ServiceNow artifacts to local files for editing
- `snow_deploy` - Deploy widgets and artifacts with coherence validation
- `ml_train_incident_classifier` - Train neural networks on ServiceNow data
- `snow_execute_script_with_output` - Execute ServiceNow background scripts

### Local Development Workflow

Snow-Flow bridges ServiceNow with local development tools:

```bash
# Pull any ServiceNow artifact to local files
snow_pull_artifact({ sys_id: 'widget_sys_id', table: 'sp_widget' })

# Edit locally using Claude Code's native file tools:
# - Full search and replace across all files
# - Multi-file editing and refactoring
# - Git integration and version control
# - Advanced code navigation

# Push changes back with validation
snow_push_artifact({ sys_id: 'widget_sys_id' })
```

**Local Development Features:**
- **Native Editing**: Use Claude Code's full editing capabilities
- **File-based Development**: Work with ServiceNow artifacts as local files
- **Validation**: Coherence checking before pushing back to ServiceNow
- **Version Control**: Integrate with Git workflows
- **Multi-artifact Support**: Widgets, scripts, flows, and more

## Architecture

### Claude Agent SDK Orchestration

```
Claude Agent SDK (@anthropic-ai/claude-agent-sdk@0.1.1)
├── Manages MCP server lifecycle
├── Handles agent coordination
├── Provides intelligent task routing
└── Ensures resource optimization
```

### MCP Server Integration

Snow-Flow uses 2 unified MCP servers (411 tools total):
- **ServiceNow Unified**: All ServiceNow operations, deployment, automation, development, integrations, and advanced features
- **Snow-Flow Orchestration**: Swarm coordination, neural networks, memory management, and performance analytics

## Examples

### Widget Development

```bash
# Create a complete incident dashboard
snow-flow swarm "create incident dashboard with real-time incident counts by priority, ML-powered trend analysis, interactive charts and filtering, and mobile-responsive design"
```

### Process Mining

```bash
# Discover and optimize incident management process
snow-flow swarm "analyze incident management process and provide optimization recommendations"
```

### Security Automation

```bash
# Automated compliance audit
snow-flow swarm "perform SOX compliance audit and generate remediation plan"
```

## Configuration

Snow-Flow configuration is automatically created by `snow-flow init` and stored in `.mcp.json`. All settings are managed through the init command - no manual configuration needed.

### Environment Variables

```bash
# ServiceNow instance
SNOW_INSTANCE=your-instance.service-now.com

# OAuth credentials
SNOW_CLIENT_ID=your-client-id
SNOW_CLIENT_SECRET=your-client-secret
```

## Use Cases

### Development Teams
- **Conversational Development**: Build ServiceNow solutions through natural language
- **Local Tool Integration**: Use familiar development environments
- **Multi-agent Coordination**: Complex tasks handled by specialized agents
- **Real-time Validation**: Immediate feedback on ServiceNow artifacts

### ServiceNow Administrators
- **Universal Operations**: Query and manage any ServiceNow table or process
- **Automated Analysis**: ML-powered insights from ServiceNow data
- **Batch Operations**: Handle large-scale ServiceNow operations efficiently
- **Process Intelligence**: Understand ServiceNow workflows through data analysis

### Solution Architects
- **Conversational Architecture**: Design ServiceNow solutions through discussion with Claude
- **Pattern Recognition**: Identify and apply ServiceNow best practices automatically
- **Cross-module Integration**: Coordinate development across ServiceNow modules
- **Risk Assessment**: Analyze impact of changes before implementation

## Requirements

- **Node.js**: 18.0.0 or higher
- **ServiceNow**: Any supported version
- **Memory**: 4GB RAM recommended for ML training
- **Storage**: 1GB free space for models and artifacts

## Support

- **Documentation**: Comprehensive guides included
- **GitHub**: https://github.com/groeimetai/snow-flow
- **NPM**: https://www.npmjs.com/package/snow-flow
- **Issues**: Bug reports and feature requests welcome

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Snow-Flow: Conversational ServiceNow development through Claude Code.**
