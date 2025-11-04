# Dependency Update Guide

## Automatic Updates

Snow-Flow automatically checks and updates `@groeimetai/snow-code` during installation.

### Quick Update

```bash
# Update all dependencies
npm run update-deps

# Or manually:
npm install @groeimetai/snow-code@latest
```

## Troubleshooting: Zod v4 Compatibility Error

### Error Message
```
TypeError: undefined is not an object (evaluating 'schema._zod.def')
at process (../../node_modules/.bun/zod@3.25.76/node_modules/zod/v4/core/to-json-schema.js:15:28)
```

### Root Cause
This error occurs when using an outdated `@groeimetai/snow-code` binary that contains old zod v3 code, while your project uses zod v4.

### Solution

**Option 1: Automatic Update (Recommended)**
```bash
npm run update-deps
```

**Option 2: Clean Reinstall**
```bash
# Remove all dependencies
rm -rf node_modules package-lock.json

# Reinstall everything fresh
npm install

# The postinstall hook will automatically install the correct snow-code version
```

**Option 3: Manual Update**
```bash
# Update @groeimetai/snow-code to latest
npm install @groeimetai/snow-code@^0.18.13

# Apply patches
npx patch-package
```

**Option 4: Force Reinstall Snow-Code**
```bash
# Uninstall old version
npm uninstall @groeimetai/snow-code

# Clear npm cache
npm cache clean --force

# Install latest version
npm install @groeimetai/snow-code@latest
```

### Verification

After updating, verify the installation:

```bash
# Check installed version
npm list @groeimetai/snow-code

# Should show: @groeimetai/snow-code@0.18.13 or higher

# Check zod version
npm list zod

# Should show: zod@4.1.12 (deduplicated across all packages)
```

### What Gets Updated

The update process:

1. ✅ Updates `@groeimetai/snow-code` to latest version (0.18.13+)
2. ✅ Ensures zod v4.1.12 is used everywhere (via npm overrides)
3. ✅ Applies zod v4 compatibility patch
4. ✅ Rebuilds native modules if needed
5. ✅ Cleans npm cache for fresh install

### How It Works

**Automatic Version Check (postinstall)**

Every time you run `npm install`, the postinstall script:
- Checks if `@groeimetai/snow-code` is installed
- Compares installed version with required version
- Automatically updates if outdated
- Shows clear messages about what's happening

**Zod v4 Compatibility**

The project includes:
- `npm overrides` to force zod v4 across all dependencies
- Patch file (`patches/zod+4.1.12.patch`) to fix zod's internal bug
- Automatic patch application via patch-package

### Expected Console Output

**During Install:**
```
🚀 Setting up Snow-Flow...
📦 Updating @groeimetai/snow-code from v0.18.10 to ^0.18.13...
✅ @groeimetai/snow-code updated successfully
✅ Snow-Flow installed locally
```

**During Update:**
```
🔄 Updating Snow-Flow dependencies...
📦 Updating @groeimetai/snow-code to ^0.18.13...
✅ @groeimetai/snow-code updated
🧹 Cleaning npm cache...
✅ Cache cleaned
📦 Reinstalling all dependencies...
✅ Dependencies reinstalled
🩹 Applying patches...
✅ Patches applied
🎉 Update complete!
```

## Still Having Issues?

If you continue to experience the zod error after trying all options:

1. **Check your environment:**
   ```bash
   node --version  # Should be v18+
   npm --version   # Should be v9+
   ```

2. **Verify package.json overrides:**
   ```json
   {
     "overrides": {
       "zod": "4.1.12"
     }
   }
   ```

3. **Check for conflicting dependencies:**
   ```bash
   npm ls zod
   # Should show only zod@4.1.12, all deduped
   ```

4. **Report the issue:**
   - GitHub: https://github.com/groeimetai/snow-flow/issues
   - Include: Node version, npm version, error output, `npm ls` output

## Prevention

To avoid dependency issues in the future:

1. ✅ Always use `npm install` (not `yarn` or `pnpm`)
2. ✅ Keep Node.js updated (v18 or higher)
3. ✅ Run `npm run update-deps` periodically
4. ✅ Don't manually modify `node_modules`
5. ✅ Commit `package-lock.json` to version control

## Technical Details

### Why This Happens

`@groeimetai/snow-code` is a precompiled binary that uses SnowCode (OpenCode fork). The binary includes its own bundled dependencies. When the binary was built with zod v3 but your project uses zod v4, there's a mismatch in the schema validation API.

### The Fix

We've implemented multiple layers of compatibility:

1. **npm overrides** - Forces zod v4 everywhere
2. **Zod v4 patch** - Fixes internal `_zod.def` → `_def` bug
3. **Automatic updates** - Ensures latest snow-code binary
4. **Postinstall checks** - Validates versions on every install

### Version Requirements

| Package | Version | Why |
|---------|---------|-----|
| zod | 4.1.12 | Latest stable, with patch applied |
| @groeimetai/snow-code | ^0.18.13 | Includes updated dependencies |
| snow-flow | 8.30.6+ | Includes zod v4 fix |

## Update Schedule

Snow-Flow automatically checks for updates:
- ✅ Every `npm install`
- ✅ Every `npm run update-deps`
- ⚠️ Manual updates recommended monthly
