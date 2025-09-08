# 🏔️ Snow-Flow

**Conversational ServiceNow Development Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/snow-flow.svg?style=for-the-badge&logo=node.js&color=339933)](https://nodejs.org)

**Talk to your ServiceNow instance through Claude Code • 20+ MCP Servers • 240+ ServiceNow Tools • Complete UX Workspace Creation • Multi-Agent Orchestration**

---

## What is Snow-Flow?

Snow-Flow is a conversational ServiceNow development platform that bridges Claude Code with ServiceNow through specialized MCP (Model Context Protocol) servers. Instead of navigating ServiceNow's web interface, you develop through natural conversation with Claude Code, which orchestrates multi-agent workflows to handle complex ServiceNow operations.

### Core Architecture

- **Multi-Agent Orchestration**: Specialized agents coordinate parallel ServiceNow operations
- **MCP Server Integration**: 20+ servers provide direct ServiceNow API access through Claude Code
- **Local Development Bridge**: Edit ServiceNow artifacts locally with native development tools
- **Machine Learning**: TensorFlow.js neural networks for ServiceNow data analysis
- **Conversational Interface**: Develop ServiceNow solutions through natural language

### Key Capabilities

- **Universal ServiceNow Operations**: Query any table, manage incidents, deploy widgets
- **Local Artifact Editing**: Pull ServiceNow artifacts to local files, edit with native tools, push back
- **Multi-Agent Coordination**: Complex tasks handled by coordinated specialist agents
- **Real Machine Learning**: Neural networks for incident classification and anomaly detection
- **Comprehensive API Coverage**: 200+ tools across all major ServiceNow modules

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

# Create a ServiceNow widget with AI agents
snow-flow swarm "create incident dashboard widget with real-time charts" --max-agents 3

# Deploy and test
snow-flow deploy
```

### Authentication

```bash
# Authenticate with ServiceNow
snow-flow auth login

# Verify connection
snow-flow auth status
```

#### ServiceNow OAuth Configuration

To set up OAuth in your ServiceNow instance:

1. **Navigate to System OAuth → Application Registry**
2. **Click "New" → "Create an OAuth API endpoint"** (not client credentials)
3. **Fill required fields:**
   - Name: `Snow-Flow Integration`
   - Client ID: `snow-flow-client`  
   - Redirect URL: `http://localhost:3000/callback`
4. **Save and copy the Client ID and Client Secret**
5. **Run `snow-flow auth login`** - this opens browser for authentication

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

Snow-Flow includes TensorFlow.js neural networks for ServiceNow data analysis:

```bash
# Train incident classifier using ServiceNow data
snow-flow ml train-classifier --table incident --features "short_description,category"

# Predict change risks based on historical data
snow-flow ml predict-risk --change-id CHG0000123

# Detect anomalies in ServiceNow data patterns
snow-flow ml detect-anomalies --monitor incidents
```

**ML Capabilities:**
- **Incident Classification**: LSTM networks for categorizing incidents
- **Change Risk Assessment**: Neural networks for change management
- **Anomaly Detection**: Autoencoder models for identifying unusual patterns
- **Time Series Analysis**: Forecasting for ServiceNow metrics

### MCP Server Architecture

**20+ Specialized MCP Servers:**
- **Operations**: Universal queries, incident management, CMDB search
- **Local Development**: Pull/push ServiceNow artifacts for local editing
- **Deployment**: Widget and artifact deployment with validation
- **Machine Learning**: TensorFlow.js neural network training and inference
- **Security & Compliance**: Automated security scanning and compliance checks
- **Integration**: REST/SOAP endpoints, transform maps, import sets
- **Advanced Features**: Process mining, batch operations, analytics

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

### Multi-Agent Coordination

```
Queen Agent (Coordinator)
├── Widget Creator Agent
├── Security Specialist Agent  
├── ML Specialist Agent
└── Performance Optimizer Agent
```

### MCP Server Integration

Snow-Flow integrates 16 specialized MCP servers:
- **Core**: Operations, deployment, automation
- **Platform**: Development, integration, properties
- **Intelligence**: Machine learning, analytics, security
- **Enterprise**: Compliance, reporting, knowledge management

## Examples

### Widget Development

```bash
# Create a complete incident dashboard
snow-flow swarm "create incident dashboard with:
- Real-time incident counts by priority
- ML-powered trend analysis  
- Interactive charts and filtering
- Mobile-responsive design" --max-agents 4
```

### Process Mining

```bash
# Discover and optimize incident management process
snow-flow analyze process incident_management --optimize --ml-insights
```

### Security Automation

```bash
# Automated compliance audit
snow-flow audit compliance --framework SOX --auto-remediation
```

## Configuration

### Basic Configuration

Snow-Flow configuration is stored in `snow-flow.config.json`:

```json
{
  "servicenow": {
    "instance": "your-instance.service-now.com",
    "authentication": "oauth"
  },
  "agents": {
    "maxConcurrent": 5,
    "defaultStrategy": "parallel"
  },
  "ml": {
    "enableTraining": true,
    "modelStorage": "local"
  }
}
```

### Environment Variables

```bash
# ServiceNow instance
SNOW_INSTANCE=your-instance.service-now.com

# OAuth credentials
SNOW_CLIENT_ID=your-client-id
SNOW_CLIENT_SECRET=your-client-secret

# Optional: AI provider settings
AI_PROVIDER=claude  # or openai, gemini
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
