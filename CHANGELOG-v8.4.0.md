# Snow-Flow v8.4.0 Release Notes

**Release Date**: 2025-10-23
**Breaking Changes**: Yes (Queen architecture removed)

---

## 🎉 Major Changes

### 🗑️ Queen Architecture Cleanup (Breaking Change)

**Removed ~4,000 lines of legacy code:**
- ❌ Deleted all Queen commands (`queen`, `queen-memory`, `queen-status`, `queen-insights`)
- ❌ Removed Queen architecture files (9 files, ~2,500 lines)
- ❌ Removed intelligence directory (9 files, ~1,800 lines, unused)
- ❌ Removed Queen SDK orchestrator
- ❌ Removed Queen examples

**Kept & Renamed:**
- ✅ `src/memory/session-memory.ts` (was `queen-memory.ts`)
- ✅ `SessionMemorySystem` class (was `QueenMemorySystem`)
- ✅ Backward compatibility export maintained

**Rationale**: The Queen architecture was legacy code that duplicated OpenCode's native Task() system. The modern `swarm` command delegates to OpenCode for orchestration, making the Queen architecture obsolete.

---

## 🎨 New Features

### Beautiful MCP Output Interceptor

**OpenCode output is now beautifully formatted!**

Created `OpenCodeOutputInterceptor` that transforms ugly shell scripts into clean, structured output:

**Before:**
```
Shell Create incident dashboard via MCP server

$ cat > /tmp/create_dashboard.js << 'EOF'
const { spawn } = require('child_process');
... 200 lines of shell script ...
MCP Error: [Auth] Loading environment from .env...
Tool result: {"sys_id": "abc123", ...}
```

**After:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MCP Tool Execution
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Server:  servicenow-ui-builder
  Tool:    snow_create_uib_page
  Action:  Create incident dashboard

  Parameters:
    name: incident_dashboard
    title: Incident Dashboard

✓ Authenticated
✓ Connected to servicenow-ui-builder
✓ Tool executed successfully

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ Success
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Duration: 2.3s

  Record Created:
    sys_id: abc123
    name: incident_dashboard
```

**Features:**
- Real-time pattern detection
- Progress indicators
- Intelligent result summarization
- Color coding
- Duration tracking
- Automatic activation in swarm command

**Usage:**
```bash
# Automatic - beautiful output enabled by default
snow-flow swarm "create incident dashboard"

# Quiet mode for scripts/CI
QUIET=true snow-flow swarm "create incident dashboard"
```

---

## 🐛 Critical Bug Fixes

### MCP Servers Not Found in OpenCode

**Issue**: MCP tools were unavailable in OpenCode with error:
```
Model tried to call unavailable tool 'snow_ensure_active_update_set'.
Available tools: bash, edit, read, write...
```

**Root Cause**: MCP server paths in `.opencode/opencode.json` were **relative** instead of **absolute**:
```json
// ❌ WRONG (relative)
"args": ["dist/mcp/servicenow-mcp-unified/index.js"]

// ✅ FIXED (absolute)
"args": ["/full/path/to/snow-flow/dist/mcp/servicenow-mcp-unified/index.js"]
```

**Fix**: The `snow-flow init` command now creates `.opencode/opencode.json` with absolute paths to MCP server files, ensuring OpenCode can always find them.

**Action Required**: Run `snow-flow init --force` to update your configuration with absolute paths.

---

## 📦 Files Changed

**Created:**
- `src/utils/opencode-output-interceptor.ts` (298 lines)

**Modified:**
- `src/cli.ts` (added interceptor integration, fixed MCP paths)
- `src/memory/session-memory.ts` (moved from queen/)
- `src/sdk/claude-agent-sdk-integration.ts` (local AgentType definition)
- `src/sdk/index.ts` (removed Queen exports)
- `src/agents/index.ts` (removed Queen exports)
- `src/snow-flow-system.ts` (disabled Queen integration)
- `package.json` (version 8.4.0)

**Deleted:**
- `src/queen/` directory (except memory, 8 files)
- `src/intelligence/` directory (9 files)
- `src/examples/queen/`
- `src/sdk/queen-orchestrator.ts`

---

## 📊 Statistics

- **Code Removed**: ~4,000 lines (90% cleanup)
- **Code Added**: ~300 lines (interceptor)
- **Net Reduction**: ~3,700 lines
- **Build Time**: Improved (fewer files)
- **Complexity**: Significantly reduced

---

## 🚀 Migration Guide

### If You Used Queen Commands

**Old:**
```bash
snow-flow queen "create incident dashboard"
snow-flow queen-memory export
snow-flow queen-status
```

**New:**
```bash
snow-flow swarm "create incident dashboard"
# Memory commands removed (session memory is automatic)
# Status monitoring integrated into swarm
```

### If You Used Queen Architecture Directly

The Queen architecture has been completely removed. If you have custom code that imports Queen classes:

**Old:**
```typescript
import { QueenMemorySystem } from 'snow-flow';
```

**New:**
```typescript
import { SessionMemorySystem } from 'snow-flow';
// or use backward-compatible export:
import { QueenMemorySystem } from 'snow-flow'; // Still works via alias
```

### Update MCP Configuration

**Required**: Run init with --force to get absolute MCP paths:
```bash
cd /path/to/your/project
snow-flow init --force
```

Verify the config has absolute paths:
```bash
cat .opencode/opencode.json | grep -A 3 "mcp"
```

---

## 🔧 Technical Details

### OpenCode Output Interceptor

The interceptor uses Node.js Transform streams to:
1. Capture stdout/stderr from OpenCode
2. Detect MCP execution patterns
3. Parse JSON-RPC messages
4. Format with MCPOutputFormatter
5. Display beautiful structured output

**Pattern Detection:**
- Shell command markers
- JSON-RPC protocol messages
- Tool execution start/end
- Success/failure indicators
- MCP server logs

### Session Memory System

Renamed from QueenMemorySystem to SessionMemorySystem:
- Stores swarm session data
- JSON-based file storage
- Patterns, artifacts, learnings
- Task history tracking
- Location: `.snow-flow/sessions/`

---

## ⚠️ Breaking Changes Summary

1. **Queen commands removed** - Use `swarm` command instead
2. **Queen architecture classes removed** - Not needed (OpenCode handles orchestration)
3. **Intelligence directory removed** - Was unused
4. **MCP config format changed** - Absolute paths required (auto-fixed by init)

---

## 🎯 What's Next?

**v8.4.1+:**
- Enhanced error messages in interceptor
- Real-time streaming for long operations
- Custom themes for output formatting
- Interactive progress bars

**v8.5.0:**
- Advanced swarm coordination strategies
- Multi-instance orchestration
- Enhanced memory system
- Performance optimizations

---

## 📚 Documentation Updates

- ARCHITECTURE-AUDIT-v8.3.3.md - Documents Queen removal rationale
- BEAUTIFUL-OUTPUT-EXAMPLE.md - Shows before/after output examples
- README.md - Updated to reflect swarm-only architecture

---

## 🙏 Acknowledgments

Special thanks to the community for feedback on the Queen architecture complexity and the need for better output formatting!

---

**Full Changelog**: https://github.com/groeimetai/snow-flow/compare/v8.3.3...v8.4.0
