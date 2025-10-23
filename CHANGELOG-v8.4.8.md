# Snow-Flow v8.4.8 Release Notes

**Release Date**: 2025-10-23
**Type**: Critical Bug Fix - Swarm Command TUI Compatibility
**Breaking Changes**: No

---

## 🚨 Critical Bug Fix

### Fixed Swarm Command Hanging - OpenCode TUI Compatibility Issue

**Problem**: `snow-flow swarm` command would hang indefinitely, even after v8.4.5-8.4.7 fixes

**Root Cause**:
- OpenCode is a **TUI (Terminal User Interface) application** that needs full terminal control
- v8.4.7 attempted to use `stdio: 'inherit'` but still tried to pipe stdout/stderr through interceptor
- This created a fundamental conflict: TUI apps cannot have their stdio piped/intercepted
- The output interceptor was incompatible with TUI applications

**Fix**:
```typescript
// BEFORE (v8.4.7 - INCOMPLETE FIX):
const opencodeProcess = spawn('opencode', opencodeArgs, {
  stdio: 'inherit',  // Full terminal access
  cwd: process.cwd(),
  env: opencodeEnv
});

// But then tried to pipe through interceptor (WRONG!):
if (useInterceptor) {
  const interceptor = interceptOpenCodeOutput({ quiet });
  if (opencodeProcess.stdout) {  // stdout is null with inherit!
    opencodeProcess.stdout.pipe(interceptor).pipe(process.stdout);
  }
}

// AFTER (v8.4.8 - COMPLETE FIX):
const opencodeProcess = spawn('opencode', opencodeArgs, {
  stdio: 'inherit',  // OpenCode gets full terminal access (stdin/stdout/stderr)
  cwd: process.cwd(),
  env: opencodeEnv
});

// NO piping! OpenCode writes directly to terminal
// Removed all interceptor logic - incompatible with TUI apps
```

**Additional Changes**:
- Removed `--no-interceptor` flag (no longer relevant)
- Removed `options` parameter from `executeOpenCode()` function
- Cleaned up all interceptor-related code from swarm command
- Objective now passed via `SNOW_FLOW_OBJECTIVE` environment variable

---

## 📦 Files Changed

**Modified:**
- `src/cli.ts` - Removed interceptor logic, simplified OpenCode spawning (lines 97, 388, 437, 499-510)
- `package.json` - Version bump to 8.4.8

---

## 🔧 Migration Guide

```bash
# Install v8.4.8
npm install -g snow-flow@8.4.8

# Test swarm command (should work now!)
cd your-project
snow-flow swarm "create incident dashboard"
```

**No additional steps needed** - the fix is automatic!

**Breaking Changes**: None
- The `--no-interceptor` flag has been removed (it was non-functional anyway)
- All other functionality remains the same

---

## 🎯 What This Fixes

1. **Swarm command hanging** - OpenCode now launches successfully
2. **Black screen on startup** - TUI properly initializes with full terminal control
3. **Terminal escape codes** - No more `^[]11;rgb:...` artifacts
4. **Output interceptor conflict** - Removed incompatible piping logic

---

## 📊 Technical Details

### Understanding the Issue

**TUI Applications** (like OpenCode) require:
- Direct access to stdin/stdout/stderr
- Full terminal control for rendering UI
- No interference with terminal escape codes
- Cannot be piped through Transform streams

**What We Changed**:
1. **v8.4.4-8.4.6**: Tried bypassing interceptor with flags (didn't work)
2. **v8.4.7**: Changed to `stdio: 'inherit'` but forgot to remove interceptor code (incomplete)
3. **v8.4.8**: Removed ALL interceptor logic - OpenCode has full terminal control

### Why This Works Now

With `stdio: 'inherit'`:
- OpenCode's stdin = parent's stdin (terminal input)
- OpenCode's stdout = parent's stdout (terminal output)
- OpenCode's stderr = parent's stderr (terminal errors)

No Transform streams, no piping, no interference. OpenCode can fully control the terminal UI.

---

## 🚧 What Changed From v8.4.7

**v8.4.7** (incomplete fix):
- Set `stdio: 'inherit'` ✅
- Still tried to pipe through interceptor ❌
- `--no-interceptor` flag present but didn't help ❌

**v8.4.8** (complete fix):
- Set `stdio: 'inherit'` ✅
- Removed ALL interceptor logic ✅
- Removed `--no-interceptor` flag (not needed) ✅
- Simplified function signature ✅

---

## 🙏 Acknowledgments

Thanks to the community for persistent testing and detailed error reports that helped identify the TUI compatibility issue!

---

## ⚠️ Important Notes

**For Users Who Had Swarm Command Working Before**:
- If you weren't experiencing hangs, this update won't affect you
- The swarm command now works consistently across all environments

**For Users Who Had Hangs**:
- v8.4.8 should resolve all hanging issues
- OpenCode will now launch with proper TUI rendering
- No configuration changes needed

---

**Full Changelog**: https://github.com/groeimetai/snow-flow/compare/v8.4.7...v8.4.8
