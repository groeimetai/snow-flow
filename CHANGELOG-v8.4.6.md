# Snow-Flow v8.4.6 Release Notes

**Release Date**: 2025-10-23
**Type**: Critical Bug Fix
**Breaking Changes**: No

---

## 🚨 Critical Bug Fix

### Fixed Swarm Command Hanging - Wrong OpenCode Config Path

**Problem**: `snow-flow swarm` command would hang indefinitely

**Root Cause**:
- `executeOpenCode()` checked for `opencode-config.example.json` (wrong!)
- `snow-flow init` creates `.opencode/opencode.json` (correct!)
- Config file mismatch caused OpenCode to not start properly

**Fix**:
```typescript
// Before (WRONG):
const opencodeConfigPath = join(process.cwd(), 'opencode-config.example.json');

// After (CORRECT):
const opencodeConfigPath = join(process.cwd(), '.opencode', 'opencode.json');
```

---

## 📦 Files Changed

**Modified:**
- `src/cli.ts` - Fixed OpenCode config path check (line 451)

---

## 🔧 Migration Guide

```bash
# Install v8.4.6
npm install -g snow-flow@8.4.6

# Test swarm command (should work now!)
cd your-project
snow-flow swarm "create incident dashboard"
```

**No additional steps needed** - the fix is automatic!

---

**Full Changelog**: https://github.com/groeimetai/snow-flow/compare/v8.4.5...v8.4.6
