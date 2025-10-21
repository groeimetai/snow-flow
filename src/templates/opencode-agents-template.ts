export const AGENTS_MD_TEMPLATE = `# Snow-Flow: ServiceNow Development with OpenCode

**Multi-LLM ServiceNow Development Platform** • 411 Tools • 2 MCP Servers • Any LLM Provider

---

## 🚀 Quick Start

You're using **OpenCode** with Snow-Flow's ServiceNow tools. This gives you access to:
- **235+ ServiceNow tools** via \`servicenow-unified\` MCP server
- **176+ orchestration tools** via \`snow-flow\` MCP server
- **Multi-agent coordination** with OpenCode's Task system
- **Any LLM provider**: Claude, GPT, Gemini, Ollama, etc.

### Available Tools

Use OpenCode's native commands to explore:
\`\`\`
# List all available MCP tools
> What ServiceNow tools are available?

# Get tool details
> Describe the snow_deploy tool

# Use tools directly
> Use snow_query_table to get open incidents
\`\`\`

---

## 🔴 CRITICAL RULES - NO EXCEPTIONS

### Rule #1: ES5 ONLY - ServiceNow Rhino Engine
ServiceNow runs on Mozilla Rhino (ES5 from 2009). Modern JavaScript WILL FAIL!

**❌ NEVER USE (WILL CRASH):**
\`\`\`javascript
const data = [];              // SyntaxError!
let items = [];               // SyntaxError!
const fn = () => {};          // SyntaxError!
var msg = \\\`Hello \${name}\\\`;   // SyntaxError!
for (let item of items) {}    // SyntaxError!
var {name, id} = user;        // SyntaxError!
array.map(x => x.id);         // SyntaxError!
\`\`\`

**✅ ONLY USE ES5:**
\`\`\`javascript
var data = [];
var items = [];
function fn() { return 'result'; }
var msg = 'Hello ' + name;
for (var i = 0; i < items.length; i++) {
  var item = items[i];
}
var name = user.name;
var id = user.id;
for (var j = 0; j < array.length; j++) {
  // Process array[j]
}
\`\`\`

### Rule #2: NO MOCK DATA - EVERYTHING REAL
**FORBIDDEN:** Mock data, placeholders, TODOs, stub implementations, test values
**REQUIRED:** Complete, production-ready, fully functional code

### Rule #3: Widget Debugging = Local Sync
**For ANY widget issue, ALWAYS use:**
\`\`\`
snow_pull_artifact({ sys_id: 'widget_sys_id' })
\`\`\`
Then edit locally with OpenCode's native tools, then push back with \`snow_push_artifact\`.

**NEVER use \`snow_query_table\` for widgets!** It hits token limits.

---

## 📋 MCP Servers (411 Tools Total)

### 1. servicenow-unified (235+ tools)

**Deployment & Updates:**
\`\`\`
snow_deploy          - Create NEW artifacts (widgets, flows, scripts)
snow_update          - UPDATE existing artifacts
snow_validate_deployment - Validate before deploying
snow_preview_widget  - Preview widgets
\`\`\`

**Local Development:**
\`\`\`
snow_pull_artifact   - Pull ANY artifact to local files
snow_push_artifact   - Push local changes back
snow_list_local_artifacts - List pulled artifacts
\`\`\`

**CRUD Operations:**
\`\`\`
snow_query_table     - Query any ServiceNow table
snow_create_record   - Create records
snow_update_record   - Update records
snow_delete_record   - Delete records
\`\`\`

**Automation:**
\`\`\`
snow_execute_script_with_output - Run background scripts (ES5 only!)
snow_create_business_rule - Create business rules
snow_create_scheduled_job - Schedule jobs
\`\`\`

**UI Builder & Workspaces:**
\`\`\`
snow_create_uib_page - Create UI Builder pages
snow_create_workspace - Create agent workspaces
snow_create_complete_workspace - Full workspace with landing page
\`\`\`

[... and 200+ more tools]

### 2. snow-flow (176+ tools)

**Multi-Agent Coordination (Use OpenCode's Task system!):**
\`\`\`
swarm_init({ topology: 'hierarchical', maxAgents: 8 })
agent_spawn({ type: 'widget-creator', objective: '...' })
\`\`\`

**Memory & Context:**
\`\`\`
memory_search({ query: 'workspace sys_ids' })
memory_usage() - Check memory usage
\`\`\`

**🧠 Machine Learning & Predictive Intelligence:**

**🚨 TWO COMPLETELY DIFFERENT ML APPROACHES - ASK USER FIRST!**

**🏢 Native ServiceNow Predictive Intelligence (NEW! v7.4.0):**
- Runs INSIDE ServiceNow instance (requires PI license)
- Production-ready, auto-retrain, enterprise ML
- **ALWAYS ASK:** "Do you have a ServiceNow Predictive Intelligence license?"

\`\`\`
# Native PI Tools (Production):
snow_create_pi_solution({ name, table, output_field, solution_type })
snow_train_pi_solution({ solution_id }) - Trains in ServiceNow (10-30 min)
snow_monitor_pi_training({ solution_id }) - Monitor progress/accuracy
snow_activate_pi_solution({ solution_id }) - Activate for production
snow_list_pi_solutions() - List all PI solutions
ml_predictive_intelligence({ solution_id, record_id }) - Make predictions
\`\`\`

**💻 Local TensorFlow.js ML (Experimental, FREE):**
- Runs locally on dev machine (no ServiceNow license required)
- Development/testing only, NOT for production

\`\`\`
# Local ML Tools (Dev/Testing Only):
neural_train({ type: 'incident_classifier', dataset: [...] })
neural_patterns() - Get learned patterns
ml_train_incident_classifier() - Train LSTM locally
ml_predict_change_risk() - Local risk prediction
ml_detect_anomalies() - Local anomaly detection
\`\`\`

**📋 ML Decision Matrix for Agents:**
| User Request | Has PI License? | Recommend |
|--------------|----------------|-----------|
| "Create incident predictor" | ✅ Yes | snow_create_pi_solution + snow_train_pi_solution |
| "Create incident predictor" | ❌ No | neural_train or ml_train_incident_classifier |
| "Production ML solution" | ✅ Yes | Native PI (always) |
| "Production ML solution" | ❌ No | STOP: Explain PI license required for production |
| "Test/experiment with ML" | Either | Can use local TensorFlow.js tools |

**🚨 CRITICAL: ALWAYS ask "Do you have a ServiceNow Predictive Intelligence license?" before recommending ML tools!**

**Performance Tracking:**
\`\`\`
performance_report({ timeframe: '24h' })
token_usage() - Track LLM token usage
\`\`\`

---

## 🤖 Multi-Agent Coordination with OpenCode

### Using OpenCode's Native Task System

OpenCode has **built-in multi-agent support** via the \`Task()\` function:

\`\`\`
// Spawn specialized agents for different tasks
Task("widget-creator", "Create incident dashboard widget with snow_deploy");
Task("tester", "Test the widget after widget-creator completes");
Task("documenter", "Document the widget after testing passes");
\`\`\`

### Anti-Loop Rules (CRITICAL!)
**NEVER spawn duplicate agents!** This causes infinite loops:

**❌ WRONG (Causes infinite loop):**
\`\`\`
Task("UI Builder Tools Tester", "Test UI Builder");
Task("UI Builder Tools Tester", "Test UI Builder");  // DUPLICATE!
\`\`\`

**✅ CORRECT (Unique agents):**
\`\`\`
Task("workspace-architect", "Create workspace with snow_create_workspace");
Task("ui-designer", "Design UI after workspace-architect completes");
Task("validator", "Validate after ui-designer completes");
\`\`\`

**Rules:**
1. ONE agent per task type maximum
2. Use specific, unique agent names
3. Wait for completion before spawning next
4. Check Memory for existing work

### Alternative: Use snow-flow MCP Tools

If you need advanced orchestration, use the \`snow-flow\` MCP server:

\`\`\`
// Initialize swarm
swarm_init({
  topology: 'hierarchical',
  maxAgents: 8,
  strategy: 'auto'
});

// Spawn specialized agents
agent_spawn({
  type: 'widget-creator',
  objective: 'Create incident dashboard',
  capabilities: ['snow_deploy', 'snow_update']
});
\`\`\`

---

## 🛠 Common Workflows

### Create a Service Portal Widget

\`\`\`
1. Use snow_deploy to create widget:
   snow_deploy({
     type: 'widget',
     config: {
       name: 'my_widget',
       title: 'My Widget',
       template: '<div>{{data.message}}</div>',
       server_script: 'data.message = "Hello";',
       client_script: 'function($scope) { var c = this; }'
     }
   })

2. Test with snow_preview_widget

3. Update if needed with snow_update
\`\`\`

### Debug an Existing Widget

\`\`\`
1. Pull to local files:
   snow_pull_artifact({
     sys_id: 'widget_sys_id',
     table: 'sp_widget'
   })

2. Edit locally with OpenCode's native tools

3. Push back:
   snow_push_artifact({ sys_id: 'widget_sys_id' })
\`\`\`

### Create Complete Agent Workspace

\`\`\`
snow_create_complete_workspace({
  name: 'IT Support Workspace',
  tables: ['incident', 'task', 'problem'],
  roles: ['itil', 'admin'],
  landing_page: {
    title: 'IT Support Dashboard',
    charts: true,
    list_filters: true
  }
})
\`\`\`

---

## 🔍 Debugging Best Practices

### 1. Verify First, Fix Second
**ALWAYS test before claiming something is broken:**
\`\`\`
// Test if table exists
var gr = new GlideRecord('my_table');
gs.info('Table valid: ' + gr.isValid());

// Test if property exists
var prop = gs.getProperty('my.property');
gs.info('Property: ' + (prop || 'NOT SET'));
\`\`\`

### 2. Use Background Scripts for Verification
\`\`\`
snow_execute_script_with_output({
  script: "var gr = new GlideRecord('incident'); gr.query(); gs.info('Count: ' + gr.getRowCount());",
  description: "Count incidents"
})
\`\`\`

**Remember:** All scripts must be **ES5 only**!

### 3. Widget Coherence
Widgets need perfect communication between:
- **Server script** → Sets \`data\` properties
- **Client script** → Implements methods HTML calls
- **HTML template** → Uses \`data\` properties and calls methods

**Check:**
- [ ] Every \`data.property\` in server is used in HTML
- [ ] Every \`ng-click\` in HTML has matching \`$scope.method\`
- [ ] Every \`c.server.get({action})\` has matching \`if(input.action)\`

---

## 💡 OpenCode-Specific Tips

### LLM Provider Selection

**🎯 You have FIVE main options:**

#### Option 1: Claude Pro/Max Subscription (RECOMMENDED if you have it)
\`\`\`bash
# ⭐ Use your EXISTING Claude Pro ($20/month) or Max ($40/month)
# ✅ No API key needed - OpenCode logs in with your Anthropic account
# ✅ No additional costs beyond your existing subscription
# ✅ Same Claude models, same quality, just via OpenCode

# Setup:
DEFAULT_LLM_PROVIDER=anthropic
DEFAULT_ANTHROPIC_MODEL=claude-sonnet-4
ANTHROPIC_API_KEY=  # Leave empty - OpenCode will prompt login
\`\`\`

#### Option 2: Pay-Per-Use API (No subscription)
\`\`\`bash
# Use Anthropic API directly (if no Claude Pro/Max)
DEFAULT_LLM_PROVIDER=anthropic
DEFAULT_ANTHROPIC_MODEL=claude-sonnet-4
ANTHROPIC_API_KEY=sk-ant-your-api-key  # Get from console.anthropic.com

# Or OpenAI
DEFAULT_LLM_PROVIDER=openai
DEFAULT_OPENAI_MODEL=gpt-4o
OPENAI_API_KEY=sk-your-api-key
\`\`\`

#### Option 3: 100% Free with Ollama (Offline, Private)
\`\`\`bash
# Install: https://ollama.com
# Setup: ollama pull llama3.1 && ollama serve

DEFAULT_LLM_PROVIDER=ollama
DEFAULT_OLLAMA_MODEL=llama3.1
OLLAMA_BASE_URL=http://localhost:11434
# ✅ FREE • ✅ OFFLINE • ✅ PRIVATE • ✅ No API keys needed
\`\`\`

#### Option 4: LM Studio (GUI + Local)
\`\`\`bash
# Download: https://lmstudio.ai
# Easiest local option with beautiful GUI
# Supports: Llama 3.2, Mistral, Phi, Gemma, DeepSeek, Qwen 2.5

DEFAULT_LLM_PROVIDER=openai  # LM Studio mimics OpenAI API
OPENAI_BASE_URL=http://localhost:1234/v1
DEFAULT_OPENAI_MODEL=llama-3.1-8b
# ✅ FREE • ✅ GUI • ✅ No coding needed
\`\`\`

#### Option 5: High-Performance Local (vLLM, LocalAI)
\`\`\`bash
# vLLM - 2-4x faster inference
# Install: pip install vllm
# Start: python -m vllm.entrypoints.openai.api_server --model llama3.1

DEFAULT_LLM_PROVIDER=openai
OPENAI_BASE_URL=http://localhost:8000/v1
DEFAULT_OPENAI_MODEL=llama3.1

# OR LocalAI - Most versatile, supports images + audio
# Docker: docker run -p 8080:8080 localai/localai
LOCALAI_BASE_URL=http://localhost:8080/v1
\`\`\`

### Quick Decision Guide

**Have Claude Pro/Max?** → Use Option 1 (no extra cost!)
**Want best quality?** → Use Option 2 (Claude Sonnet 4 or GPT-4o API)
**Want 100% free?** → Use Option 3 (Ollama) or Option 4 (LM Studio)
**Want performance?** → Use Option 5 (vLLM)
**Want offline/private?** → Use Option 3, 4, or 5 (all local)

### Instructions Priority

OpenCode loads instructions in this order:
1. \`.opencode/AGENTS.md\` (this file)
2. \`AGENTS.md\` (root)
3. \`CLAUDE.md\` (backward compatibility)
4. Custom instruction files in \`opencode.json\`

### Custom Modes

Create task-specific modes in \`.opencode/modes/\`:
- \`servicenow-widget.md\` - Widget development mode
- \`servicenow-debug.md\` - Debugging mode
- \`servicenow-deploy.md\` - Deployment mode

---

## 🚨 Common Mistakes to Avoid

### ❌ Using Modern JavaScript
\`\`\`javascript
// DON'T DO THIS - Will crash ServiceNow!
const incidents = await getIncidents();
const open = incidents.filter(i => i.state === 'open');
\`\`\`

### ❌ Using snow_query_table for Widgets
\`\`\`javascript
// DON'T DO THIS - Hits token limits!
snow_query_table({ table: 'sp_widget', sys_id: '...' })

// DO THIS INSTEAD:
snow_pull_artifact({ sys_id: '...', table: 'sp_widget' })
\`\`\`

### ❌ Spawning Duplicate Agents
\`\`\`javascript
// DON'T DO THIS - Infinite loop!
Task("Tester", "Test workspace");
Task("Tester", "Test workspace");  // DUPLICATE!
\`\`\`

---

## 📚 Resources

- **OpenCode Docs**: https://opencode.ai/docs
- **Snow-Flow GitHub**: https://github.com/groeimetai/snow-flow
- **ServiceNow Docs**: https://docs.servicenow.com

---

**Built with OpenCode • Powered by Multi-LLM • 411 ServiceNow Tools**
`;
