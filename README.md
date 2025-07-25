# Snow-Flow: ServiceNow Hive-Mind Intelligence 🧠

**Snow-Flow** revolutionizes ServiceNow development through **claude-flow inspired hive-mind architecture**. One elegant command spawns intelligent AI agents that collaborate to build, test, and deploy professional ServiceNow solutions automatically.

## 🧠 The Hive-Mind Revolution

**Inspired by claude-flow philosophy: "One Queen, many simple agents, simple memory, learn and adapt"**

- 👑 **Queen Agent**: Master coordinator that analyzes objectives and spawns specialist agents
- 🤖 **Worker Agents**: ServiceNow specialists (Widget Creator, Flow Builder, Script Writer, Security, Test)
- 💾 **Shared Memory**: SQLite-based persistent coordination system
- 🎯 **Claude Code Integration**: All coordination happens through Claude Code interface
- 🚀 **One Command**: `snow-flow swarm "objective"` - everything else is automatic

## ✨ What's New in v1.3.1 - Flow Designer XML Auto-Deployment COMPLETE!

### 🚀 BREAKTHROUGH: Complete XML Update Set Auto-Import!
- **✅ ZERO MANUAL STEPS**: One command imports, previews, and commits XML update sets automatically
- **✅ FLOW DESIGNER INTEGRATION**: Automatic detection of Flow Designer artifacts in swarm commands
- **✅ XML GENERATION & DEPLOYMENT**: Complete workflow from swarm creation to XML deployment
- **✅ SAFETY CONTROLS**: Auto-preview with problem detection, only commits if clean
- **✅ NEW CLI COMMAND**: `snow-flow deploy-xml <file>` for standalone XML deployment
- **✅ MCP INTEGRATION**: Extended deployment MCP to support xml_update_set type

### 🔄 Flow Designer XML Workflow
```bash
# 1. Create flow with swarm
snow-flow swarm "create approval workflow for equipment requests"

# 2. Export XML automatically generated in flow-update-sets/
# 3. Deploy XML with single command - no manual import!
snow-flow deploy-xml flow-update-sets/flow_approval_workflow.xml

# ✅ Complete automation: Import → Load → Preview → Commit (only if clean)
```

### 🚀 Previous Release: v1.1.93 - Revolutionary Parallel Agent Spawning WORKING!

#### 🚀 BREAKTHROUGH: 6+ Parallel Agents Working Simultaneously!
- **✅ PROVEN RESULTS**: 6+ specialized agents spawn automatically for widget development
- **✅ 2.8x SPEEDUP**: Demonstrated 2.8x faster development vs single-agent approach
- **✅ SPECIALIZED TEAMS**: widget-creator, css-specialist, backend-specialist, frontend-specialist, integration-specialist, performance-specialist, ui-ux-specialist, tester
- **✅ 100% DETECTION**: Enhanced detection logic - no more missed parallelization opportunities
- **✅ INTELLIGENT 403 HANDLING**: Gap Analysis Engine integration for automatic permission issue resolution
- **✅ MEMORY TOOLS FIXED**: ServiceNow Memory MCP server added to template system

### 🚀 Previous Release: v1.1.90 - Parallel Agent Engine Foundation
- **Parallel Engine Architecture**: Core foundation for intelligent agent spawning
- **Task Analysis System**: Detects opportunities for specialized breakdown
- **Agent Coordination**: Shared memory system for multi-agent collaboration
- **Shared Memory Coordination**: All parallel agents coordinate seamlessly through shared memory system

### ⚡ Execution Strategies
- **Wave-based**: Sequential waves of parallel agents for structured work
- **Concurrent**: All agents work simultaneously for maximum speed
- **Pipeline**: Agent handoffs with overlap for continuous workflow  
- **Hybrid**: Intelligent mix of strategies based on task analysis

### 🧠 Learning & Optimization
- **Performance Tracking**: Stores execution results to improve future parallelization decisions
- **Workload Balancing**: Intelligent distribution across agent teams with utilization monitoring
- **Graceful Fallback**: Automatically falls back to sequential execution when beneficial

## 🧠 Previous Major Release: v1.1.88 - Intelligent Gap Analysis Revolution

### 🧠 REVOLUTIONARY: Intelligent Gap Analysis Engine
- **Beyond MCP Tools**: Automatically detects ALL ServiceNow configurations needed beyond standard MCP tools
- **60+ Configuration Types**: System properties, LDAP/SAML auth, database indexes, navigation, forms, ACLs, and more
- **Auto-Resolution Engine**: Attempts automatic configuration via ServiceNow APIs for safe operations
- **Manual Instructions Generator**: Creates detailed step-by-step guides with role requirements and risk assessment
- **Queen Agent Integration**: Built into every Queen Agent execution - no additional commands needed

### 🎯 Complete ServiceNow Configuration Coverage
- **🔐 Authentication**: LDAP, SAML, OAuth providers, SSO, MFA configurations
- **🗄️ Database**: Indexes, views, partitioning, performance analytics, system properties
- **🧭 Navigation**: Application menus, modules, form layouts, UI actions, policies
- **📧 Integration**: Email templates, web services, import sets, transform maps
- **🔄 Workflow**: Activities, transitions, SLA definitions, escalation rules

### 🤖 Intelligent Automation
- **Requirements Analysis**: AI-powered parsing of objectives to identify all needed configurations
- **MCP Coverage Analysis**: Maps what current tools can handle vs manual setup requirements  
- **Risk Assessment**: Evaluates complexity and safety of each configuration
- **Environment Awareness**: Provides dev/test/prod specific guidance and warnings

### 🔧 Agent-Based MCP Integration
- **Memory-Aware MCPs**: All 11 MCP servers now integrate with agent coordination
- **Progress Reporting**: Real-time progress updates to Queen Agent
- **No Mock Data**: All operations use real ServiceNow (removed all placeholders)
- **Error Recovery**: Comprehensive fallback strategies with Queen intervention

### 🚀 Enhanced CLI Orchestration
- **Queen Agent Prompts**: Swarm command generates comprehensive orchestration instructions
- **Session Management**: Unique session IDs with progress tracking
- **Status Monitoring**: `snow-flow swarm-status <sessionId>` for real-time monitoring
- **Memory Coordination**: All agents communicate through shared SQLite memory

## 🤖 Agent Ecosystem

### 👑 Queen Agent (Master Coordinator)
- **Objective Analysis**: Analyzes natural language objectives and determines complexity
- **Agent Spawning**: Dynamically spawns required specialist agents based on requirements
- **Progress Monitoring**: Real-time tracking of task completion and agent coordination
- **Memory Management**: Stores patterns and learns from successful executions
- **Error Recovery**: Makes strategic decisions when agents encounter problems

### 🎨 Widget Creator Agent
- **HTML Templates**: Creates responsive ServiceNow Service Portal widgets
- **Server Scripts**: Develops optimized server-side data processing logic
- **CSS Styling**: Implements professional styling with Chart.js integration
- **Deployment**: Uses `snow_deploy` MCP tools for direct ServiceNow deployment

### 🔄 Flow Builder Agent
- **Flow Design**: Creates Flow Designer workflows with intelligent structure
- **Trigger Configuration**: Sets up optimal triggers (record events, scheduled, manual)
- **Approval Processes**: Implements complex approval hierarchies with escalation
- **Integration**: Uses `snow_create_flow` MCP tools with comprehensive testing

### 📝 Script Writer Agent
- **Business Rules**: Creates optimized business logic with performance considerations
- **Script Includes**: Develops reusable server-side utilities with proper class structure
- **Client Scripts**: Implements UI behavior and validation logic
- **Performance**: Automatic optimization recommendations and best practices

### 🛡️ Security Agent
- **Vulnerability Scanning**: Scans for XSS, SQL injection, hardcoded credentials
- **Access Control**: Validates permissions and role-based security
- **Compliance**: Checks SOX, GDPR, HIPAA compliance requirements
- **Remediation**: Generates actionable security improvement plans

### 🧪 Test Agent
- **Test Scenarios**: Creates comprehensive test cases (positive, negative, edge cases)
- **Mock Data**: Generates realistic test data for validation
- **Performance Testing**: Validates response times and resource usage
- **Integration Testing**: Tests cross-component interactions and workflows

## 💾 Memory System Architecture

### SQLite-Based Coordination
```sql
-- Agent coordination and communication
agent_coordination: Track agent status, progress, and assignments
servicenow_artifacts: Store created widgets, flows, scripts with full metadata
agent_messages: Inter-agent communication and handoff coordination
shared_context: Session-wide shared data and configuration
deployment_history: Complete audit trail of all ServiceNow operations
agent_dependencies: Manage complex task dependencies and ordering
performance_metrics: Real-time performance tracking and optimization
```

### Memory Usage Patterns
```javascript
// Agents store context for coordination
Memory.store("widget_requirements", {
  type: "incident_dashboard",
  charts: ["pie", "bar", "timeline"],
  responsive: true
});

// Other agents read and build upon context
const requirements = Memory.get("widget_requirements");
// Agent creates widget based on shared requirements
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- ServiceNow instance with admin access
- OAuth application configured in ServiceNow

### Installation & Setup

```bash
# Install Snow-Flow globally
npm install -g snow-flow

# Initialize with complete hive-mind environment
snow-flow init --sparc

# Configure ServiceNow credentials (.env file)
SNOW_INSTANCE=dev123456
SNOW_CLIENT_ID=your_oauth_client_id
SNOW_CLIENT_SECRET=your_oauth_client_secret
SNOW_USERNAME=admin
SNOW_PASSWORD=admin_password

# Authenticate with ServiceNow
snow-flow auth login

# 🎉 Experience the hive-mind intelligence with Gap Analysis!
snow-flow swarm "Create incident management dashboard with real-time charts"

# 🧠 NEW: Advanced example showing Gap Analysis Engine
snow-flow queen "create ITSM solution with LDAP authentication and custom approval workflows"

# 🚀 NEW: Complete Flow Designer XML deployment workflow
snow-flow swarm "create approval workflow for equipment requests"
snow-flow deploy-xml flow-update-sets/flow_approval_workflow.xml
```

### 🧠 What You'll See with Gap Analysis Engine

```bash
snow-flow queen "create incident management with LDAP authentication"

🧠 Step 4: Running Intelligent Gap Analysis...
📊 Gap Analysis Complete:
  • Total Requirements: 12
  • MCP Coverage: 67%
  • Automated: 6 configurations  
  • Manual Work: 4 items

✅ Automatically Configured:
  • System property: glide.ui.incident_management created
  • Navigation module: Incident Management added to Service Desk
  • Email template: incident_notification configured
  • Database index: incident.priority_state for performance
  • Form layout: incident form sections optimized
  • UI action: "Escalate Priority" button added

📋 Manual Configuration Required:
  • LDAP authentication setup (high-risk operation)
  • SSO configuration with Active Directory  
  • Custom ACL rules for incident priority restrictions
  • Email server configuration for notifications

📚 Detailed Manual Guides Available:
  📖 Configure LDAP Authentication - 25 minutes
     Risk: high | Roles: security_admin, admin
  📖 Setup SSO with Active Directory - 45 minutes
     Risk: high | Roles: security_admin
  📖 Create Custom ACL Rules - 15 minutes  
     Risk: medium | Roles: admin
  📖 Configure Email Server - 20 minutes
     Risk: low | Roles: email_admin

💡 Recommendations:
  • Test LDAP configuration in development environment first
  • Coordinate with security team for SSO setup
  • Review ACL rules with business stakeholders
```

## 🎯 Core Commands

### 🧠 Hive-Mind Orchestration
```bash
# Primary command - spawns Queen Agent with specialist workers
snow-flow swarm "objective"

# Monitor swarm progress
snow-flow swarm-status <sessionId>

# System status and health
snow-flow status

# Memory management
snow-flow memory stats
snow-flow memory export <file>
```

### 🚀 NEW: XML Update Set Deployment
```bash
# Deploy XML update sets automatically (Import → Preview → Commit)
snow-flow deploy-xml <xmlFile>

# Deploy with custom options
snow-flow deploy-xml flow.xml --no-preview  # Skip preview step
snow-flow deploy-xml flow.xml --no-commit   # Preview only, don't commit

# Example: Deploy generated flow XML
snow-flow deploy-xml flow-update-sets/flow_approval_workflow.xml
```

### 🚀 Intelligent Features (Enabled by Default)
- **🧠 Gap Analysis Engine**: Automatically detects ALL ServiceNow configurations beyond MCP tools
- **🤖 Auto-Resolution**: Attempts automatic configuration of system properties, navigation, auth
- **📚 Manual Guides**: Generates detailed step-by-step instructions for complex setups
- **🚀 XML Auto-Deployment**: Complete XML update set import workflow with safety controls
- **Smart Discovery**: Automatically discovers and reuses existing artifacts
- **Live Testing**: Real-time testing during development on your ServiceNow instance
- **Auto Deploy**: Automatic deployment when ready (safe with update sets)
- **Auto Rollback**: Automatic rollback on failures with backup restoration
- **Shared Memory**: All agents share context and coordination state
- **Progress Monitoring**: Real-time progress tracking and status updates

### 🎛️ Advanced Options
```bash
# Enable automatic permission escalation for enterprise features
snow-flow swarm "create global workflow" --auto-permissions

# Disable specific features when needed
snow-flow swarm "test widget locally" --no-auto-deploy --no-live-testing

# Maximum control
snow-flow swarm "complex integration" \
  --max-agents 8 \
  --strategy development \
  --mode distributed \
  --parallel \
  --auto-permissions
```

## 🔧 Configuration

### ServiceNow Connection
Create `.env` file in your project:
```env
SNOW_INSTANCE=dev123456
SNOW_CLIENT_ID=your_oauth_client_id
SNOW_CLIENT_SECRET=your_oauth_client_secret
SNOW_USERNAME=admin
SNOW_PASSWORD=admin_password
```

### OAuth Setup in ServiceNow
1. Navigate to System OAuth > Application Registry
2. Create new OAuth application
3. Set redirect URI to `http://localhost:3000/oauth/callback`
4. Note the Client ID and Client Secret
5. Grant necessary scopes for your development needs

## 🎯 Usage Examples

### Widget Development
```bash
# Complete widget with intelligent agent coordination
snow-flow swarm "Create incident dashboard widget with pie charts and filter options"

# The Queen Agent will:
# 1. Analyze objective and spawn Widget Creator + Test Agent
# 2. Widget Creator builds responsive HTML/CSS/JS with Chart.js
# 3. Test Agent creates comprehensive test scenarios
# 4. Automatic deployment to ServiceNow with Update Set tracking
```

### Flow Creation & XML Deployment
```bash
# Complex approval workflow with automatic XML generation
snow-flow swarm "Build approval flow for equipment requests with manager and finance approval"

# The Queen Agent will:
# 1. Spawn Flow Builder + Security Agent
# 2. Flow Builder designs multi-step approval process
# 3. Security Agent validates permissions and compliance
# 4. Automatic XML generation in flow-update-sets/ directory
# 5. Display deploy-xml command for seamless deployment

# 🚀 NEW: Complete XML deployment workflow
snow-flow deploy-xml flow-update-sets/flow_equipment_approval.xml

# ✅ Automatic process:
# • Import XML to ServiceNow
# • Load remote update set  
# • Preview changes & check for conflicts
# • Commit automatically if clean (or prompt if issues found)
```

### Complete Solutions
```bash
# End-to-end solution development
snow-flow swarm "Create complete ITSM incident management solution with dashboards, automation, and reporting"

# The Queen Agent will:
# 1. Analyze complexity and spawn all required agents
# 2. Coordinate parallel development of multiple components
# 3. Ensure integration between widgets, flows, and scripts
# 4. Comprehensive testing and phased deployment
```

## 🏗️ Architecture

### Hive-Mind Coordination Flow
1. **CLI Analysis**: User runs `snow-flow swarm "objective"`
2. **Queen Activation**: Queen Agent analyzes objective and determines requirements
3. **Agent Spawning**: Queen spawns specialist agents based on complexity assessment
4. **Memory Initialization**: SQLite memory system activated for coordination
5. **Parallel Execution**: Agents work independently while sharing context through memory
6. **Progress Monitoring**: Real-time status updates via shared memory state
7. **ServiceNow Integration**: Agents use 11 specialized MCP servers for operations
8. **Completion**: Final artifacts delivered with comprehensive audit trail

### Memory-Driven Coordination
```
┌─────────────────────────────────────────────────────────────────┐
│                    Snow-Flow Hive-Mind System                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐  │
│  │   Claude Code   │◄──►│  Snow-Flow CLI  │◄──►│ ServiceNow  │  │
│  │   Interface     │    │  Orchestrator   │    │  Instance   │  │
│  └─────────────────┘    └─────────────────┘    └─────────────┘  │
│           │                       │                      │      │
│           ▼                       ▼                      ▼      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐  │
│  │  Swarm Memory   │◄──►│  Queen Agent    │◄──►│  MCP Tools  │  │
│  │   (SQLite)      │    │  Coordinator    │    │  (11 MCPs)  │  │
│  └─────────────────┘    └─────────────────┘    └─────────────┘  │
│           │                       │                             │
│           ▼                       ▼                             │
│  ┌─────────────────────────────────────────────────────────────┤
│  │              ServiceNow Specialist Agents                   │
│  │                                                             │
│  │  Widget Creator  │  Flow Builder  │  Script Writer        │  │
│  │  Security Agent  │  Test Agent    │  [Future Agents]      │  │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 Development

### Project Structure
```
snow-flow/
├── src/
│   ├── agents/           # Queen Agent and specialist agents
│   ├── memory/           # SQLite-based coordination system
│   ├── mcp/             # 11 ServiceNow MCP servers
│   ├── cli/             # Enhanced CLI with Queen orchestration
│   ├── config/          # Configuration management
│   ├── health/          # System health monitoring
│   └── monitoring/      # Performance tracking
├── SNOW_FLOW_ARCHITECTURE.md  # Complete system architecture
├── MCP_ARCHITECTURE.md        # Agent-specific MCP design
└── CLAUDE.md                  # Development configuration
```

### Build and Test
```bash
# Build the project
npm run build

# Run tests
npm run test

# Type checking
npm run typecheck

# Memory system test
npm run test:memory

# MCP integration test
npm run test:mcp-integration
```

## 🤝 Contributing

We welcome contributions to the Snow-Flow hive-mind ecosystem! Please read our contributing guidelines and submit PRs for new agents, MCP enhancements, or architecture improvements.

### Priority Areas
- Additional specialist agents (Integration, Reporting, etc.)
- Enhanced memory patterns and learning algorithms
- Advanced Queen Agent decision-making capabilities
- ServiceNow-specific optimizations and best practices

## 📝 License

MIT License - see LICENSE file for details.

## 🚀 Future Vision

Snow-Flow will become the **definitive AI-driven ServiceNow development platform**, where developers describe any ServiceNow objective in natural language and watch intelligent agents collaborate to build, test, and deploy professional solutions automatically.

**Core Promise**: "Describe what you want in ServiceNow, and our AI swarm will build it for you."

---

*Experience the future of ServiceNow development with Snow-Flow's hive-mind intelligence.* 🧠✨