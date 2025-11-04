# Zod v4 Compatibility Fix

## Problem
Snow-Flow was experiencing a runtime error when using the `snow-flow swarm` command:
```
TypeError: undefined is not an object (evaluating 'schema._zod.def')
at process (node_modules/.../zod/v4/core/to-json-schema.js:15:28)
```

## Root Cause
The issue was caused by a version conflict between:
- **snow-flow** using `zod@4.1.12`
- **@groeimetai/snow-code** requiring `zod@3.25.76`

Additionally, there's a bug in zod v4.1.12's `to-json-schema.js` file that references the old v3 API (`schema._zod.def` instead of `schema._def`).

## Solution
1. **Forced zod v4** across all dependencies using npm `overrides`
2. **Created a patch** for zod v4.1.12 to fix the `_zod.def` → `_def` bug
3. **Updated postinstall** script to automatically apply the patch

## Changes Made

### 1. package.json updates:
```json
{
  "dependencies": {
    "zod": "4.1.12"  // Kept v4
  },
  "peerDependencies": {
    "@groeimetai/snow-code": "^0.18.13"  // Updated to latest
  },
  "overrides": {
    "zod": "4.1.12"  // Force v4 everywhere
  },
  "devDependencies": {
    "patch-package": "^8.0.1"  // Added for patching
  },
  "scripts": {
    "postinstall": "patch-package && node scripts/postinstall.js || true"
  }
}
```

### 2. Created patch file:
- `patches/zod+4.1.12.patch` - Fixes `schema._zod.def` → `schema._def`

## Verification
Run this to verify the fix works:
```bash
node -e "const {toJSONSchema} = require('zod/v4/core'); const z = require('zod'); console.log('✅ Works:', !!toJSONSchema(z.string()));"
```

## Future Installs
The patch will be automatically applied on `npm install` thanks to the postinstall hook.

## Note
This is a temporary workaround until:
1. Zod maintainers fix the v4.1.12 bug, OR
2. @groeimetai/snow-code updates to properly support zod v4
