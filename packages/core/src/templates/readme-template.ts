export const README_TEMPLATE = `# Snow-Flow: AI-Powered ServiceNow Development Platform 🚀

Snow-Flow is a powerful AI development platform for ServiceNow that combines **17 specialized MCP servers** with **intelligent automation** to revolutionize ServiceNow development. Build widgets, flows, workspaces, and complete applications using natural language commands.

## 🎯 What Can Snow-Flow Do?

- **Create ServiceNow Widgets** - "Create an incident dashboard widget with real-time updates"
- **Build Agent Workspaces** - "Create a workspace for IT support agents with incident lists"
- **Process Mining** - "Discover hidden inefficiencies in ITSM workflows"
- **Deploy UI Builder Pages** - "Build a customer portal page with service catalog"
- **Manage CMDB** - "Find all Windows servers and update their maintenance windows"
- **Train ML Models** - "Create a Predictive Intelligence solution to categorize incidents"
- **And much more!** - 17 MCP servers with 400+ tools for complete ServiceNow development

## 🚀 Quick Start (2 Minutes)

### 1. Install Snow-Flow

\`\`\`bash
npm install -g snow-flow
\`\`\`

### 2. Start Snow-Flow

\`\`\`bash
# Start the TUI (auto-initializes on first run)
snow-flow
\`\`\`

### 3. Authenticate (in TUI)

\`\`\`bash
# In the TUI, type /auth to authenticate
/auth
\`\`\`

This will:
- ✅ Authenticate with your preferred LLM provider
- ✅ Save your provider choice to .env
- ✅ Configure ServiceNow OAuth credentials
- ✅ Test the connection and show your username

### 4. Start Building!

Just type your request in natural language:

\`\`\`
Create an incident dashboard widget
\`\`\`

## 🎯 Key Features

### 🤖 17 Specialized MCP Servers (400+ Tools)

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

### 🔄 Multi-Agent Orchestration

Snow-Flow coordinates multiple specialized agents to handle complex tasks. Just describe what you want:

\`\`\`
Build a complete incident management workspace with dashboards
\`\`\`

### 🎨 Built-in TUI + Claude Code Support

Snow-Flow works seamlessly with multiple AI platforms:

- **Snow-Flow TUI**: Built-in terminal interface with all MCP servers
- **Claude Code**: Full MCP support via .claude/config.json
- **Both**: Share the same CLAUDE.md instructions and .env configuration

### 🔐 Secure Authentication

- **LLM Providers**: Authenticate via SnowCode (supports Claude, OpenAI, Google, Ollama)
- **ServiceNow**: OAuth 2.0 with automatic token refresh
- **Credentials**: Stored securely in .env (never committed to git)

### 🧪 Local Development with Artifact Sync

Pull ServiceNow artifacts to local files, edit with your favorite tools, and push back:

\`\`\`bash
# Example via SnowCode/snow-code with MCP tools:
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

Just type your request in the Snow-Flow TUI:

### Create a Service Portal Widget

\`\`\`
Create a widget showing top 10 open incidents with priority indicators
\`\`\`

### Build an Agent Workspace

\`\`\`
Create an agent workspace for ITIL fulfillment with task lists and approvals
\`\`\`

### Design a Flow Designer Flow

\`\`\`
Create an approval flow for purchase requests over $5000
\`\`\`

### Train a Machine Learning Model

\`\`\`
Create a Predictive Intelligence solution to predict incident categories
\`\`\`

### Build a UI Builder Page

\`\`\`
Create a UI Builder page with a list of incidents and a detail panel
\`\`\`

### Update CMDB Configuration Items

\`\`\`
Find all Linux servers in Boston datacenter and update their support group
\`\`\`

### Generate Reports and Dashboards

\`\`\`
Create a dashboard showing SLA compliance trends for the last 30 days
\`\`\`

## 🔧 Commands Reference

### CLI Commands
\`\`\`bash
snow-flow              # Start the TUI (auto-initializes on first run)
snow-flow --version    # Show Snow-Flow version
snow-flow --help       # Show help
\`\`\`

### TUI Commands (inside Snow-Flow)
\`\`\`
/auth                  # Authenticate with LLM, ServiceNow, and Enterprise
/help                  # Show available commands
/clear                 # Clear conversation
/compact               # Toggle compact mode
/exit                  # Exit Snow-Flow
\`\`\`

## 🛠️ Configuration

### .env File

Created automatically on first run, configure these variables:

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
6. Run \`snow-flow\` and use \`/auth\` to complete authentication

## 📁 Project Structure

After first run of \`snow-flow\`:

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

### "ServiceNow authentication failed"

1. Check your .env credentials are correct
2. Verify OAuth application is configured in ServiceNow
3. Ensure redirect URL is http://localhost:3000/oauth/callback
4. Run \`/auth\` again in the TUI

### "MCP servers not loading"

1. Make sure you ran \`snow-flow\` in your project directory
2. Check that .snow-code/config.json exists
3. Restart snow-flow

### "Widget coherence validation failed"

This means your widget's HTML, client script, and server script don't communicate properly. Use Local Sync to debug:

\`\`\`javascript
// In snow-code
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

---

**Ready to revolutionize your ServiceNow development?**

\`\`\`bash
npm install -g snow-flow
snow-flow
\`\`\`

Then type \`/auth\` to authenticate and start building!

🚀 **Happy building!**
`;
