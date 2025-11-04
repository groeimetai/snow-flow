# Quick Fix: Zod v4 Compatibility Error

## 🚨 Getting this error?

```
TypeError: undefined is not an object (evaluating 'schema._zod.def')
```

## ✅ Quick Fix (30 seconds)

```bash
npm run update-deps
```

That's it! The script will:
- ✅ Update @groeimetai/snow-code to latest
- ✅ Clean npm cache
- ✅ Reinstall dependencies
- ✅ Apply zod v4 patches
- ✅ Rebuild everything

## 🔄 Alternative: Fresh Install

If the quick fix doesn't work:

```bash
# Delete everything
rm -rf node_modules package-lock.json

# Fresh install (postinstall will auto-update dependencies)
npm install
```

## ✨ What's New (v8.30.9+)

**Automatic Dependency Management:**
- Every `npm install` now checks @groeimetai/snow-code version
- Auto-updates if outdated
- No more manual dependency management!

**New Command:**
```bash
npm run update-deps  # Update everything with one command
```

**Smart Version Checking:**
- Compares semantic versions
- Only updates when needed
- Shows clear progress messages

## 📖 Full Documentation

See [DEPENDENCY_UPDATE.md](./DEPENDENCY_UPDATE.md) for:
- Detailed troubleshooting
- Technical details
- Prevention tips
- Manual update options

## 🆘 Still Having Issues?

1. Check your Node version: `node --version` (need v18+)
2. Check npm version: `npm --version` (need v9+)
3. Report issue: https://github.com/groeimetai/snow-flow/issues

Include:
- Node version
- npm version
- Output of `npm ls zod`
- Output of `npm ls @groeimetai/snow-code`
