# Snow-Code Agent Architecture Analysis
## Sub-Agent Implementation & Integration Points

**Repository**: `/Users/nielsvanderwerf/snow-code`  
**Analysis Date**: 2025-11-08  
**Scope**: Agent spawning, coordination, tool execution, and memory/state management

---

## Executive Summary

Snow-Code (OpenCode fork) implements a **hierarchical agent system** with:
- **Three built-in agents**: `general`, `build`, `plan`
- **Custom agents** loaded from `.opencode/agent/*.md` files (frontmatter + prompt)
- **Sub-agent invocation** via the `task` tool
- **Tool execution** through unified `streamText` loop with MCP/built-in tools
- **Session-based state** with parent/child relationships
- **Event-driven architecture** using Bus for cross-component communication

The architecture is tightly integrated with the **AI SDK** (`ai` package) for tool calling and streaming, making it suitable for real-time agent execution but requiring careful integration design for DAG/batch operations.

---

## 1. AGENT SPAWNING MECHANISM

### 1.1 Agent Configuration & Loading

**Location**: `/packages/opencode/src/agent/agent.ts`

Agents are defined in multiple ways:

#### Built-in Agents
```typescript
// Lines 232-265: Core agents defined in code
general: {
  name: "general",
  description: "General-purpose agent for research, code search, multi-step tasks",
  mode: "subagent",  // Can only be invoked via task tool
  permission: agentPermission,
  tools: { ...defaultTools }
}

build: {
  name: "build",
  mode: "primary",    // Can be primary/main agent
  permission: agentPermission,
  tools: { ...defaultTools }
}

plan: {
  name: "plan",
  mode: "primary",
  permission: planPermission,  // Restricted write access
  tools: { ...defaultTools }
}
```

#### Custom Agents (User-Defined)
**Location**: `.opencode/agent/*.md`

Agents are **markdown files with frontmatter**:

```yaml
---
description: "When to use this agent"
mode: "subagent|primary|all"
tools:
  bash: true
  webfetch: false
temperature: 0.3
top_p: 0.9
---

System prompt text here...
```

**Loading Process** (`config.ts` lines 84):
1. Scans `~/.opencode/agent/`, `./.opencode/agent/`, `./.snowcode/agent/` directories
2. Parses YAML frontmatter for metadata
3. Merges user agents with built-ins
4. Returns `Record<string, Agent.Info>`

**Agent.Info Schema** (lines 11-37):
```typescript
{
  name: string
  description?: string
  mode: "subagent" | "primary" | "all"
  builtIn: boolean
  topP?: number
  temperature?: number
  permission: {
    edit: "allow" | "deny"
    bash: Record<string, "allow" | "ask" | "deny">
    webfetch?: "allow" | "deny"
  }
  model?: { modelID: string; providerID: string }
  prompt?: string
  tools: Record<string, boolean>  // Tool enable/disable
  options: Record<string, any>
}
```

### 1.2 Sub-Agent Invocation via Task Tool

**Location**: `/packages/opencode/src/tool/task.ts`

The `TaskTool` is the **primary mechanism for spawning sub-agents**:

```typescript
export const TaskTool = Tool.define("task", async () => {
  const agents = await Agent.list()
    .then((x) => x.filter((a) => a.mode !== "primary"))
  
  return {
    description: `Execute task with sub-agents: ${agents.map(a => a.name).join(", ")}`,
    parameters: z.object({
      description: z.string().describe("3-5 word task description"),
      prompt: z.string().describe("Full task prompt"),
      subagent_type: z.string().describe("Agent name to use"),
    }),
    
    async execute(params, ctx) {
      // CRITICAL FLOW:
      
      // 1. Validate agent exists
      const agent = await Agent.get(params.subagent_type)
      if (!agent) throw new Error(`Unknown agent: ${params.subagent_type}`)
      
      // 2. CREATE NEW SESSION with parent relationship
      const session = await Session.create({
        parentID: ctx.sessionID,  // <-- Parent tracking
        title: params.description + ` (@${agent.name} subagent)`,
      })
      
      // 3. Set up event listener for tool progress
      const unsub = Bus.subscribe(MessageV2.Event.PartUpdated, async (evt) => {
        if (evt.properties.part.sessionID !== session.id) return
        // Track tool execution in parent context via metadata
        parts[evt.properties.part.id] = evt.properties.part
        ctx.metadata({...})  // Update parent's tool metadata
      })
      
      // 4. INVOKE AGENT via SessionPrompt.prompt()
      const result = await SessionPrompt.prompt({
        messageID: Identifier.ascending("message"),
        sessionID: session.id,  // Child session
        model: agent.model ?? parentModel,
        agent: agent.name,
        tools: {
          task: false,  // Prevent infinite recursion
          todowrite: false,
          todoread: false,
          ...agent.tools,
        },
        parts: [{ type: "text", text: params.prompt }],
      })
      
      // 5. COLLECT RESULTS
      let all = await Session.messages(session.id)
      all = all.filter((x) => x.info.role === "assistant")
      all = all.flatMap((msg) => msg.parts.filter((x) => x.type === "tool"))
      
      return {
        title: params.description,
        metadata: {
          summary: all,
          sessionId: session.id,  // Link to child session
        },
        output: (result.parts.findLast((x) => x.type === "text"))?.text ?? "",
      }
    }
  }
})
```

**Key Properties**:
- **New Session Creation**: Each sub-agent gets isolated session with parent tracking
- **Tool Disable**: `task` and `todo*` tools disabled to prevent recursion
- **Event Streaming**: Tools are tracked via Bus events as they execute
- **Result Aggregation**: All tool calls and text are returned to parent

---

## 2. AGENT COORDINATION & COMMUNICATION

### 2.1 Session Hierarchy

**Location**: `/packages/opencode/src/session/index.ts`

```typescript
export const Info = z.object({
  id: Identifier.schema("session"),
  projectID: string
  directory: string
  parentID: Identifier.schema("session").optional()  // <-- Parent link
  title: string
  version: string
  time: { created, updated, compacting? }
  summary?: { diffs: FileDiff[] }
  share?: { url: string }
  revert?: { messageID, partID?, snapshot?, diff? }
})
```

**Parent-Child Relationships**:
- Agents can spawn child sessions (via task tool)
- Child sessions inherit parent's context (model, directory, etc.)
- Abort events propagate: `SessionLock.abort(sessionId)` stops child execution
- Results returned to parent via tool output

### 2.2 Event-Driven Communication

**Location**: `/packages/opencode/src/bus/index.ts`

The `Bus` is the central event hub:

```typescript
// Key events for agent communication:
Bus.subscribe(MessageV2.Event.PartUpdated, async (evt) => {
  // Fired when any tool starts/updates/completes
  // part types: "tool", "text", "reasoning", "file", "agent"
  // tool.state.status: "pending" | "running" | "completed" | "error"
})

Bus.subscribe(Session.Event.Started, (evt) => {
  // New session created
})

Bus.subscribe(Permission.Event.Updated, (evt) => {
  // Permission request (for bash, edit, webfetch)
})

Bus.subscribe(Session.Event.Error, (evt) => {
  // Session-level errors
})
```

**ACP Integration** (Agent Control Plane):  
**Location**: `/packages/opencode/src/acp/agent.ts` (lines 57-251)

The ACP bridges Bus events to external agents via the Agent Control Protocol:

```typescript
Bus.subscribe(MessageV2.Event.PartUpdated, async (event) => {
  const props = event.properties
  const { part } = props
  
  if (part.type === "tool") {
    // Translate tool state to ACP messages
    switch (part.state.status) {
      case "pending":
        this.connection.sessionUpdate({
          toolCallId: part.callID,
          title: part.tool,
          kind: toToolKind(part.tool),
          status: "pending",
        })
        break
      case "running":
        this.connection.sessionUpdate({
          toolCallId: part.callID,
          status: "in_progress",
          rawInput: part.state.input,
        })
        break
      case "completed":
        this.connection.sessionUpdate({
          toolCallId: part.callID,
          status: "completed",
          content: [...],
          title: part.state.title,
        })
        break
    }
  }
})
```

**No explicit agent-to-agent messaging**: Agents communicate only through:
1. Task tool → new session creation
2. Session results → parent context
3. Bus events → ACP/UI updates

---

## 3. TOOL EXECUTION ARCHITECTURE

### 3.1 Tool Resolution Flow

**Location**: `/packages/opencode/src/session/prompt.ts` lines 506-660

The `resolveTools()` function is called once per agent invocation:

```typescript
async function resolveTools(input: {
  agent: Agent.Info
  sessionID: string
  modelID, providerID: string
  tools?: Record<string, boolean>
  processor: Processor
}) {
  const tools: Record<string, AITool> = {}
  
  // 1. MERGE TOOL ENABLEMENTS
  const enabledTools = pipe(
    input.agent.tools,  // Agent's tool config
    mergeDeep(await ToolRegistry.enabled(...)),  // Provider restrictions
    mergeDeep(input.tools ?? {}),  // Runtime overrides
  )
  
  // 2. LOAD BUILT-IN TOOLS
  for (const item of await ToolRegistry.tools(providerID, modelID)) {
    if (Wildcard.all(item.id, enabledTools) === false) continue
    
    let schema = ProviderTransform.schema(providerID, modelID, 
      z.toJSONSchema(item.parameters)
    )
    
    tools[item.id] = tool({
      id: item.id,
      description: item.description,
      inputSchema: jsonSchema(schema),
      async execute(args, options) {
        // Called when model invokes tool
        await Plugin.trigger("tool.execute.before", {...}, {args})
        
        const result = await item.execute(args, {
          sessionID: input.sessionID,
          abort: options.abortSignal,
          messageID: input.processor.message.id,
          callID: options.toolCallId,
          agent: input.agent.name,
          metadata: async (val) => {
            // Update tool part with running status
            await Session.updatePart({
              state: {
                title: val.title,
                metadata: val.metadata,
                status: "running",
                input: args,
              },
            })
          },
        })
        
        await Plugin.trigger("tool.execute.after", {...}, result)
        return result
      },
      toModelOutput(result) {
        return { type: "text", value: result.output }
      },
    })
  }
  
  // 3. LOAD MCP TOOLS
  for (const [key, item] of Object.entries(await MCP.tools())) {
    if (Wildcard.all(key, enabledTools) === false) continue
    
    const execute = item.execute
    item.execute = async (args, opts) => {
      await Plugin.trigger("tool.execute.before", {...}, {args})
      const result = await execute(args, opts)
      await Plugin.trigger("tool.execute.after", {...}, result)
      
      // Convert MCP output format to standard
      const output = result.content
        .filter((x) => x.type === "text")
        .map((x) => x.text)
        .join("\n\n")
      
      return {
        title: "",
        metadata: result.metadata ?? {},
        output,
      }
    }
    tools[key] = item
  }
  
  return tools
}
```

### 3.2 Main Execution Loop

**Location**: `/packages/opencode/src/session/prompt.ts` lines 233-420

```typescript
export async function prompt(input: PromptInput): Promise<MessageV2.WithParts> {
  const userMsg = await createUserMessage(input)
  
  if (isBusy(input.sessionID)) {
    // Queue if session already busy
    return new Promise((resolve) => {
      state().queued.get(input.sessionID) ?? []
      queue.push({ messageID: userMsg.info.id, callback: resolve })
      state().queued.set(input.sessionID, queue)
    })
  }
  
  using abort = lock(input.sessionID)  // Resource disposer
  
  const agent = await Agent.get(input.agent ?? "build")
  const model = await resolveModel({agent, model: input.model})
  const system = await resolveSystemPrompt({...})
  const processor = await createProcessor({...})  // Message/part tracking
  const tools = await resolveTools({agent, sessionID, modelID, providerID, processor})
  
  // MAIN LOOP - continues while model calls tools
  let step = 0
  while (true) {
    step++
    
    // Get all messages (with history compaction)
    const msgs = pipe(
      await getMessages({sessionID, model, providerID, signal: abort.signal}),
      (messages) => insertReminders({messages, agent}),
    )
    
    await processor.next(msgs.findLast((m) => m.info.role === "user")?.info.id!)
    
    // STREAM TEXT - AI SDK's streaming function
    const stream = streamText({
      onError: (error) => log.error("stream error", {error}),
      
      // Tool repair - lowercase tool names
      async experimental_repairToolCall(input) {
        const lower = input.toolCall.toolName.toLowerCase()
        if (lower !== input.toolCall.toolName && tools[lower]) {
          return {...input.toolCall, toolName: lower}
        }
        return {
          ...input.toolCall,
          input: JSON.stringify({
            tool: input.toolCall.toolName,
            error: input.error.message,
          }),
          toolName: "invalid",
        }
      },
      
      headers: model.providerID === "opencode" ? {
        "x-opencode-session": input.sessionID,
        "x-opencode-request": userMsg.info.id,
      } : undefined,
      
      maxRetries: 0,  // We handle retries
      activeTools: Object.keys(tools).filter((x) => x !== "invalid"),
      maxOutputTokens: ProviderTransform.maxOutputTokens(...),
      abortSignal: abort.signal,
      stopWhen: stepCountIs(1),  // One agentic step per iteration
      temperature: params.temperature,
      topP: params.topP,
      messages: [
        ...system.map((x) => ({role: "system", content: x})),
        ...MessageV2.toModelMessage(msgs),
      ],
      tools: model.info.tool_call === false ? undefined : tools,
      model: wrapLanguageModel({...}),
    })
    
    // PROCESS STREAM
    let result = await processor.process(stream, {count: 0, max: MAX_RETRIES})
    
    // RETRY LOGIC
    if (result.shouldRetry) {
      for (let retry = 1; retry < MAX_RETRIES; retry++) {
        const delayMs = SessionRetry.getRetryDelayInMs(...)
        const stop = await SessionRetry.sleep(delayMs, abort.signal)
        
        if (stop) break
        
        stream = streamText({...})  // Retry with same parameters
        result = await processor.process(stream, {count: retry, max: MAX_RETRIES})
        if (!result.shouldRetry) break
      }
    }
    
    // CONTINUE LOOP IF TOOLS WERE CALLED
    if (!result.blocked && !result.info.error) {
      if ((await stream.finishReason) === "tool-calls") {
        continue  // Model called tools, loop again
      }
      
      const unprocessed = state().queued.get(input.sessionID) ?? []
      if (unprocessed.length > 0) {
        continue  // Other prompts queued, process them
      }
    }
    
    // DONE: Return result to caller (or queued callbacks)
    const queued = state().queued.get(input.sessionID) ?? []
    for (const item of queued) {
      item.callback(result)
    }
    state().queued.delete(input.sessionID)
    SessionCompaction.prune(input)
    return result
  }
}
```

### 3.3 Processor: Tool Tracking & Parts Management

**Location**: `/packages/opencode/src/session/prompt.ts` lines 996-1200+

```typescript
async function createProcessor(input: {...}) {
  const toolcalls: Record<string, MessageV2.ToolPart> = {}
  let snapshot: string | undefined
  let blocked = false
  let assistantMsg: MessageV2.Assistant | undefined
  
  return {
    async end() {
      if (assistantMsg) {
        assistantMsg.time.completed = Date.now()
        await Session.updateMessage(assistantMsg)
        assistantMsg = undefined
      }
    },
    
    async next(parentID: string) {
      assistantMsg = await createMessage(parentID)
      return assistantMsg
    },
    
    partFromToolCall(toolCallID: string) {
      return toolcalls[toolCallID]
    },
    
    async process(stream: StreamTextResult, retries: {count, max}) {
      // Processes the stream response:
      // 1. Iterates through stream.toolCalls
      // 2. Creates ToolPart for each call
      // 3. Executes tool and captures output
      // 4. Updates parts in session
      // 5. Determines if should retry or continue loop
      
      for await (const event of stream) {
        if (event.type === "step-start") {
          // LLM reasoning/thinking started
        } else if (event.type === "tool-call-created") {
          // Tool call initiated - create pending part
          const part: MessageV2.ToolPart = {
            id: Identifier.ascending("part"),
            sessionID: input.sessionID,
            messageID: assistantMsg.id,
            type: "tool",
            tool: event.toolCall.toolName,
            callID: event.toolCall.toolCallId,
            state: {
              status: "pending",
              input: event.toolCall.args as any,
            },
          }
          toolcalls[event.toolCall.toolCallId] = part
          await Session.updatePart(part)
          
          // Publish event for ACP/UI
          Bus.publish(MessageV2.Event.PartUpdated, {
            part: part,
            delta: undefined,
          })
        } else if (event.type === "tool-call-result") {
          // Tool completed - update part with result
          const part = toolcalls[event.toolCallId]
          if (part && part.state.status === "running") {
            part.state.status = "completed"
            part.state.output = event.result.output
            part.state.title = event.result.title
            part.state.metadata = event.result.metadata
            await Session.updatePart(part)
            
            Bus.publish(MessageV2.Event.PartUpdated, {
              part: part,
              delta: undefined,
            })
          }
        } else if (event.type === "text-delta") {
          // LLM text generation - stream it
          const textPart = assistantMsg.parts.find((p) => p.type === "text")
          if (textPart && textPart.type === "text") {
            textPart.text += event.delta
            await Session.updatePart(textPart)
            
            Bus.publish(MessageV2.Event.PartUpdated, {
              part: textPart,
              delta: event.delta,
            })
          }
        } else if (event.type === "error") {
          // Tool/stream error
          assistantMsg.info.error = translateError(event.error)
          blocked = true
        }
      }
      
      return {
        blocked: blocked,
        shouldRetry: shouldRetryLogic(...),
        parts: assistantMsg.parts,
        info: assistantMsg.info,
      }
    },
  }
}
```

---

## 4. TOOL REGISTRY & MCP INTEGRATION

### 4.1 Built-in Tools

**Location**: `/packages/opencode/src/tool/` (14 tools)

```
bash.ts          - Execute shell commands
read.ts          - Read file contents
write.ts         - Write/create files
edit.ts          - Edit files in-place
glob.ts          - Find files by pattern
grep.ts          - Search file contents
list.ts          - List directory contents
patch.ts         - Apply unified diff patches
webfetch.ts      - Fetch URLs (web/image)
task.ts          - Spawn sub-agents
todo{read,write} - Task management
lsp-*.ts         - Language server protocol
invalid.ts       - Error handling for invalid tools
```

Each tool implements `Tool.Info` interface:
```typescript
interface Tool.Info {
  id: string
  init: () => Promise<{
    description: string
    parameters: z.ZodType
    execute(args: any, ctx: Tool.Context): Promise<{
      title: string
      metadata: any
      output: string
      attachments?: MessageV2.FilePart[]
    }>
  }>
}

interface Tool.Context {
  sessionID: string
  messageID: string
  agent: string
  abort: AbortSignal
  callID?: string
  metadata(input: {title?, metadata?}): void
}
```

### 4.2 MCP (Model Context Protocol) Integration

**Location**: `/packages/opencode/src/mcp/index.ts`

```typescript
export namespace MCP {
  const state = Instance.state(
    async () => {
      const cfg = await Config.get()
      const config = cfg.mcp ?? {}
      const clients: {[name: string]: MCPClient} = {}
      
      // Load all configured MCP servers
      await Promise.all(
        Object.entries(config).map(async ([key, mcp]) => {
          const result = await create(key, mcp).catch(() => undefined)
          if (!result) return
          clients[key] = result.client
        }),
      )
      return {clients, config}
    },
    async (state) => {
      // Cleanup on dispose
      for (const client of Object.values(state.clients)) {
        client.close()
      }
    },
  )
  
  // Connection types:
  // - "remote": HTTP/SSE transports (Anthropic API servers)
  // - "local": stdio transport (subprocess)
  
  async function create(name: string, mcp: Config.Mcp) {
    if (mcp.type === "remote") {
      // Try StreamableHTTP then SSE
      const transport = new StreamableHTTPClientTransport(
        new URL(mcp.url),
        {requestInit: {headers: mcp.headers}}
      )
      const client = await experimental_createMCPClient({
        name: "opencode",
        transport,
      })
      return {client}
    }
    
    if (mcp.type === "local") {
      // Spawn subprocess
      const [cmd, ...args] = mcp.command
      const transport = new StdioClientTransport({
        stderr: "ignore",
        command: cmd,
        args,
        env: {...process.env, ...mcp.environment},
      })
      const client = await experimental_createMCPClient({
        name: "opencode",
        transport,
      })
      return {client}
    }
  }
  
  export async function tools() {
    const result: Record<string, Tool> = {}
    for (const [clientName, client] of Object.entries(await clients())) {
      for (const [toolName, tool] of Object.entries(await client.tools())) {
        // Sanitize names: replace spaces/hyphens with underscores
        const sanitized = `${clientName}_${toolName}`
          .replace(/\s+/g, "_")
          .replace(/[-\s]+/g, "_")
        result[sanitized] = tool
      }
    }
    return result
  }
}
```

**MCP Configuration** (opencode.json):
```json
{
  "mcp": {
    "snow-flow": {
      "type": "local",
      "command": ["snow-flow", "mcp"],
      "environment": {
        "SNOW_INSTANCE": "dev.service-now.com"
      },
      "timeout": 5000,
      "enabled": true
    },
    "anthropic-api": {
      "type": "remote",
      "url": "https://api.anthropic.com/mcp",
      "headers": {"Authorization": "Bearer ..."},
      "timeout": 10000
    }
  }
}
```

---

## 5. KEY INTEGRATION POINTS FOR PROPOSED IMPROVEMENTS

### 5.1 DAG (Directed Acyclic Graph) Execution

**Current Limitation**: Linear agentic loop - tools execute sequentially

**Proposed Integration**:

```typescript
// Location: /packages/opencode/src/session/prompt.ts (new)

interface DAGTask {
  id: string
  agentName: string
  prompt: string
  dependencies: string[]  // Task IDs that must complete first
  timeoutMs?: number
  retryCount?: number
}

interface DAGExecutionPlan {
  tasks: Record<string, DAGTask>
  rootTaskIds: string[]
  
  async execute(
    sessionID: string,
    processor: Processor,
  ): Promise<Record<string, TaskResult>>
}

// Hook point: resolveTools -> allow tasks to batch-execute
// Modified streamText loop:
// 1. Detect if model output contains multiple tool calls
// 2. Check if calls are independent (no dependencies)
// 3. Execute in parallel if provider/model supports
// 4. Otherwise fall back to sequential
```

**Key Challenges**:
- AI SDK's `streamText` is designed for sequential tool calling
- Would need wrapper for parallel execution
- Tool output order matters for LLM reasoning
- Session message ordering must be preserved

**Hook Point**: Line 261-348 (streamText call)

### 5.2 Streaming Memory & Context Window Management

**Current Limitation**: Full history passed to model each turn

**Proposed Integration**:

```typescript
// Location: /packages/opencode/src/session/prompt.ts (modify getMessages)

async function getMessages(input: {
  sessionID: string
  model: ModelsDev.Model
  providerID: string
  signal: AbortSignal
  memory?: StreamingMemory  // NEW
}) {
  let msgs = await Session.messages(input.sessionID)
    .then(MessageV2.filterCompacted)
  
  // Stream memory integration points:
  
  // 1. Compress old turns using memory summarization
  if (input.memory?.hasOverflow()) {
    const summary = await input.memory.summarize({
      messages: msgs.slice(0, -3),  // Keep last 3 turns raw
      model: input.model,
    })
    msgs = [
      {info: {role: "system", content: summary}},
      ...msgs.slice(-3),
    ]
  }
  
  // 2. Use memory vector store for relevant context retrieval
  const relevantContext = await input.memory.retrieve({
    query: msgs[msgs.length - 1],  // Last user message
    topK: 5,
  })
  
  // 3. Inject relevant past turns before final turn
  if (relevantContext.length > 0) {
    msgs = [
      ...msgs.slice(0, -1),
      {
        info: {role: "system", type: "text"},
        content: `Related context from previous turns:\n${relevantContext.map(r => r.text).join("\n---\n")}`,
      },
      msgs[msgs.length - 1],
    ]
  }
  
  return msgs
}
```

**Hook Points**:
- Line 235-240: `getMessages()` call
- Line 429-450: `getMessages()` function body
- Line 437-442: Session compaction logic (already exists)

**Existing Compaction**: 
- SessionCompaction.prune() already compacts old messages
- Could be enhanced with semantic summarization

### 5.3 Tool Batching & Parallel Execution

**Current Limitation**: Tools execute one at a time (model->execute->model)

**Proposed Integration**:

```typescript
// Location: /packages/opencode/src/session/prompt.ts (processor.process)

async function processBatch(
  toolCalls: Array<{
    toolCallId: string
    toolName: string
    args: any
  }>,
  tools: Record<string, AITool>,
  processor: Processor,
): Promise<ToolResult[]> {
  
  // Check if model supports concurrent tool use
  if (!model.info.concurrentToolCalls) {
    // Execute sequentially
    return processSequential(toolCalls, tools, processor)
  }
  
  // Parallel execution if calls are independent
  const dependencyGraph = analyzeDependencies(toolCalls)
  if (dependencyGraph.hasIndependentCalls) {
    const results = await Promise.all(
      toolCalls.map((call) =>
        tools[call.toolName].execute(call.args, {
          toolCallId: call.toolCallId,
          abortSignal: abort.signal,
        })
      )
    )
    return results
  }
  
  // Fall back to sequential for dependent calls
  return processSequential(toolCalls, tools, processor)
}
```

**Hook Point**: Line 996-1200 (processor.process)

### 5.4 Permission System Enhancement

**Current Implementation**: `/packages/opencode/src/permission/` 

Uses event-based permission requests:

```typescript
// Current flow:
Bus.publish(Permission.Event.Updated, {
  sessionID: string
  permissionID: string
  callID?: string
  type: "bash" | "edit" | "webfetch"
  metadata: any
})

// Enhanced: Could support:
// - Batch permission approvals
// - Pattern-based permissions
// - Delegation to sub-agents
```

**Hook Point**: Line 551-600 (tool.execute in resolveTools)

### 5.5 ACP (Agent Control Plane) Extension Points

**Location**: `/packages/opencode/src/acp/agent.ts` (lines 254-489)

The ACP is designed for integration with IDEs/clients:

```typescript
// Add for DAG support:
async setExecutionPlan(params: {
  sessionId: string
  dagPlan: ExecutionPlan
}): Promise<void> {
  // Validate and store execution plan
  // Trigger SessionPrompt.executePlan()
}

// Existing hooks that could be extended:
async initialize(params)  // Capabilities negotiation
async loadSession(params)  // Session initialization
async prompt(params)       // User input -> agent
async setSessionModel(params)
async setSessionMode(params)
async cancel(params)       // Abort signal
```

---

## 6. ARCHITECTURE PATTERNS

### 6.1 State Management

**Location**: `/packages/opencode/src/project/instance.ts`

Uses **per-instance state** pattern:
```typescript
const state = Instance.state(
  async () => {
    // Initialize state
    return {data}
  },
  async (current) => {
    // Cleanup on dispose
  }
)

// Access: await state() returns Promise<typeof data>
```

**Applied to**:
- `Agent.state()` - Agent definitions
- `SessionPrompt.state()` - Prompt queue
- `MCP.state()` - MCP clients
- `Config.state()` - Configuration
- `ToolRegistry.state()` - Custom tools

### 6.2 Resource Disposal (Using Statement)

**Location**: `/packages/opencode/src/util/defer.ts`

TypeScript 5.2 `using` statement for resource cleanup:

```typescript
using abort = lock(input.sessionID)
// abort.signal is passed to tools/streamText
// On exit: SessionLock.unlock(sessionID) called automatically
```

### 6.3 Plugin System

**Location**: `/packages/opencode/src/plugin/`

Hooks for extending behavior:
```typescript
await Plugin.trigger("tool.execute.before", {
  tool: string
  sessionID: string
  callID: string
}, {args})

await Plugin.trigger("tool.execute.after", {
  tool: string
  sessionID: string
  callID: string
}, result)

await Plugin.trigger("chat.params", {...}, params)
await Plugin.trigger("chat.message", {...}, message)
```

---

## 7. EXECUTION FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT INVOCATION                             │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. SESSION.CREATE (parent ← new session)                       │
│    - Track parent-child relationships                           │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. SESSIONPROMPT.PROMPT(sessionID, agent, prompt)             │
│    - Load agent configuration                                  │
│    - Create processor for tracking                             │
│    - Resolve tools (built-in + MCP)                           │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. MAIN LOOP (while finish_reason === "tool-calls")            │
│    ┌──────────────────────────────────────────────────────┐   │
│    │ a) GET MESSAGES (with history compaction)            │   │
│    │    - Retrieve all messages from session              │   │
│    │    - Filter compacted entries                        │   │
│    │    - Insert reminders (plan/build mode)              │   │
│    │                                                      │   │
│    │ b) STREAMTEXT (AI SDK streaming)                     │   │
│    │    - Send system prompt                              │   │
│    │    - Send message history                            │   │
│    │    - Activate tools                                  │   │
│    │    - Get LLM response stream                         │   │
│    │                                                      │   │
│    │ c) PROCESSOR.PROCESS (tool execution)               │   │
│    │    For each event in stream:                         │   │
│    │    - tool-call-created: Create ToolPart (pending)   │   │
│    │    - tool-call-running: Update status                │   │
│    │    - tool-call-result: Execute tool                 │   │
│    │    - text-delta: Stream LLM text                    │   │
│    │    - error: Handle errors (retry or fail)            │   │
│    │                                                      │   │
│    │ d) SESSION.UPDATE* (persist to storage)             │   │
│    │    - Update message metadata                        │   │
│    │    - Update tool parts                              │   │
│    │    - Publish Bus events                             │   │
│    │                                                      │   │
│    │ e) ACP UPDATES (via Bus subscribers)                │   │
│    │    - Tool pending → ACP tool_call event             │   │
│    │    - Tool running → ACP tool_call_update            │   │
│    │    - Tool completed → ACP with output               │   │
│    │    - Text delta → ACP agent_message_chunk           │   │
│    │                                                      │   │
│    │ f) RETRY LOGIC (if shouldRetry && retries < max)   │   │
│    │    - Sleep with backoff                             │   │
│    │    - Call streamText again                          │   │
│    │                                                      │   │
│    │ g) LOOP CHECK                                       │   │
│    │    - If finish_reason == "tool-calls" → CONTINUE   │   │
│    │    - Else → RETURN                                  │   │
│    └──────────────────────────────────────────────────────┘   │
│                                                                 │
│ (May loop 3-10 times depending on agent's reasoning steps)     │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. RETURN RESULT                                                │
│    - Aggregate all tool parts and text                         │
│    - Return to parent context (via task tool)                  │
│    - Process queued prompts                                    │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. ACP/UI RECEIVES FINAL SESSION STATE                         │
│    - All tool calls with inputs/outputs                        │
│    - LLM reasoning and conclusions                             │
│    - Link to child session (if sub-agent spawned)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. CURRENT LIMITATIONS & INCOMPATIBILITIES

### 8.1 Synchronous Tool Execution
- Tools execute one at a time
- Model must wait for tool output before next turn
- No batching of independent tool calls
- Affects latency with slow tools

### 8.2 Context Window Management
- Full history sent to model each turn
- Relies on SessionCompaction.prune() (basic)
- No semantic summarization
- Memory not queryable across sessions

### 8.3 DAG Execution
- Linear agentic loop only
- Cannot express task dependencies
- No parallel task execution
- Difficult for complex workflows

### 8.4 Tool Calling Limitations
- One-at-a-time tool execution
- No concurrent tool calls support
- Tool call order matters (path-dependent)
- No support for conditional logic

### 8.5 Session Isolation
- Sub-agents get clean sessions
- No direct state sharing with parent
- Results passed only via tool output
- Bus events one-way (child → parent via subscription)

---

## 9. KEY FILES SUMMARY

| Path | Purpose | Key Functions |
|------|---------|---|
| `/packages/opencode/src/agent/agent.ts` | Agent definitions | `Agent.list()`, `Agent.get()`, `Agent.generate()` |
| `/packages/opencode/src/tool/task.ts` | Sub-agent spawning | `TaskTool.execute()` creates new session |
| `/packages/opencode/src/session/prompt.ts` | Main execution | `SessionPrompt.prompt()` agentic loop |
| `/packages/opencode/src/session/prompt.ts` | Tool resolution | `resolveTools()` merges built-in + MCP |
| `/packages/opencode/src/session/prompt.ts` | Processing | `createProcessor()` tracks tool parts |
| `/packages/opencode/src/tool/registry.ts` | Tool loading | `ToolRegistry.tools()` enumerates all |
| `/packages/opencode/src/mcp/index.ts` | MCP clients | `MCP.tools()` aggregates MCP tools |
| `/packages/opencode/src/acp/agent.ts` | IDE integration | ACP event subscribers & message handlers |
| `/packages/opencode/src/config/config.ts` | Configuration | Load agents, MCP, permissions from config |
| `/packages/opencode/src/bus/index.ts` | Event system | `Bus.publish()`, `Bus.subscribe()` |

---

## 10. RECOMMENDED INTEGRATION APPROACH

### Phase 1: Minimal Integration (No Architecture Changes)
1. Add DAG execution layer above `SessionPrompt.prompt()`
2. Batch independent tool calls (no streaming needed)
3. Use existing session/message structures
4. Hook via task tool or new MCP

### Phase 2: Streaming Integration (Requires Refactoring)
1. Extract processor logic into pluggable interface
2. Implement parallel processor variant
3. Add memory context layers
4. Modify resolveTools to support batching

### Phase 3: Full Architecture (Breaking Changes)
1. Redesign tool execution loop (async generators?)
2. Implement memory query layer
3. Add DAG execution primitives
4. Refactor ACP for batch operations

---

## 11. CONCLUSION

Snow-Code's architecture is **well-structured for real-time interactive agent development** but **optimized for sequential tool execution**. The event-driven Bus pattern and session-based state make it suitable for monitoring/tracing, but the tight coupling to AI SDK's `streamText` makes parallel execution difficult without refactoring.

**Recommendation**: For DAG + parallel execution, implement as a **separate orchestration layer** that wraps `SessionPrompt.prompt()` rather than modifying the core loop. This preserves compatibility with existing agents while enabling new capabilities.
