# Breaking Changes Analysis - November 13-14, 2025

## Executive Summary

Between the stable versions (snow-code v0.18.51 / snow-flow v8.32.0 @ commit 0e323726) and the problematic versions (snow-code v1.0.37-1.0.38 / snow-flow v8.32.9-8.32.11), **22 commits** were made across both repositories that introduced multiple **breaking changes**.

## Timeline

- **Stable Point**: November 13, 2025 20:42
  - snow-code: v0.18.51 (commit c0452091)
  - snow-flow: v8.32.0 (commit 0e323726)

- **Breaking Changes Period**: November 13, 2025 22:00 - November 14, 2025 10:00
  - Multiple refactoring commits
  - API updates
  - Directory structure changes

---

## Snow-Code Breaking Changes

### 1. ⚠️ **CRITICAL: Web-Tree-Sitter API Breaking Change**

**Commit**: `dc5ffa72` (Nov 13, 22:53)
**Title**: "fix: Update web-tree-sitter Parser.init() API for v0.25+"

**Changes**:
```diff
- await Parser.init({
-   locateFile() {
-     return treeWasm
-   },
- })
+ await Parser.init(treeWasm)
```

**Impact**:
- **TypeScript Errors**: `Property 'init' does not exist on type 'typeof import("web-tree-sitter")'`
- **Runtime Error**: `TypeError: undefined is not an object (evaluating 'Parser3.init')`
- **Severity**: CRITICAL - Breaks bash command parsing completely

**Root Cause**:
- web-tree-sitter v0.25+ changed the API signature for `Parser.init()`
- The new API expects the WASM file directly, not a locateFile callback
- TypeScript types don't match the actual implementation
- This is a **library-level breaking change** from web-tree-sitter upstream

**Why This Failed**:
1. TypeScript couldn't resolve the correct types for the new API
2. The change was made without verifying TypeScript compilation
3. Pre-push hook typecheck was bypassed or ignored

---

### 2. 🔄 **Directory Structure Refactor**

**Commit**: `6c3f736e` (Nov 13, 23:36)
**Title**: "refactor: Rename packages/snowcode to packages/snow-code"

**Changes**:
- Renamed `packages/snowcode/` → `packages/snow-code/`
- Updated 195 files
- Updated all import paths and references

**Impact**:
- **Module Resolution Issues**: Imports pointing to old paths fail
- **Build Path Errors**: Go build output path changed
- **Symlink Breakage**: Existing symlinks pointed to non-existent directories
- **Severity**: HIGH - Breaks local development and CI/CD

**Cascading Effects**:
```
packages/snowcode/  →  packages/snow-code/
     ↓                       ↓
Import paths break    Symlinks break
     ↓                       ↓
TypeScript errors     ENOTEMPTY errors
     ↓                       ↓
Build failures        npm install failures
```

---

### 3. 🔗 **Symlink Issues**

**Commit**: `254537ae` (Nov 14)
**Title**: "fix: Add postinstall script to fix broken symlinks from opencode->snow-code refactor"

**Problem**:
- Directory rename broke existing symlinks
- `ENOTEMPTY` errors during npm install
- Files couldn't be removed because symlinks pointed to non-existent directories

**Attempted Fix**:
- Added postinstall script to recreate symlinks
- **Result**: Partially fixed, but errors persisted in v1.0.37

---

### 4. 📁 **Config Directory Rename**

**Commit**: `27986a32` (Nov 13, 22:53)
**Title**: "refactor: Replace .snowcode directory references with .snow-code"

**Changes**:
- `.snowcode/` → `.snow-code/`
- Updated all config file paths
- Updated documentation

**Impact**:
- **Config File Not Found**: Existing installations look in wrong directory
- **User Migration Required**: Users need to manually rename their config directories
- **Severity**: MEDIUM - Breaks existing user configurations

---

## Snow-Flow Breaking Changes

### 1. 🏷️ **Package Name Refactor**

**Commit**: `fb0a3f10` (Nov 13, 22:29)
**Title**: "refactor: Rename all snowcode/opencode references to snow-code"

**Changes**:
```diff
- "@groeimetai/snow-code": "^0.18.49"
+ "@groeimetai/snow-code": "^0.19.1"
```

**Impact**:
- Pulled in breaking snow-code versions (0.19.x with tree-sitter issues)
- Changed command references from `snowcode` to `snow-code`
- **Severity**: HIGH - Cascaded web-tree-sitter errors into snow-flow

---

### 2. 🔧 **Binary Entry Point Rename**

**Commit**: `dc73048a` (Nov 14)
**Title**: "fix: Update bin entry from snowcode-with-mcp to snow-code-with-mcp"

**Changes**:
```diff
- "snowcode-with-mcp": "bin/snowcode-with-mcp"
+ "snow-code-with-mcp": "bin/snow-code-with-mcp"
```

**Impact**:
- **Command Not Found**: Old scripts using `snowcode-with-mcp` break
- **User Scripts Break**: Any automation using old command names fails
- **Severity**: MEDIUM - Breaks user workflows

---

### 3. 📦 **Template File Rename**

**Commit**: `78232744` (Nov 14)
**Title**: "fix: Update template path from snowcode-package.json to snow-code-package.json"

**Impact**:
- `snow-flow init` command failed to find template files
- **Severity**: MEDIUM - Breaks initialization workflow

---

### 4. 🔄 **Dependency Version Churn**

**Progression**:
```
v8.32.0  → @groeimetai/snow-code@^0.18.49  ✅ STABLE
v8.32.1  → @groeimetai/snow-code@^0.18.49  ✅ STABLE
v8.32.2  → @groeimetai/snow-code@^0.19.0   ❌ BREAKS (tree-sitter)
v8.32.3  → @groeimetai/snow-code@^0.19.1   ❌ BREAKS
v8.32.4  → @groeimetai/snow-code@^0.19.2   ❌ BREAKS
v8.32.5  → @groeimetai/snow-code@0.19.3    ❌ BREAKS
v8.32.6  → @groeimetai/snow-code@0.19.3    ❌ BREAKS
v8.32.7  → @groeimetai/snow-code@0.19.4    ❌ BREAKS
v8.32.8  → @groeimetai/snow-code@0.19.4    ❌ BREAKS
v8.32.9  → @groeimetai/snow-code@1.0.37    ❌ BREAKS
```

**Impact**:
- Each version attempted to fix the previous issues
- All versions 0.19.0+ inherited the web-tree-sitter breaking change
- **Severity**: CRITICAL - Created unstable release chain

---

## Root Cause Analysis

### 1. **Upstream Library Breaking Change**
- `web-tree-sitter` v0.25+ changed API without proper migration path
- TypeScript types incompatible with runtime behavior
- No fallback mechanism implemented

### 2. **Massive Refactoring Without Testing**
- 195 files renamed in single commit
- No gradual migration path
- No backward compatibility maintained

### 3. **Pre-Push Hook Bypassed**
- TypeScript errors existed but were ignored
- `--no-verify` flag used to bypass checks
- Code pushed despite failing typecheck

### 4. **Cascading Dependencies**
- snow-flow depends on snow-code
- Breaking change in snow-code cascaded to snow-flow
- Multiple fix attempts compounded the problem

### 5. **Version Bumping Strategy**
- Jumped from 0.18.x → 0.19.x → 1.0.x rapidly
- Semantic versioning not respected
- Major version bump (1.0.0) didn't indicate breaking changes properly

---

## Specific Error Messages

### 1. TypeScript Compilation Errors
```
src/tool/bash.ts(28,16): error TS2339: Property 'init' does not exist on type 'typeof import("web-tree-sitter")'.
src/tool/bash.ts(33,17): error TS2351: This expression is not constructable.
  Type 'typeof import("web-tree-sitter")' has no construct signatures.
```

### 2. Runtime Errors
```
TypeError: undefined is not an object (evaluating 'Parser3.init')
```

### 3. npm Install Errors
```
npm error code ENOTEMPTY
npm error syscall rename
npm error path /Users/.../node_modules/@groeimetai/snow-code-darwin-arm64
npm error dest /Users/.../node_modules/.@groeimetai/snow-code-darwin-arm64
```

### 4. Auth.ts Variable Errors
```
src/cli/cmd/auth.ts(1800,31): error TS2454: Variable 'enterpriseUsername' is used before being assigned.
src/cli/cmd/auth.ts(2026,25): error TS2454: Variable 'enterpriseUsername' is used before being assigned.
src/cli/cmd/auth.ts(2028,54): error TS2454: Variable 'enterpriseRole' is used before being assigned.
```

---

## Recommendations for Future Development

### 1. **Implement Staged Refactoring**
```
Phase 1: Deprecate old names (v0.18.52)
  - Add warnings for .snowcode directory usage
  - Support both .snowcode and .snow-code

Phase 2: Dual support (v0.19.0)
  - Accept both directory names
  - Auto-migrate configs
  - Update docs

Phase 3: Remove old names (v1.0.0)
  - Only support .snow-code
  - Major version bump indicates breaking change
```

### 2. **Fix Web-Tree-Sitter Properly**
```typescript
// Implement fallback mechanism
async function initParser() {
  try {
    // Try new API (v0.25+)
    await Parser.init(treeWasm);
  } catch (error) {
    // Fallback to old API
    await Parser.init({
      locateFile() {
        return treeWasm;
      }
    });
  }
}
```

### 3. **Enforce Pre-Push Hooks**
- Never use `--no-verify` unless absolutely necessary
- Fix TypeScript errors BEFORE pushing
- Add pre-commit hooks for linting and typecheck

### 4. **Gradual Dependency Updates**
- Test snow-code changes in isolation FIRST
- Only update snow-flow dependency after snow-code is stable
- Maintain compatibility layer during transitions

### 5. **Version Strategy**
- Use semantic versioning correctly:
  - `0.18.x` → `0.18.y` = patch (bug fixes)
  - `0.18.x` → `0.19.0` = minor (new features, backward compatible)
  - `0.x.x` → `1.0.0` = major (breaking changes)

### 6. **Testing Strategy**
```bash
# Before any release:
1. npm run typecheck      # Must pass
2. npm run build          # Must succeed
3. npm install --dry-run  # Check for ENOTEMPTY
4. Test in clean environment
5. Test upgrade path from previous version
```

### 7. **Rollback Plan**
- Always tag stable versions before major changes
- Document rollback procedure
- Test rollback before releasing breaking changes

---

## Current Stable Versions (Restored)

✅ **snow-code v1.0.39**
- Based on v0.18.51 codebase
- Old web-tree-sitter API (working)
- Old directory structure (packages/snowcode)
- Published to npm as @latest

✅ **snow-flow v8.32.12**
- Based on commit 0e323726 (Nov 13, 20:42)
- Depends on snow-code v1.0.39 (exact version)
- No breaking changes
- Published to GitHub as latest

---

## Lessons Learned

1. **Test Before Merge**: Always run full test suite
2. **Gradual Migration**: Never rename 195 files in one commit
3. **Backward Compatibility**: Support old and new simultaneously
4. **Version Control**: Respect semantic versioning
5. **Dependency Management**: Test downstream effects
6. **Error Handling**: Add fallbacks for library API changes
7. **Documentation**: Document breaking changes clearly
8. **Rollback Ready**: Always have a known-good version tagged

---

## Action Items

- [x] Revert to stable versions (v1.0.39 / v8.32.12)
- [ ] Implement proper web-tree-sitter fallback mechanism
- [ ] Create migration guide for .snowcode → .snow-code
- [ ] Add pre-commit hooks for typecheck
- [ ] Document semantic versioning strategy
- [ ] Create testing checklist for releases
- [ ] Implement gradual refactoring plan
- [ ] Add rollback documentation

---

**Generated**: November 14, 2025
**Authors**: Analysis of commits by @nielsvanderwerf
**Status**: Stable versions restored, breaking changes documented
