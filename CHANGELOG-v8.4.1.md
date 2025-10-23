# Snow-Flow v8.4.1 Release Notes

**Release Date**: 2025-10-23
**Type**: Hotfix
**Breaking Changes**: No

---

## 🐛 Critical Hotfix

### ESM/CommonJS Compatibility Issue (CRITICAL FIX)

**Issue**: v8.4.0 published with broken `ora` package dependency causing immediate CLI failure:

```
Error [ERR_REQUIRE_ESM]: require() of ES Module .../node_modules/ora/index.js from .../dist/utils/mcp-output-formatter.js not supported.
```

**Root Cause**:
- `ora` v9.0.0 is ESM-only
- Snow-Flow uses CommonJS (`type: "commonjs"` in package.json)
- TypeScript compiles ES6 imports to CommonJS `require()` calls
- CommonJS cannot `require()` ESM-only packages

**Fix**:
- Downgraded `ora` from v9.0.0 to v5.4.1 (last version with CommonJS support)
- All functionality preserved
- CLI now works correctly

**Impact**: Resolves complete CLI failure in v8.4.0

---

## 📦 Changes

**Modified:**
- `package.json` - Downgraded `ora` dependency from 9.0.0 to ^5.4.1

**No functional changes** - All v8.4.0 features work identically:
- Beautiful MCP output interceptor
- OpenCode output formatting
- All other v8.4.0 improvements

---

## 🚀 Migration from v8.4.0

**If you installed v8.4.0 and encountered the error:**

```bash
# Update to v8.4.1
npm uninstall -g snow-flow
npm install -g snow-flow

# Verify it works
snow-flow --version  # Should show 8.4.1
snow-flow init       # Should work without errors
```

**If you haven't updated yet:**
- Skip v8.4.0 entirely
- Install v8.4.1 directly

---

## ✅ Verification

Test the fix:

```bash
# Install globally
npm install -g snow-flow@8.4.1

# Run init (should work without errors)
snow-flow init

# Verify MCP servers are configured
cat .opencode/opencode.json

# Test swarm command
snow-flow swarm "create test workspace" --model claude-sonnet-4
```

---

## 📚 Full v8.4.0 Features

All features from v8.4.0 remain intact:

1. **Beautiful MCP Output Interceptor** - Clean, structured MCP tool execution display
2. **Queen Architecture Removal** - ~4,000 lines of legacy code removed
3. **Absolute MCP Paths** - Fixed MCP server discovery in OpenCode
4. **Session Memory System** - Renamed and improved from QueenMemorySystem

See [CHANGELOG-v8.4.0.md](./CHANGELOG-v8.4.0.md) for complete v8.4.0 release notes.

---

## 🙏 Acknowledgments

Thanks to early adopters who quickly reported the v8.4.0 issue, enabling this immediate hotfix!

---

**Full Changelog**: https://github.com/groeimetai/snow-flow/compare/v8.4.0...v8.4.1
