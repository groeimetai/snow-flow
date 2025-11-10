# Snow-Code Architecture: Key Findings & Integration Recommendations

**Date**: 2025-11-08  
**Scope**: Agent spawning, coordination, tool execution, memory management  
**Target**: Integration of DAG execution, streaming memory, and parallel tools

---

## QUICK SUMMARY

Snow-Code (OpenCode fork) is a **well-architected CLI for agentic development** optimized for:
- Interactive real-time agent execution
- Session-based conversation tracking
- Event-driven tool monitoring
- IDE/client integration via ACP protocol

However, it's **not designed for**:
- Parallel tool execution
- DAG-based task orchestration
- Cross-session memory/context
- Batch operation processing

**Recommendation**: Build integration layers above the core `SessionPrompt.prompt()` function rather than modifying the loop.

---

## ARCHITECTURE OVERVIEW

### Core Components

```
Agent System
├── Agent.ts              - Agent definitions (built-in + custom)
├── task.ts              - Sub-agent spawning (creates child sessions)
└── config.ts            - Load agents from .opencode/agent/*.md

Session Management
├── session/index.ts     - Session CRUD, parent-child tracking
├── session/prompt.ts    - Main agentic loop (streamText)
├── session/message-v2.ts - Message/part types
└── session/compaction.ts - History compression

Tool Execution
├── tool/registry.ts     - Tool enumeration & filtering
├── tool/*.ts           - Built-in tools (14 tools)
├── mcp/index.ts        - MCP client loading
└── Session.updatePart  - Persist tool execution state

Communication
├── bus/index.ts        - Event pub/sub
├── acp/agent.ts        - IDE/client integration
└── permission/         - Tool permission requests
```

### Key Patterns

| Pattern | Location | Purpose |
|---------|----------|---------|
| Per-Instance State | project/instance.ts | Lazy-initialized, managed state |
| Resource Disposal | util/defer.ts | TypeScript 5.2 `using` statements |
| Event-Driven | bus/index.ts | Bus.publish/subscribe |
| Plugin Hooks | plugin/ | Extensibility points |
| Session Queuing | session/prompt.ts | Serialize prompt requests |

---

## AGENT SPAWNING: HOW IT WORKS

### 1. Agent Definition (3 Models)

**Built-in agents** (`agent.ts` lines 232-265):
- `general` - Subagent for research/search (mode: "subagent")
- `build` - Primary agent for development (mode: "primary")
- `plan` - Planning agent with restricted permissions (mode: "primary")

**Custom agents** (`.opencode/agent/*.md`):
```yaml
---
description: "When to use"
mode: "subagent|primary|all"
tools: {bash: true, webfetch: false}
temperature: 0.3
---
System prompt...
```

**Loading** (`config.ts` lines 84):
1. Scan `~/.opencode/agent/`, `./.opencode/agent/`, `./.snowcode/agent/`
2. Parse YAML frontmatter
3. Merge with built-ins
4. Return `Record<string, Agent.Info>`

### 2. Sub-Agent Invocation (Task Tool)

**Location**: `tool/task.ts`

```
Parent Agent
    ↓ (calls task tool)
Task Tool Execute
    ├→ Agent.get(subagent_type)
    ├→ Session.create(parentID: current)  ← Creates child session
    ├→ Bus.subscribe(Part.Updated)         ← Track execution
    ├→ SessionPrompt.prompt(sessionID, agent, prompt)  ← Run child
    ├→ Session.messages(sessionID)         ← Collect results
    └→ Return {title, output, sessionId}   ← Back to parent
```

**Key constraint**: Tasks are disabled in child sessions to prevent infinite recursion

### 3. Execution Flow (Main Loop)

**Location**: `session/prompt.ts` lines 136-420

```
PROMPT INVOKED
    ↓
CREATE MESSAGE (user message)
    ↓
RESOLVE AGENT (get Agent.Info)
    ↓
RESOLVE MODEL (determine LLM)
    ↓
RESOLVE SYSTEM PROMPT (build system message)
    ↓
RESOLVE TOOLS (built-in + MCP)
    ↓
MAIN LOOP (while finish_reason === "tool-calls"):
    ├─ GET MESSAGES (history + compaction)
    ├─ STREAM TEXT (AI SDK)
    │  ├─ System prompt
    │  ├─ Message history
    │  ├─ Available tools
    │  └─ Get LLM stream
    ├─ PROCESS STREAM (for each event):
    │  ├─ tool-call-created → Create ToolPart (pending)
    │  ├─ tool-call-running → Update part status
    │  ├─ tool-call-result → Execute tool, get output
    │  ├─ text-delta → Stream text
    │  ├─ error → Handle error
    │  └─ Publish Bus.Event.PartUpdated
    ├─ RETRY LOGIC (if shouldRetry)
    │  └─ Sleep with backoff, retry streamText
    └─ CHECK LOOP CONDITION
        ├─ finish_reason === "tool-calls" → CONTINUE
        └─ else → RETURN result

RETURN RESULT
```

---

## TOOL EXECUTION: SEQUENTIAL, NOT PARALLEL

### Tool Resolution

**Location**: `session/prompt.ts` lines 506-660

```
resolveTools(agent, sessionID, modelID, providerID):
    ├─ MERGE TOOL ENABLEMENTS:
    │  ├─ agent.tools (agent's config)
    │  ├─ ToolRegistry.enabled (provider restrictions)
    │  └─ input.tools (runtime overrides)
    │
    ├─ LOAD BUILT-IN TOOLS (ToolRegistry):
    │  └─ For each enabled tool:
    │     ├─ Generate JSON schema
    │     ├─ Wrap in AI SDK tool()
    │     ├─ Attach execute() handler
    │     ├─ Add metadata() callback
    │     └─ Add Plugin hooks
    │
    └─ LOAD MCP TOOLS:
       └─ For each enabled MCP tool:
          ├─ Call original execute()
          ├─ Parse output format
          ├─ Add Plugin hooks
          └─ Return as AITool
```

### Tool Execution (Sequential)

**In Processor.process()**:
1. Model calls one tool (e.g., `read /path/file.txt`)
2. Create ToolPart with status="pending"
3. Execute tool (awaits completion)
4. Update ToolPart with status="completed" + output
5. Add to message
6. Return to LLM for next turn
7. LLM decides: call another tool or generate text
8. If tool call → loop continues
9. If text only → finish, return to caller

**Total latency**: Sum of all tool execution times (no parallelism)

---

## COMMUNICATION: SESSION HIERARCHY + EVENTS

### Parent-Child Sessions

Each session stores optional `parentID`:
```typescript
{
  id: "session_...",
  projectID: string,
  parentID: "session_..." | undefined,  // Link to parent
  title: string,
  time: {created, updated, compacting?},
  summary?: {diffs: FileDiff[]},  // File changes made
  revert?: {messageID, partID?, snapshot?, diff?},  // Undo info
}
```

**Data flow**:
- Parent creates Session with `parentID: parent.id`
- Child executes tools, modifies files (recorded in summary.diffs)
- Parent queries child Session.summary for file changes
- Task tool returns child sessionId in metadata (for UI linking)

### Event-Driven Communication (Bus)

**Key events**:
```typescript
MessageV2.Event.PartUpdated  // Tool/text/reasoning updated
Session.Event.Started        // New session created
Session.Event.Updated        // Session modified
Session.Event.Error          // Session-level error
Permission.Event.Updated     // Permission request (bash, edit, webfetch)
```

**No direct agent-to-agent messaging**: Agents only communicate via:
1. Shared files (via tool output)
2. Session metadata (sessionId, summary.diffs)
3. Bus events (parents can subscribe)

### ACP Integration (IDE/Client)

**Location**: `acp/agent.ts` (lines 57-251)

The ACP (Agent Control Plane) translates Bus events to IDE messages:

```
Bus.PartUpdated
    ↓
ACP.setupEventSubscriptions()
    ├─ part.state.status = "pending" → sessionUpdate(tool_call, pending)
    ├─ part.state.status = "running" → sessionUpdate(tool_call_update, in_progress)
    ├─ part.state.status = "completed" → sessionUpdate(tool_call_update, completed)
    ├─ part.state.status = "error" → sessionUpdate(tool_call_update, failed)
    ├─ text delta → sessionUpdate(agent_message_chunk)
    ├─ reasoning delta → sessionUpdate(agent_thought_chunk)
    └─ → connection.sessionUpdate(message)  ← To IDE
```

---

## INTEGRATION POINTS FOR IMPROVEMENTS

### 5.1 DAG Execution

**Current limitation**: Linear agentic loop only

**Hook point**: `session/prompt.ts` lines 261-348 (streamText call)

**Proposed approach**:
```
DAG Executor (wrapper around SessionPrompt.prompt)
    ├─ Parse DAG from user input
    ├─ Topologically sort tasks
    ├─ For each task level (no dependencies):
    │  ├─ Spawn SessionPrompt.prompt() for each task
    │  ├─ Run in parallel (Promise.all)
    │  └─ Collect results
    └─ Return aggregated result

Note: Don't modify core loop; wrap it.
```

**Challenges**:
- AI SDK's streamText expects request/response cycle
- Task dependencies can be data-dependent
- Output order matters for LLM context

### 5.2 Streaming Memory

**Current limitation**: Full history sent to model each turn

**Hook point**: `session/prompt.ts` lines 235-240 (getMessages call)

**Proposed approach**:
```
getMessages(sessionID, model, memory?):
    ├─ Load all messages
    ├─ If memory.hasOverflow():
    │  ├─ Summarize old turns (via LLM)
    │  └─ Inject summary as system message
    ├─ If memory.retrieve() available:
    │  ├─ Query vector store for relevant context
    │  └─ Inject before latest turn
    └─ Return: [system prompts, context, history, current turn]
```

**Integration**:
- `SessionCompaction.prune()` already compacts (lines 437-442)
- Add semantic summarization layer
- Support vector embeddings for context retrieval

### 5.3 Tool Batching & Parallel Execution

**Current limitation**: Tools execute sequentially

**Hook point**: `session/prompt.ts` lines 996-1200 (processor.process)

**Proposed approach**:
```
processor.process(stream):
    ├─ Collect all tool-call-created events
    ├─ If model.concurrentToolCalls === true:
    │  ├─ Analyze dependencies (outputs→inputs)
    │  ├─ Execute independent calls in parallel
    │  └─ Collect results
    └─ Update message with all results
```

**Requirements**:
- Model must support concurrent tools (Claude 3.5, GPT-4 Turbo, etc.)
- Tool outputs must be independent
- Message ordering must be preserved

### 5.4 Permission System

**Current implementation**: Event-based permission requests

**Hook point**: `session/prompt.ts` lines 551-600 (tool.execute)

**Enhancement**:
- Support pattern-based approvals ("allow all bash read-only")
- Delegate to sub-agents ("ask approver agent")
- Batch permission requests

### 5.5 ACP Extensions

**Location**: `acp/agent.ts` (lines 254-489)

**Existing hooks**:
```typescript
async initialize(params)
async loadSession(params)
async prompt(params)           ← User input
async setSessionModel(params)
async setSessionMode(params)
async setSessionModelParams(params)  ← New: temperature, top_p
async cancel(params)
```

**New hooks for DAG/batching**:
```typescript
async setExecutionPlan(params: {
  sessionId: string
  dagPlan: {
    tasks: Record<string, {
      id: string
      agentName: string
      prompt: string
      dependencies: string[]
    }>
  }
}): Promise<void>
```

---

## KEY FILES TO MODIFY

### For DAG Integration
1. **Create**: `/packages/opencode/src/dag/executor.ts`
   - DAGTask, DAGPlan types
   - executor.execute(plan, sessionID)
   
2. **Modify**: `/packages/opencode/src/session/prompt.ts`
   - Export executePlan() variant
   - Support non-linear execution

3. **Extend**: `/packages/opencode/src/acp/agent.ts`
   - Add setExecutionPlan() handler

### For Streaming Memory
1. **Create**: `/packages/opencode/src/memory/streaming.ts`
   - StreamingMemory interface
   - Summarization logic
   - Vector store interface

2. **Modify**: `/packages/opencode/src/session/prompt.ts`
   - Enhance getMessages() to use memory
   - Integrate with SessionCompaction

### For Parallel Tools
1. **Modify**: `/packages/opencode/src/session/prompt.ts`
   - processor.process() to batch tool calls
   - Check model.info.concurrentToolCalls

---

## ARCHITECTURE STRENGTHS & WEAKNESSES

### Strengths ✅
- **Clean separation**: Agent logic / Tool execution / Session state
- **Extensibility**: Plugin hooks, MCP support, custom agents
- **Observability**: Bus events for all operations, ACP integration
- **Resource management**: `using` statement for cleanup
- **Real-time**: Streaming support via AI SDK
- **Debugging**: Full message/part history in sessions

### Weaknesses ❌
- **No parallelism**: Tools run sequentially (big latency hit)
- **Limited memory**: Full history each turn, basic compaction
- **No DAG support**: Linear agentic loop only
- **Session isolation**: Data sharing only via files/stdout
- **Tool dependencies**: No explicit task graphs
- **Tight coupling**: Core loop tightly bound to AI SDK streamText

---

## COMPATIBILITY ASSESSMENT

### Breaking Changes (Avoid)
- Modifying tool execution loop directly
- Changing message schema
- Removing Bus event publishing
- Changing Session.Info type

### Safe Extensions (Recommended)
- Adding new agents (just .md files)
- Creating DAG wrapper layer
- Extending Plugin hooks
- Adding new Bus events
- Creating Memory layer

### Neutral Changes
- Adding new MCP servers
- Creating new built-in tools
- Modifying ACP with new handlers
- Adding new SessionPrompt.* functions

---

## EXAMPLE: SIMPLE INTEGRATION PATTERN

```typescript
// /packages/opencode/src/dag/executor.ts

export namespace DAGExecutor {
  export interface Task {
    id: string
    agentName: string
    prompt: string
    dependencies: string[]  // Task IDs
  }
  
  export interface Plan {
    tasks: Record<string, Task>
    rootTaskIds: string[]
  }
  
  export async function execute(
    sessionID: string,
    plan: Plan,
    context: {
      baseModel: {providerID: string; modelID: string}
      baseAgent: string
    }
  ): Promise<Record<string, TaskResult>> {
    const results: Record<string, TaskResult> = {}
    const levels = topologicalSort(plan)
    
    for (const taskIds of levels) {
      // Execute all tasks at this level in parallel
      const promises = taskIds.map(async (taskId) => {
        const task = plan.tasks[taskId]
        const result = await SessionPrompt.prompt({
          sessionID,
          agent: task.agentName,
          parts: [{type: "text", text: task.prompt}],
        })
        results[taskId] = {
          output: result.parts.find((p) => p.type === "text")?.text,
          tools: result.parts.filter((p) => p.type === "tool"),
        }
      })
      
      await Promise.all(promises)
    }
    
    return results
  }
}

// Usage:
await DAGExecutor.execute(sessionID, {
  tasks: {
    "task-1": {id: "task-1", agentName: "general", prompt: "Search for X", dependencies: []},
    "task-2": {id: "task-2", agentName: "build", prompt: "Implement X", dependencies: ["task-1"]},
  },
  rootTaskIds: ["task-1"]
})
```

---

## RECOMMENDED READING ORDER

1. **Start here**: This file (you are here)
2. **Deep dive**: `SNOW_CODE_ARCHITECTURE_ANALYSIS.md` (sections 1-3)
3. **Tool details**: `SNOW_CODE_ARCHITECTURE_ANALYSIS.md` (sections 4-5)
4. **Code exploration**:
   - `/packages/opencode/src/agent/agent.ts` (agent config)
   - `/packages/opencode/src/tool/task.ts` (sub-agent spawning)
   - `/packages/opencode/src/session/prompt.ts` (main loop)

---

## NEXT STEPS

1. **Validate assumptions**: Run Snow-Code locally, trace execution
2. **Build DAG layer**: Create wrapper in `/packages/opencode/src/dag/`
3. **Test integration**: Create test agents with dependencies
4. **Extend ACP**: Add setExecutionPlan() handler
5. **Document flows**: Update .md files with new patterns

---

**Generated**: 2025-11-08  
**Analysis Tool**: Claude Code File Search Specialist  
**Total Analysis Time**: ~45 minutes  
**Files Examined**: 25+ source files  
**Lines of Code Analyzed**: 5000+
