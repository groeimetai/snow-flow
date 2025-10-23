# Snow-Flow v8.4.10 Release Notes

**Release Date**: 2025-10-23
**Type**: Critical Fixes - OpenCode Directory Structure & MCP Verification
**Breaking Changes**: No (requires `snow-flow init` re-run)

---

## 🚨 Critical Fixes

### Fix 1: OpenCode Directory Structure - "agents" → "agent"

**Problem**: OpenCode error: `Directory "agents" in .opencode is not valid. Use "agent" instead.`

**Root Cause**:
- `snow-flow init` created `.opencode/agents/` directory (plural)
- OpenCode expects `.opencode/agent/` directory (singular)
- This is an OpenCode naming convention requirement

**Fix**:
```typescript
// BEFORE (v8.4.9 and earlier):
const agentsDir = join(opencodeDir, 'agents');  // WRONG - plural

// AFTER (v8.4.10):
const agentsDir = join(opencodeDir, 'agent');  // CORRECT - singular
```

**Files changed**:
- `src/cli.ts` lines 2537, 2546, 2558: Changed 'agents' to 'agent'

---

### Fix 2: MCP Verification False Negative for Snow-Flow Server

**Problem**: MCP verification showed snow-flow as failed even though it started successfully:
```
Testing snow-flow... ✗
   Snow-Flow MCP server running on stdio...
```

**Root Cause**:
- Snow-Flow MCP server logs startup message to stderr (not stdout)
- Verification treated ANY stderr output as error
- Message "Snow-Flow MCP server running on stdio..." is actually a SUCCESS message

**Fix**:
```typescript
// BEFORE: All stderr = error
} else if (error) {
  console.log(chalk.red('✗'));
  failCount++;
}

// AFTER: Check if stderr contains success messages
} else if (error) {
  const isSuccessMessage = error.includes('MCP server running') ||
                           error.includes('Started on stdio') ||
                           error.includes('ServiceNow MCP') ||
                           error.includes('Snow-Flow MCP');

  if (isSuccessMessage) {
    console.log(chalk.green('✓'));  // SUCCESS!
    successCount++;
  } else {
    console.log(chalk.red('✗'));    // Actual error
    failCount++;
  }
}
```

**Files changed**:
- `src/cli.ts` lines 2265-2279: Added success message detection

---

## 📦 Files Changed

**Modified:**
- `src/cli.ts`:
  - Lines 2537, 2546, 2558: Changed 'agents' to 'agent' directory
  - Lines 2265-2279: Added MCP verification success message detection
- `package.json`: Version bump to 8.4.10

---

## 🔧 Migration Guide

### For Existing Users - MUST Re-run Init!

```bash
# Install v8.4.10
npm install -g snow-flow@8.4.10

# Re-run init to get correct directory structure
cd your-project
snow-flow init --force

# Verify both fixes work
# 1. Check directory structure:
ls -la .opencode/
# Should show: agent/ (not agents/)

# 2. Check MCP verification:
# During init, you should see:
# Testing servicenow-unified... ✓
# Testing snow-flow... ✓  (no longer ✗!)
```

### For New Users

Just run `snow-flow init` - it will create the correct structure!

---

## 🎯 What This Fixes

### Issue 1: OpenCode Startup Error
**Before v8.4.10**:
```
Error: Directory "agents" in .opencode is not valid. Use "agent" instead.
⚠️  OpenCode CLI not found or failed to start
```

**After v8.4.10**:
```
✅ OpenCode starts successfully
✅ No directory naming errors
```

### Issue 2: MCP Verification False Negative
**Before v8.4.10**:
```
Testing snow-flow... ✗
   Snow-Flow MCP server running on stdio...
⚠️  1 verified, 1 failed
```

**After v8.4.10**:
```
Testing snow-flow... ✓
✅ All 2 MCP server(s) verified successfully
```

---

## 📊 Impact

| Issue | Before v8.4.10 | After v8.4.10 |
|-------|----------------|---------------|
| OpenCode directory error | ❌ Fails with "agents" not valid | ✅ Works with "agent" |
| Snow-Flow MCP verification | ❌ False negative (marked as ✗) | ✅ Correctly detected (✓) |
| Init creates correct structure | ❌ No (.opencode/agents/) | ✅ Yes (.opencode/agent/) |
| MCP servers both verified | ❌ Only 1 of 2 | ✅ Both 2 of 2 |

---

## 🚧 Important Notes

### Why The Directory Name Matters

OpenCode follows a strict naming convention:
- **Singular** for single-instance directories: `agent/`, `mode/`
- **Plural** for collections: no longer used in OpenCode v2+

The `agents` → `agent` change aligns with OpenCode's current architecture.

### Why MCP Servers Log to stderr

Some MCP servers (including snow-flow) log startup messages to stderr instead of stdout. This is valid behavior - stderr is for diagnostic/status messages, not necessarily errors.

The verification now correctly distinguishes between:
- ✅ **Success messages** in stderr: "MCP server running", "Started on stdio"
- ❌ **Actual errors** in stderr: "Cannot find module", "ENOENT"

---

## 🙏 Acknowledgments

Thanks to the community for reporting these issues!

---

**Full Changelog**: https://github.com/groeimetai/snow-flow/compare/v8.4.9...v8.4.10
