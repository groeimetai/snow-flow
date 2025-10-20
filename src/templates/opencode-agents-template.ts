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

**Neural Learning (TensorFlow.js):**
\`\`\`
neural_train({ type: 'incident_classifier', dataset: [...] })
neural_patterns() - Get learned patterns
\`\`\`

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

You can switch LLM providers per task in your \`.env\`:

\`\`\`bash
# Use Claude for complex reasoning
DEFAULT_LLM_PROVIDER=anthropic
DEFAULT_ANTHROPIC_MODEL=claude-sonnet-4

# Or use GPT-4o for general tasks
DEFAULT_LLM_PROVIDER=openai
DEFAULT_OPENAI_MODEL=gpt-4o

# Or local/offline with Ollama
DEFAULT_LLM_PROVIDER=ollama
DEFAULT_OLLAMA_MODEL=llama3.1
\`\`\`

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
