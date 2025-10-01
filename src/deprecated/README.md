# Deprecated Code

This directory contains legacy code that has been replaced by the Claude Agent SDK v0.1.1 integration.

## Why These Files Are Deprecated

As of Snow-Flow v4.7.0, we have migrated from custom agent infrastructure to the official **@anthropic-ai/claude-agent-sdk@0.1.1**. This resulted in an **86% code reduction** (2832 lines → 400 lines) while maintaining all unique intelligence.

## Deprecated Files

### `real-agent-spawner.deprecated.ts`
- **Original:** 701 lines
- **Replaced by:** `ClaudeAgentSDKIntegration` (uses SDK's native `query()` function)
- **Why:** The SDK provides superior agent spawning with built-in process management, error handling, and coordination

### `base-agent.deprecated.ts`
- **Original:** 251 lines
- **Replaced by:** SDK's native agent execution (no abstraction needed)
- **Why:** The SDK handles agent lifecycle, message passing, and tool invocation natively

### `queen-agent.deprecated.ts`
- **Original:** 1380 lines
- **Replaced by:** `QueenOrchestrator` (~400 lines focused on intelligence)
- **Why:** Simplified to focus on domain intelligence (analysis, planning, parallelization strategy) while delegating execution to SDK

### `mcp-server-manager.deprecated.ts`
- **Original:** ~300 lines
- **Replaced by:** SDK's built-in MCP server management
- **Why:** The SDK automatically manages MCP server lifecycle, connections, and tool availability

## What We Kept (Unique Value)

The following components were **NOT deprecated** because they provide unique value beyond the SDK:

1. **ParallelAgentEngine** (`src/queen/parallel-agent-engine.ts`) - Intelligent parallelization strategy (2.8-4.4x speedup)
2. **MemorySystem** (`src/memory/memory-system.ts`) - Advanced SQLite-based memory with pattern learning
3. **ServiceNow MCP Unified** (`src/mcp/servicenow-mcp-unified/`) - 448 tools across 90+ ServiceNow domains

## Migration Guide

For detailed migration instructions, see:
- **Migration Guide:** `/docs/SDK_MIGRATION_GUIDE.md`
- **Analysis Document:** `/docs/analysis/CLAUDE_AGENT_SDK_ANALYSIS.md`

## When to Use These Files

**DO NOT USE** these deprecated files for new development. They are kept for:
- Reference purposes only
- Understanding legacy architecture
- Potential rollback scenarios (emergency only)

## Removal Timeline

These files will be completely removed in Snow-Flow v5.0.0 (estimated Q2 2025).

---

**Status:** ✅ Migration Complete (v4.7.0)
**Date:** October 1, 2025
