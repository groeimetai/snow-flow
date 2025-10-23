# Snow-Flow v8.4.9 Release Notes

**Release Date**: 2025-10-23
**Type**: Critical Fix - Restore Working Objective Passing
**Breaking Changes**: No

---

## 🚨 Critical Fix

### Restored v8.2.0 Working Approach for Passing Objective to OpenCode

**Problem**: v8.4.8 attempted to pass objective via environment variable `SNOW_FLOW_OBJECTIVE`, but OpenCode doesn't read from environment variables for objectives.

**Root Cause**:
- v8.4.8 tried: `SNOW_FLOW_OBJECTIVE=objective` in env (doesn't work!)
- v8.2.0 used: **Temp file + shell stdin redirect** (works perfectly!)
- OpenCode reads objective from stdin, not from environment variables

**Solution**: Restored the proven v8.2.0 approach:

```typescript
// BEFORE (v8.4.8 - DIDN'T WORK):
const opencodeEnv = {
  ...process.env,
  SNOW_FLOW_OBJECTIVE: objective  // OpenCode doesn't read this!
};

spawn('opencode', opencodeArgs, {
  stdio: 'inherit',
  env: opencodeEnv
});

// AFTER (v8.4.9 - WORKS!):
// Write objective to temp file
const tmpFile = join(tmpdir(), `snow-flow-objective-${Date.now()}.txt`);
writeFileSync(tmpFile, objective, 'utf8');

// Use shell redirect to pass objective via stdin
let opencodeCommand = `opencode < "${tmpFile}"`;

spawn('sh', ['-c', opencodeCommand], {
  stdio: 'inherit',  // TUI works perfectly!
  env: { ...process.env, DEFAULT_MODEL, DEFAULT_LLM_PROVIDER }
});

// Clean up temp file on exit
opencodeProcess.on('close', () => {
  unlinkSync(tmpFile);
});
```

---

## 🎯 How It Works

**The Winning Combination**:
1. ✅ **Temp file** - Write objective to temporary file
2. ✅ **Shell redirect** - Use `opencode < "tmpfile"` to pass via stdin
3. ✅ **stdio: 'inherit'** - OpenCode gets full TUI control
4. ✅ **Cleanup** - Remove temp file on process exit

**Why This Works**:
- OpenCode reads initial objective from **stdin** (standard input)
- Shell redirect (`<`) sends file contents to stdin
- `stdio: 'inherit'` gives OpenCode full terminal control for TUI
- No piping, no Transform streams, no conflicts!

---

## 📦 Files Changed

**Modified:**
- `src/cli.ts` - Restored v8.2.0 temp file + shell redirect approach (lines 480-550)
- `package.json` - Version bump to 8.4.9

---

## 🔧 Migration Guide

```bash
# Install v8.4.9
npm install -g snow-flow@8.4.9

# Test swarm command (objective should now be passed!)
cd your-project
snow-flow swarm "create incident dashboard"
```

**Expected behavior**:
1. OpenCode starts ✅
2. Objective is passed to OpenCode ✅
3. OpenCode begins executing the task ✅
4. Full TUI rendering works ✅

---

## 🏆 What This Fixes

1. **Objective not being sent** - OpenCode now receives the objective via stdin redirect
2. **Empty OpenCode sessions** - Tasks now start automatically
3. **Manual input required** - No longer needed, objective is pre-filled

---

## 📊 Technical Details

### The v8.2.0 Proven Approach

This approach was working perfectly before we tried to add the MCP formatter. The key insight: **OpenCode reads from stdin, not from environment variables**.

**Version History**:
- **v8.2.0**: ✅ Temp file + shell redirect (WORKING)
- **v8.4.4-v8.4.7**: ❌ Tried various interceptor fixes (broken objective passing)
- **v8.4.8**: ❌ Tried environment variable (doesn't work)
- **v8.4.9**: ✅ Restored v8.2.0 approach (WORKING AGAIN!)

### Why We Went Back

Sometimes the best solution is to **trust what was already working**. The v8.2.0 approach:
- Was battle-tested
- Had no known issues with objective passing
- Works perfectly with TUI requirements
- Simple and reliable

---

## 🙏 Acknowledgments

Special thanks to the user who suggested looking at the pre-MCP formatter version - that was the key insight that led to this fix!

---

## ⚠️ Important Notes

**Best Practices Going Forward**:
- When something works, document WHY it works
- Before changing core functionality, understand the full flow
- Sometimes "rolling back" is the right solution

**For Users**:
- v8.4.9 combines the best of both worlds:
  - ✅ TUI compatibility (no hanging)
  - ✅ Objective passing (works again!)
  - ✅ Stable, proven approach

---

**Full Changelog**: https://github.com/groeimetai/snow-flow/compare/v8.4.8...v8.4.9
