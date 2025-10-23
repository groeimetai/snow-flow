# Snow-Flow v8.4.11 Release Notes

**Release Date**: 2025-10-23
**Type**: Critical Fix - Template Update for MCP Tool Usage
**Breaking Changes**: No (requires `snow-flow init --force`)

---

## 🚨 Critical Fix

### Updated CLAUDE.md/AGENTS.md Template - Stop OpenCode From Using Bash/Require

**Problem**: OpenCode was trying to call MCP tools via bash/node/require:
```bash
node -e "
const { snow_update_set_manage } = require('./node_modules/@snow-flow/...');
"
# ERROR: Cannot find module - @snow-flow packages DON'T EXIST!
```

**Root Cause**:
- The template (`src/templates/claude-md-template.ts`) didn't have strong enough warnings
- OpenCode/LLMs were treating MCP tools as npm packages or CLI commands
- MCP tools are **MCP protocol functions**, NOT npm packages!

**Fix**: Added comprehensive section to template explaining:

1. **❌ What NEVER works:**
   - `require('./node_modules/@snow-flow/...')` - Packages don't exist
   - `node -e "const { tool } = require(...)"` - Module not found
   - `snow-flow mcp execute --tool` - Not a CLI command

2. **✅ What ALWAYS works:**
   ```javascript
   // Just call the function - it's already loaded!
   const result = await snow_update_set_manage({
     action: 'create',
     name: "Feature: X"
   });
   ```

3. **Why bash/require NEVER works:**
   - MCP tools are NOT npm packages (no node_modules)
   - MCP tools are NOT CLI commands (no executables)
   - MCP tools are loaded via MCP protocol automatically

---

## 📦 Files Changed

**Modified:**
- `src/templates/claude-md-template.ts`: Added "NEVER USE BASH/NODE/REQUIRE" section (lines 30-80)
- `package.json`: Version bump to 8.4.11

---

## 🔧 Migration Guide

### For Existing Users - MUST Re-run Init!

```bash
# Install v8.4.11
npm install -g snow-flow@8.4.11

# Re-run init to get updated templates
cd your-project
snow-flow init --force

# Verify templates are updated
head -100 CLAUDE.md
# Should show new "CRITICAL: NEVER USE BASH/NODE/REQUIRE" section
```

### For New Users

Just run `snow-flow init` - templates include the fix!

---

## 🎯 What This Fixes

### Before v8.4.11:
```bash
# OpenCode tried this:
node -e "
const { snow_update_set_manage } = require('./node_modules/@snow-flow/...');
const result = await snow_update_set_manage({...});
"

# Result: ERROR Cannot find module
```

### After v8.4.11:
```javascript
// OpenCode does this:
const result = await snow_update_set_manage({
  action: 'create',
  name: "Feature: Incident Dashboard"
});

// Result: ✅ Works! Update set created in ServiceNow
```

---

## 📊 Impact

| Issue | Before v8.4.11 | After v8.4.11 |
|-------|----------------|---------------|
| OpenCode uses bash/require | ❌ Tries to require() MCP tools | ✅ Calls functions directly |
| MCP tools work | ❌ Module not found errors | ✅ Tools execute successfully |
| Template has warnings | ⚠️ Some warnings | ✅ Strong explicit warnings |
| Development works | ❌ Stuck on module errors | ✅ Smooth development flow |

---

## 🚧 Important Notes

### About MCP Tools

MCP (Model Context Protocol) tools are **functions exposed via the MCP protocol**, NOT:
- ❌ npm packages in node_modules
- ❌ CLI commands you execute
- ❌ Files you can require()
- ❌ Scripts you run with node

They ARE:
- ✅ Functions loaded automatically by OpenCode/Claude Code
- ✅ Callable directly like any JavaScript function
- ✅ Available immediately without imports/requires

### Why This Confusion Happens

LLMs sometimes think they need to:
1. Install packages (`npm install @snow-flow/...`)
2. Require modules (`const { tool } = require(...)`)
3. Execute commands (`node script.js`)

But MCP tools are **already there** - just call them!

---

## 🎓 Template Changes

The new template section explains:

```markdown
## 🚨 CRITICAL: NEVER USE BASH/NODE/REQUIRE FOR MCP TOOLS!

### ❌ FORBIDDEN - THESE WILL ALWAYS FAIL:
- node -e "const { tool } = require(...)" → ERROR
- cd /path && node -e "..." → ERROR
- snow-flow mcp execute --tool → ERROR

### ✅ CORRECT - Just call the function:
const result = await snow_update_set_manage({...});

### Why bash/require NEVER works:
1. MCP tools are NOT npm packages
2. MCP tools are NOT CLI commands
3. MCP tools are loaded via MCP protocol
```

---

## 🙏 Acknowledgments

Thanks to the community for reporting the bash/require issue!

---

## ⚠️ About Output Formatting

**Note**: The MCP output formatter is currently **not available** with the swarm command.

**Why**:
- OpenCode is a TUI (Terminal User Interface) application
- TUI apps need `stdio: 'inherit'` for full terminal control
- Output formatters require `stdio: ['pipe', 'pipe', 'pipe']`
- These are **incompatible**

**Trade-off**:
- ✅ **With TUI** (current): Swarm works, plain output
- ❌ **With formatter**: Pretty output, but swarm hangs

We prioritized having a **working swarm command** over formatted output.

---

**Full Changelog**: https://github.com/groeimetai/snow-flow/compare/v8.4.10...v8.4.11
