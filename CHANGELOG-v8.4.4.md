# Snow-Flow v8.4.4 Release Notes

**Release Date**: 2025-10-23
**Type**: Bug Fix
**Breaking Changes**: No

---

## 🐛 Bug Fixes

### Fixed Swarm Command Hanging Issue

**Problem**: `snow-flow swarm "objective"` command would hang and not start OpenCode session.

**Root Cause**: The output interceptor Transform stream (introduced in v8.4.0) was blocking stdout/stderr pipes in some environments, preventing OpenCode from starting properly.

**Solution**: Added `--no-interceptor` flag to bypass the output interceptor when needed.

**New Behavior**:

```bash
# Default behavior (with pretty MCP formatting):
snow-flow swarm "create incident dashboard"

# Bypass interceptor if hanging (direct output):
snow-flow swarm "create incident dashboard" --no-interceptor
```

---

## 🔧 Technical Details

### What Changed

**Modified Files:**
- `src/cli.ts` - Added conditional interceptor logic

**Changes:**

1. **Updated `executeOpenCode()` function signature**:
   ```typescript
   // Before:
   async function executeOpenCode(objective: string): Promise<boolean>

   // After:
   async function executeOpenCode(objective: string, options?: any): Promise<boolean>
   ```

2. **Added conditional interceptor usage** (lines 511-537):
   ```typescript
   // Conditionally use output interceptor based on --no-interceptor flag
   const useInterceptor = options?.interceptor !== false;
   const quiet = process.env.QUIET === 'true';

   if (useInterceptor) {
     // Create output interceptor for beautiful MCP formatting
     const interceptor = interceptOpenCodeOutput({ quiet });

     // Pipe OpenCode stdout through interceptor to user's stdout
     if (opencodeProcess.stdout) {
       opencodeProcess.stdout.pipe(interceptor).pipe(process.stdout);
     }

     // Pipe OpenCode stderr through interceptor to user's stderr
     if (opencodeProcess.stderr) {
       opencodeProcess.stderr.pipe(interceptor).pipe(process.stderr);
     }
   } else {
     // Direct pipe without interceptor (bypass mode)
     if (opencodeProcess.stdout) {
       opencodeProcess.stdout.pipe(process.stdout);
     }

     if (opencodeProcess.stderr) {
       opencodeProcess.stderr.pipe(process.stderr);
     }
   }
   ```

3. **Pass options from swarm command** (line 389):
   ```typescript
   // Before:
   const success = await executeOpenCode(objective);

   // After:
   const success = await executeOpenCode(objective, options);
   ```

### How It Works

**Commander.js behavior:**
- `--no-interceptor` flag automatically sets `options.interceptor = false`
- Without flag: `options.interceptor = undefined` (truthy, interceptor enabled)
- With flag: `options.interceptor = false` (falsy, interceptor bypassed)

**Conditional logic:**
```typescript
const useInterceptor = options?.interceptor !== false;
// undefined !== false → true (use interceptor)
// false !== false → false (bypass interceptor)
```

---

## 📋 Usage Examples

### Default (With Interceptor)
```bash
# Beautiful MCP formatting enabled (default):
snow-flow swarm "create workspace for IT support agents"

# Output includes:
# 🔧 snow_create_complete_workspace
# ✅ SUCCESS
# 📦 Result: {...}
```

### Bypass Mode (No Interceptor)
```bash
# Raw OpenCode output (no formatting):
snow-flow swarm "create workspace for IT support agents" --no-interceptor

# Output is direct from OpenCode (may help with debugging)
```

---

## 🔍 When to Use `--no-interceptor`

**Use the flag if:**
- Swarm command hangs and doesn't start
- You need to debug OpenCode output directly
- Output interceptor causes issues in your environment
- You prefer raw OpenCode output

**Keep default (without flag) if:**
- Everything works normally
- You want beautiful MCP tool formatting
- You like the colorized, structured output

---

## 🎯 Testing the Fix

```bash
# Install v8.4.4
npm install -g snow-flow@8.4.4

# Test default behavior
snow-flow swarm "list all incidents"
# Should work with pretty formatting

# Test bypass mode
snow-flow swarm "list all incidents" --no-interceptor
# Should work with raw output
```

---

## 📊 Impact

**Issue**: Swarm command hanging prevented users from using multi-agent orchestration
**Fix**: Added escape hatch to bypass interceptor when it causes issues
**Benefit**: Users can now choose between pretty formatting (default) or raw output (bypass)

---

## 🚀 Future Improvements

**Planned for v8.5.0+:**
- Auto-detect when interceptor should be bypassed
- Add flush intervals to prevent Transform stream blocking
- Improve error handling in interceptor
- Add configurable timeout for interceptor

---

## 🙏 Acknowledgments

Thanks to the community for reporting the swarm hanging issue!

---

**Full Changelog**: https://github.com/groeimetai/snow-flow/compare/v8.4.3...v8.4.4
