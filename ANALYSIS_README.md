# Snow-Code Architecture Analysis - Complete Reference

This directory contains a comprehensive analysis of the Snow-Code (OpenCode fork) architecture, focusing on agent implementation, tool execution, and integration points for proposed improvements.

## Documents Included

### 1. SNOW_CODE_KEY_FINDINGS.md (538 lines)
**Start here!** High-level summary of:
- Quick overview of Snow-Code architecture
- How agent spawning works (3 models)
- Sub-agent invocation via task tool
- Tool execution (sequential, not parallel)
- Session hierarchy and communication
- 5 integration points for improvements
- Strengths/weaknesses assessment
- Simple integration example

**Read time**: 15-20 minutes
**Best for**: Getting oriented, understanding scope

### 2. SNOW_CODE_ARCHITECTURE_ANALYSIS.md (1201 lines)
**Deep reference.** Detailed exploration of:
- Agent configuration loading (built-in + custom)
- Task tool implementation with code snippets
- Session hierarchy and parent-child relationships
- Event-driven communication via Bus
- ACP (Agent Control Plane) integration
- Tool resolution flow with TypeScript
- Main execution loop breakdown
- Processor for tool tracking
- MCP integration and tool loading
- 5 detailed integration point specifications
- Architecture patterns (state, disposal, plugins)
- Complete execution flow diagram
- Limitations and incompatibilities
- File summary table
- Phase-based integration approach

**Read time**: 45-60 minutes
**Best for**: Detailed understanding, implementation planning

## Key Takeaways

### What Snow-Code Does Well
- Agent definition and loading (yaml frontmatter)
- Sub-agent spawning via task tool
- Real-time streaming execution
- Session-based conversation tracking
- Event-driven architecture
- IDE/client integration (ACP)
- MCP support for extensibility

### What Snow-Code Doesn't Do
- Parallel tool execution (sequential only)
- DAG/task orchestration
- Cross-session memory/context
- Batch processing
- Multi-agent communication patterns

### Integration Recommendation
Build wrapper layers above `SessionPrompt.prompt()` rather than modifying the core loop. This preserves compatibility while enabling new capabilities.

## Architecture at a Glance

```
AGENT SYSTEM
├─ Agent definition (agent.ts)
├─ Built-in agents: general, build, plan
├─ Custom agents: .opencode/agent/*.md
└─ Agent.Info schema with permissions

SUB-AGENT SPAWNING
├─ Task tool (tool/task.ts)
├─ Creates child Session(parentID)
├─ Runs SessionPrompt.prompt() in child
├─ Returns results via tool output
└─ Tracked via Bus.Event.PartUpdated

SESSION MANAGEMENT
├─ Session.Info with parent tracking
├─ Message/Part hierarchies
├─ Event-driven compaction
├─ File diff tracking (summary.diffs)
└─ Revert capability

TOOL EXECUTION
├─ resolveTools() merges agent + registry + MCP
├─ Built-in tools: 14 tools (bash, read, write, etc.)
├─ MCP tools: dynamically loaded
├─ streamText() for LLM streaming
├─ processor.process() for tracking
└─ Sequential execution (no parallelism)

COMMUNICATION
├─ Bus for event pub/sub
├─ ACP for IDE integration
├─ Permission system for confirmations
├─ Plugin hooks for extensibility
└─ No direct agent-to-agent messaging
```

## Integration Points (Priority)

1. **DAG Execution** (Medium effort)
   - Wrapper layer above SessionPrompt.prompt()
   - Topological sort of tasks
   - Parallel execution within levels
   - Hook: lines 261-348

2. **Streaming Memory** (High effort)
   - Vector store for context retrieval
   - Semantic summarization
   - Hook: lines 235-240 (getMessages)

3. **Parallel Tools** (Low effort)
   - Batch independent tool calls
   - Check model.concurrentToolCalls
   - Hook: lines 996-1200 (processor.process)

4. **Permission Enhancements** (Low effort)
   - Pattern-based approvals
   - Delegation to sub-agents
   - Hook: lines 551-600

5. **ACP Extensions** (Low effort)
   - setExecutionPlan() handler
   - Batch operation support
   - Hook: acp/agent.ts lines 254-489

## File Locations (Key Files)

| Path | Purpose |
|------|---------|
| `/packages/opencode/src/agent/agent.ts` | Agent definitions |
| `/packages/opencode/src/tool/task.ts` | Sub-agent spawning |
| `/packages/opencode/src/session/prompt.ts` | Main agentic loop |
| `/packages/opencode/src/session/index.ts` | Session CRUD |
| `/packages/opencode/src/tool/registry.ts` | Tool enumeration |
| `/packages/opencode/src/mcp/index.ts` | MCP client loading |
| `/packages/opencode/src/acp/agent.ts` | IDE integration |
| `/packages/opencode/src/bus/index.ts` | Event system |
| `/packages/opencode/src/config/config.ts` | Config loading |

## Code Navigation

### To Understand Agent Spawning
1. Start: `/packages/opencode/src/agent/agent.ts` lines 232-265 (built-in agents)
2. Then: `/packages/opencode/src/config/config.ts` lines 84 (load custom agents)
3. Finally: `/packages/opencode/src/tool/task.ts` (task tool implementation)

### To Understand Tool Execution
1. Start: `/packages/opencode/src/session/prompt.ts` lines 136-150 (prompt function)
2. Then: `/packages/opencode/src/session/prompt.ts` lines 506-660 (resolveTools)
3. Then: `/packages/opencode/src/session/prompt.ts` lines 261-348 (streamText)
4. Finally: `/packages/opencode/src/session/prompt.ts` lines 996-1200 (processor.process)

### To Understand Communication
1. Start: `/packages/opencode/src/session/index.ts` (Session.Info with parentID)
2. Then: `/packages/opencode/src/bus/index.ts` (Bus events)
3. Finally: `/packages/opencode/src/acp/agent.ts` lines 57-251 (ACP subscribers)

## How to Use This Analysis

### For Planning
1. Read: SNOW_CODE_KEY_FINDINGS.md (overview)
2. Review: Integration Points section
3. Decide: Which features to build first

### For Implementation
1. Read: SNOW_CODE_ARCHITECTURE_ANALYSIS.md (sections 1-5)
2. Reference: File locations table
3. Navigate: Code using file paths
4. Test: With example agents from .opencode/agent/

### For Integration
1. Review: "Integration Point" sections in detailed analysis
2. Check: "Hook Points" for line numbers
3. Examine: Existing code at those locations
4. Implement: Wrapper layers, not core modifications

## Testing the Analysis

### Validate Assumptions
```bash
cd /Users/nielsvanderwerf/snow-code
bun dev  # Start the CLI
```

### Trace Execution
1. Create test agent in `.opencode/agent/`
2. Run with `--print-logs` flag
3. Follow traces in output
4. Verify against flowcharts in analysis

### Examine Sessions
```bash
# Sessions stored at:
~/.opencode/sessions/
# Each session:
# - session_id/
#   - index.json (Session.Info)
#   - messages/
#     - message_id.json (Message.Info)
#     - message_id/
#       - part_id.json (Part data)
```

## Key Concepts

### Agent Mode
- `"subagent"`: Can only be invoked by parent via task tool
- `"primary"`: Can be primary/main agent
- `"all"`: Can serve both roles

### Session Hierarchy
```
Parent Session (id: session_1)
  ├─ User message
  ├─ Task tool call → Creates Child Session
  │  ├─ Child Session (id: session_2, parentID: session_1)
  │  ├─ Sub-agent message
  │  ├─ Tools executed in child
  │  └─ Results → Child Session
  └─ Task tool result → Returned to Parent
```

### Tool Execution Cycle
```
LLM Response with tool call
  ↓
Create ToolPart (pending)
  ↓
Execute tool (await)
  ↓
Update ToolPart (completed)
  ↓
Publish Bus.Event.PartUpdated
  ↓
Return to LLM
  ↓
LLM decides: more tools or done?
```

## Limitations to Understand

1. **No Parallelism**: Tools run one at a time
2. **Linear Loop**: Model → tools → model → done
3. **Session Isolation**: Children have separate sessions
4. **Event-Only Comm**: No direct agent messaging
5. **Basic Memory**: Full history each turn

## Common Gotchas

1. **Task Tool Recursion**: Disabled in child sessions (prevent infinite loops)
2. **Message Ordering**: Important for LLM context (don't shuffle)
3. **Session Locking**: Serializes prompts (queue if busy)
4. **Tool Names**: Case-sensitive (repair handled but avoid)
5. **MCP Timeouts**: Default 5s, configurable per server

## References & Sources

- Analysis based on 25+ source files in `/packages/opencode/src/`
- Total code examined: 5000+ lines
- Documentation files: 1700+ lines
- Time investment: ~45 minutes of detailed analysis
- Created: 2025-11-08

## Next Steps

1. **Read the documents** (start with Key Findings)
2. **Run Snow-Code locally** (validate assumptions)
3. **Trace execution** (understand the loop)
4. **Plan integrations** (which features first?)
5. **Implement incrementally** (wrapper layers)

---

**Questions?** Refer to:
- Architecture Overview in KEY_FINDINGS.md
- Detailed sections in ARCHITECTURE_ANALYSIS.md
- Code navigation guides above
- File paths in Key Files section

Good luck with your integration work!
