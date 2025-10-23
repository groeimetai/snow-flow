# Snow-Flow Architecture Audit v8.3.3

**Date**: 2025-10-22
**User Concern**: "we gebruiken de agent-factory, en queen toch helemaal niet meer??? dit is toch extreem oud"

---

## 🔍 Investigation Summary

### CRITICAL FINDING: Two Separate Architectures Exist!

Snow-Flow has **TWO DIFFERENT** orchestration systems:

1. **Modern: `swarm` command** - Uses OpenCode/Claude Code Task() system
2. **Legacy: `queen` command** - Uses internal ServiceNowQueen class

---

## 📊 Current Architecture Usage

### ✅ ACTIVELY USED (Modern Swarm Architecture)

**Command**: `snow-flow swarm <objective>`

**Uses:**
- `QueenMemorySystem` only (for session memory)
- `buildQueenAgentPrompt()` - Generates prompt for OpenCode
- OpenCode's native `Task()` system for agent spawning
- MCP tools directly via OpenCode

**Does NOT use:**
- ❌ `ServiceNowQueen` class
- ❌ `AgentFactory`
- ❌ `ParallelAgentEngine`
- ❌ `MCPExecutionBridge` (we just added this!)
- ❌ `NeuralLearning`

**Files involved:**
- `src/cli.ts` (swarm command implementation)
- `src/queen/queen-memory.ts` (ONLY for memory)
- `src/utils/agent-detector.ts` (task analysis)

**How it works:**
```typescript
// Swarm command flow:
1. Analyze objective → AgentDetector
2. Create memory session → QueenMemorySystem
3. Build orchestration prompt → buildQueenAgentPrompt()
4. Send to OpenCode → OpenCode spawns agents via Task()
5. OpenCode coordinates → Uses MCP tools directly
```

---

### ⚠️ LEGACY (Separate Queen Architecture)

**Commands**:
- `snow-flow queen <objective>`
- `snow-flow queen-memory export/import/clear`
- `snow-flow queen-status`
- `snow-flow queen-insights`

**Uses:**
- ✅ `ServiceNowQueen` class
- ✅ `AgentFactory`
- ✅ `ParallelAgentEngine`
- ✅ `MCPExecutionBridge`
- ✅ `NeuralLearning`
- ✅ `QueenMemorySystem`

**Files involved:**
- `src/queen/servicenow-queen.ts` (main orchestrator)
- `src/queen/agent-factory.ts` (agent creation)
- `src/queen/parallel-agent-engine.ts` (parallelization)
- `src/queen/mcp-execution-bridge.ts` (MCP tool execution)
- `src/queen/neural-learning.ts` (learning system)
- `src/queen/queen-knowledge-base.ts` (patterns)

**How it works:**
```typescript
// Queen command flow:
1. Create ServiceNowQueen instance
2. Analyze objective → Queen's own analyzer
3. Spawn agents → AgentFactory
4. Execute tasks → MCPExecutionBridge
5. Learn patterns → NeuralLearning
```

---

## 📋 File-by-File Usage Analysis

### src/queen/ Directory

| File | Used by Swarm? | Used by Queen? | Status |
|------|---------------|----------------|---------|
| `queen-memory.ts` | ✅ YES | ✅ YES | **KEEP** |
| `mcp-execution-bridge.ts` | ❌ NO | ✅ YES | **LEGACY** |
| `servicenow-queen.ts` | ❌ NO | ✅ YES | **LEGACY** |
| `agent-factory.ts` | ❌ NO | ✅ YES | **LEGACY** |
| `parallel-agent-engine.ts` | ❌ NO | ✅ YES | **LEGACY** |
| `neural-learning.ts` | ❌ NO | ✅ YES | **LEGACY** |
| `queen-knowledge-base.ts` | ❌ NO | ✅ YES | **LEGACY** |
| `types.ts` | ❌ NO | ✅ YES | **LEGACY** |
| `index.ts` | ❌ NO | ✅ YES | **LEGACY** |

---

## 💥 The Problem

### Issue 1: Duplicate Orchestration Systems

We have TWO complete orchestration systems:

1. **Modern** (`swarm` command)
   - Uses OpenCode's native Task() system
   - Simpler, delegates to OpenCode
   - Most users use this

2. **Legacy** (`queen` command)
   - Complex internal orchestration
   - Agent spawning, parallel execution, learning
   - Nobody uses this anymore?

### Issue 2: Wasted Development Effort

I just added beautiful formatting to `MCPExecutionBridge`... but:
- ❌ Swarm command doesn't use it!
- ❌ Only the legacy `queen` command uses it
- ❌ Users probably never run `snow-flow queen`

### Issue 3: Confusing Documentation

- README mentions "Queen Agent hive-mind"
- But most users run `swarm` which doesn't use Queen at all
- Documentation doesn't clarify the difference

---

## 🎯 Recommendations

### Option 1: **REMOVE Legacy Queen System** (RECOMMENDED)

**Remove these files:**
```
src/queen/servicenow-queen.ts
src/queen/agent-factory.ts
src/queen/parallel-agent-engine.ts
src/queen/mcp-execution-bridge.ts
src/queen/neural-learning.ts
src/queen/queen-knowledge-base.ts
src/queen/types.ts
src/queen/index.ts
```

**Keep only:**
```
src/queen/queen-memory.ts  (rename to src/memory/session-memory.ts?)
```

**Remove commands:**
- `snow-flow queen`
- `snow-flow queen-memory`
- `snow-flow queen-status`
- `snow-flow queen-insights`

**Benefits:**
- ✅ Cleaner codebase
- ✅ Less confusion
- ✅ Easier maintenance
- ✅ Single orchestration architecture

### Option 2: **Migrate Swarm to Use Queen** (NOT RECOMMENDED)

Make `swarm` command use the full Queen architecture.

**Problems:**
- ❌ More complex
- ❌ Duplicates what OpenCode already does
- ❌ Harder to maintain
- ❌ OpenCode Task() system works great

### Option 3: **Keep Both, Document Clearly**

Keep both systems but clearly document when to use each.

**Problems:**
- ❌ Still confusing
- ❌ Maintenance burden
- ❌ Most users won't use `queen` anyway

---

## 📊 Usage Statistics (Estimated)

Based on CLI analysis:

| Command | Likely Usage |
|---------|-------------|
| `snow-flow swarm` | **90%+** of users |
| `snow-flow queen` | **<5%** of users |
| `snow-flow queen-memory` | **<1%** of users |

---

## 🔥 The Beautiful Output Problem

**The issue that triggered this audit:**

I just added beautiful formatting to `MCPExecutionBridge`... but it's ONLY used by the legacy `queen` command that nobody uses!

**The swarm command:**
- ✅ Delegates to OpenCode
- ✅ OpenCode shows its own output
- ❌ Doesn't use MCPExecutionBridge at all

**Solution:**
If we want beautiful output for swarm, we need to format:
- The orchestration prompt sent to OpenCode
- The progress updates from OpenCode's Task() system
- NOT the internal MCP execution bridge (which swarm doesn't use)

---

## 🚀 Proposed Clean Architecture

```
src/
├── memory/
│   └── session-memory.ts         (renamed from queen-memory.ts)
├── orchestration/
│   ├── swarm-orchestrator.ts     (current swarm command logic)
│   └── prompt-builder.ts          (buildQueenAgentPrompt)
├── utils/
│   ├── agent-detector.ts
│   └── output-formatter.ts        (beautiful CLI output)
└── cli.ts
```

**What's removed:**
- ❌ Entire `src/queen/` directory (except memory)
- ❌ Internal agent factory
- ❌ Internal MCP bridge
- ❌ Internal parallel engine
- ❌ Internal neural learning

**Why:**
- OpenCode already does all of this!
- We're just duplicating functionality
- Simpler = better

---

## 💡 Decision Time

**Questions for user:**

1. **Do you EVER use `snow-flow queen` command?**
   - If NO → Delete the entire Queen architecture
   - If YES → When? Why not use `swarm`?

2. **Do you need the learning/memory features?**
   - Pattern learning
   - Success/failure tracking
   - Insights generation
   - If NO → Delete it all

3. **Should we keep session memory?**
   - `QueenMemorySystem` for swarm sessions
   - Useful for debugging/resume
   - Minimal maintenance burden

---

## 📝 Recommended Action Plan

### Phase 1: Immediate (This Release)

1. ✅ **Mark as deprecated**
   - Add deprecation warnings to `queen` commands
   - Update README

2. ✅ **Stop development**
   - Don't add features to Queen architecture
   - Focus on swarm improvements

### Phase 2: Next Release (v8.4.0)

1. ✅ **Remove Queen commands**
   - Delete `snow-flow queen`
   - Delete `snow-flow queen-memory`
   - Delete `snow-flow queen-status`
   - Delete `snow-flow queen-insights`

2. ✅ **Move to deprecated/**
   - Move all queen/ files except memory to deprecated/

### Phase 3: Future (v9.0.0)

1. ✅ **Delete entirely**
   - Remove deprecated/ queen files
   - Clean up references

---

## 🎯 Bottom Line

**User is RIGHT!**

The Queen/AgentFactory architecture is indeed:
- ❌ Extremely old
- ❌ Not used by main `swarm` command
- ❌ Should have been removed
- ❌ Wasting development time

**The swarm command uses:**
- OpenCode's native Task() system ✅
- Simple memory for session tracking ✅
- MCP tools via OpenCode ✅

**The Queen architecture:**
- Complex internal orchestration ❌
- Duplicate of what OpenCode does ❌
- Legacy from before OpenCode integration ❌
- Should be removed ❌

---

**Last Updated**: 2025-10-22
**Conclusion**: REMOVE Queen architecture, keep only session memory
