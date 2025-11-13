export const README_TEMPLATE = `# Snow-Flow: AI-Powered ServiceNow Development Platform 🚀

Snow-Flow is a powerful AI development platform for ServiceNow that combines **22 specialized MCP servers** with **multi-agent orchestration** to revolutionize ServiceNow development. Build widgets, flows, workspaces, and complete applications using natural language commands.

## 🎯 What Can Snow-Flow Do?

- **Create ServiceNow Widgets** - "Create an incident dashboard widget with real-time updates"
- **Build Agent Workspaces** - "Create a workspace for IT support agents with incident lists"
- **Process Mining** - "Discover hidden inefficiencies in ITSM workflows"
- **Deploy UI Builder Pages** - "Build a customer portal page with service catalog"
- **Manage CMDB** - "Find all Windows servers and update their maintenance windows"
- **Train ML Models** - "Create a Predictive Intelligence solution to categorize incidents"
- **And much more!** - 22 MCP servers with 400+ tools for complete ServiceNow development

## 🚀 Quick Start (5 Minutes)

### 1. Install Snow-Flow

\`\`\`bash
npm install -g snow-flow
\`\`\`

### 2. Initialize Your Project

\`\`\`bash
# Create a new directory or use existing project
mkdir my-servicenow-project
cd my-servicenow-project

# Initialize Snow-Flow (creates .env, CLAUDE.md, MCP config)
snow-flow init
\`\`\`

### 3. Authenticate

\`\`\`bash
# Authenticate with LLM provider (Claude/OpenAI/Gemini) AND ServiceNow
snow-flow auth login
\`\`\`

This will:
- ✅ Authenticate with your preferred LLM provider (via SnowCode)
- ✅ Save your provider choice to .env
- ✅ Configure ServiceNow OAuth credentials
- ✅ Test the connection and show your username

### 4. Start Building!

\`\`\`bash
# Use the swarm command to build anything in ServiceNow
snow-flow swarm "create an incident dashboard widget"

# Or use SnowCode/Claude Code directly (MCP servers auto-configured)
snow-code  # All 22 MCP servers available automatically
\`\`\`

## 🎯 Key Features

### 🤖 22 Specialized MCP Servers (400+ Tools)

Snow-Flow includes the most comprehensive ServiceNow MCP server collection:

1. **ServiceNow Deployment** - Widget, flow, and artifact deployment
2. **ServiceNow Operations** - Core CRUD operations and queries
3. **ServiceNow Automation** - Background scripts and job scheduling
4. **ServiceNow Platform Development** - Script includes, business rules, client scripts
5. **ServiceNow Integration** - REST messages, web services, data imports
6. **ServiceNow System Properties** - Property management and configuration
7. **ServiceNow Update Set** - Change management and deployment tracking
8. **ServiceNow Development Assistant** - Intelligent artifact search and editing
9. **ServiceNow Security & Compliance** - ACLs, security policies, vulnerability scanning
10. **ServiceNow Reporting & Analytics** - Reports, dashboards, and KPIs
11. **ServiceNow Machine Learning** - Predictive Intelligence + TensorFlow.js
12. **ServiceNow Knowledge & Catalog** - Knowledge base and service catalog
13. **ServiceNow Change, Virtual Agent & PA** - Change management, chatbots, performance analytics
14. **ServiceNow Flow, Workspace & Mobile** - Flow Designer, Agent Workspace, UI Builder
15. **ServiceNow CMDB, Event, HR, CSM & DevOps** - Configuration management, HR services, customer service
16. **ServiceNow Advanced Features** - Batch operations, query optimization, process mining
17. **ServiceNow Local Development** - Artifact sync with local files for debugging
18. **Snow-Flow Orchestration** - Multi-agent coordination and task management
19. **Snow-Flow Memory** - Persistent memory and context management
20. **Snow-Flow Neural** - Neural network training with TensorFlow.js
21. **Snow-Flow Graph** - Relationship tracking and impact analysis
22. **Snow-Flow Performance** - Performance monitoring and optimization

### 🔄 Multi-Agent Orchestration

The \`swarm\` command coordinates multiple specialized agents to handle complex tasks:

\`\`\`bash
# Single command handles everything: planning, execution, testing, deployment
snow-flow swarm "build a complete incident management workspace with dashboards"
\`\`\`

### 🎨 SnowCode + Claude Code Support

Snow-Flow works seamlessly with both AI platforms:

- **SnowCode**: Native Task() integration, all 22 MCP servers auto-configured
- **Claude Code**: Full MCP support via .claude/config.json
- **Both**: Share the same CLAUDE.md instructions and .env configuration

### 🔐 Secure Authentication

- **LLM Providers**: Authenticate via SnowCode (supports Claude, OpenAI, Google, Ollama)
- **ServiceNow**: OAuth 2.0 with automatic token refresh
- **Credentials**: Stored securely in .env (never committed to git)

### 🧪 Local Development with Artifact Sync

Pull ServiceNow artifacts to local files, edit with your favorite tools, and push back:

\`\`\`bash
# Example via SnowCode/Claude Code with MCP tools:
# 1. Pull widget to local files
snow_pull_artifact({ sys_id: 'widget_sys_id', table: 'sp_widget' })

# 2. Edit locally with full IDE features (search, refactor, etc.)
# Files created in /tmp/snow-flow-artifacts/widgets/my_widget/

# 3. Validate coherence
snow_validate_artifact_coherence({ sys_id: 'widget_sys_id' })

# 4. Push changes back
snow_push_artifact({ sys_id: 'widget_sys_id' })
\`\`\`

## 📚 Usage Examples

### Create a Service Portal Widget

\`\`\`bash
snow-flow swarm "create a widget showing top 10 open incidents with priority indicators"
\`\`\`

### Build an Agent Workspace

\`\`\`bash
snow-flow swarm "create an agent workspace for ITIL fulfillment with task lists and approvals"
\`\`\`

### Design a Flow Designer Flow

\`\`\`bash
snow-flow swarm "create an approval flow for purchase requests over $5000"
\`\`\`

### Train a Machine Learning Model

\`\`\`bash
snow-flow swarm "create a Predictive Intelligence solution to predict incident categories"
\`\`\`

### Build a UI Builder Page

\`\`\`bash
snow-flow swarm "create a UI Builder page with a list of incidents and a detail panel"
\`\`\`

### Update CMDB Configuration Items

\`\`\`bash
snow-flow swarm "find all Linux servers in Boston datacenter and update their support group"
\`\`\`

### Generate Reports and Dashboards

\`\`\`bash
snow-flow swarm "create a dashboard showing SLA compliance trends for the last 30 days"
\`\`\`

## 🔧 Commands Reference

### Authentication
\`\`\`bash
snow-flow auth login   # Authenticate with LLM provider and ServiceNow
snow-flow auth logout  # Logout from ServiceNow
snow-flow auth status  # Check authentication status
\`\`\`

### Project Management
\`\`\`bash
snow-flow init         # Initialize Snow-Flow in current directory
snow-flow version      # Show Snow-Flow version
\`\`\`

### Development
\`\`\`bash
snow-flow swarm "<task>"  # Multi-agent orchestration for complex tasks
\`\`\`

### Direct AI Usage
\`\`\`bash
snow-code              # Start SnowCode with all 22 MCP servers
claude                 # Start Claude Code with MCP servers (if installed)
\`\`\`

## 🛠️ Configuration

### .env File

Created by \`snow-flow init\`, configure these variables:

\`\`\`env
# ServiceNow Instance
SNOW_INSTANCE=your-instance.service-now.com
SNOW_CLIENT_ID=your-oauth-client-id
SNOW_CLIENT_SECRET=your-oauth-client-secret

# LLM Provider (auto-set by auth login)
DEFAULT_LLM_PROVIDER=anthropic  # or openai, google, ollama

# Optional: Direct API key (skips SnowCode auth)
ANTHROPIC_API_KEY=sk-ant-...
\`\`\`

### ServiceNow OAuth Setup

1. Log into ServiceNow as admin
2. Navigate to: **System OAuth > Application Registry**
3. Click **New** > **Create an OAuth API endpoint for external clients**
4. Fill in:
   - **Name**: Snow-Flow
   - **Client ID**: (auto-generated, copy this)
   - **Client Secret**: (auto-generated, copy this)
   - **Redirect URL**: http://localhost:3000/oauth/callback
5. Save and copy Client ID and Secret to your .env file
6. Run \`snow-flow auth login\` to complete authentication

## 📁 Project Structure

After running \`snow-flow init\`:

\`\`\`
your-project/
├── .env                    # Environment configuration (DO NOT COMMIT)
├── .env.example            # Example environment template
├── CLAUDE.md               # AI instructions (primary)
├── AGENTS.md               # AI instructions (SnowCode copy)
├── .snow-code/             # SnowCode configuration
│   └── config.json         # MCP servers for SnowCode
├── .claude/                # Claude Code configuration
│   └── config.json         # MCP servers for Claude Code
├── .mcp.json               # Unified MCP server configuration
├── .snow-flow/             # Snow-Flow workspace
│   ├── memory/             # Persistent agent memory
│   └── artifacts/          # Local artifact cache
└── README.md               # This file
\`\`\`

## 🎓 Learning Resources

### Documentation Files

- **CLAUDE.md** / **AGENTS.md** - Complete AI instructions and best practices
- **SERVICENOW-OAUTH-SETUP.md** - Detailed OAuth configuration guide
- **TRADEMARK.md** - Brand guidelines and usage

### Online Resources

- [ServiceNow Developer Portal](https://developer.servicenow.com)
- [ServiceNow Flow Designer Documentation](https://docs.servicenow.com/flow-designer)
- [ServiceNow REST API Reference](https://docs.servicenow.com/rest-api)

## 🔒 Security Best Practices

1. **Never commit .env** - Already in .gitignore
2. **Use OAuth 2.0** - More secure than basic authentication
3. **Rotate credentials** - Change OAuth secrets periodically
4. **Test in dev first** - Always test in development instances
5. **Use Update Sets** - Track all changes professionally
6. **Review AI output** - Always review generated code before deployment

## 🐛 Troubleshooting

### "SnowCode is not installed"

\`\`\`bash
npm install -g @groeimetai/snow-code
\`\`\`

### "ServiceNow authentication failed"

1. Check your .env credentials are correct
2. Verify OAuth application is configured in ServiceNow
3. Ensure redirect URL is http://localhost:3000/oauth/callback
4. Run \`snow-flow auth status\` to see detailed error

### "MCP servers not loading"

1. Make sure you ran \`snow-flow init\` in your project directory
2. Check that .snow-code/config.json exists
3. Restart SnowCode/Claude Code after running init

### "Widget coherence validation failed"

This means your widget's HTML, client script, and server script don't communicate properly. Use Local Sync to debug:

\`\`\`javascript
// In SnowCode/Claude Code:
snow_pull_artifact({ sys_id: 'your_widget_sys_id', table: 'sp_widget' })
// Edit locally, then push back
snow_push_artifact({ sys_id: 'your_widget_sys_id' })
\`\`\`

## 🤝 Contributing

We welcome contributions! Snow-Flow is open source.

## 📝 License

Elastic License 2.0 - see LICENSE file for details

**What this means:**
- ✅ Free to use, modify, and redistribute
- ✅ Can be used commercially
- ✅ Full source code access
- ⚠️ Cannot provide Snow-Flow as a managed service to third parties
- ⚠️ Cannot remove or obscure licensing/copyright notices

For full license details: https://www.elastic.co/licensing/elastic-license

## 🙏 Acknowledgments

Built with ❤️ using:
- [ServiceNow Platform](https://www.servicenow.com)
- [Anthropic Claude](https://www.anthropic.com/claude)
- [SnowCode AI](https://snowcode.ai)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io)

---

**Ready to revolutionize your ServiceNow development?**

\`\`\`bash
npm install -g snow-flow
snow-flow init
snow-flow auth login
snow-flow swarm "create an awesome ServiceNow widget"
\`\`\`

🚀 **Happy building!**
`;
