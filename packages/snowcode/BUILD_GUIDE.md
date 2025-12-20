# Snow-Code Platform Binary Build Guide

## Overview

Snow-Code uses **platform-specific standalone binaries** compiled by Bun. This eliminates runtime dependencies (Node.js, Bun, tsx) and resolves dependency issues that occurred with the tsx approach.

## Architecture

### Platform Binary System

Each platform gets a separate npm package containing a standalone ~70MB executable:

- `@groeimetai/snow-flow-darwin-arm64` - macOS Apple Silicon
- `@groeimetai/snow-flow-darwin-x64` - macOS Intel
- `@groeimetai/snow-flow-linux-arm64` - Linux ARM64
- `@groeimetai/snow-flow-linux-x64` - Linux x64
- `@groeimetai/snow-flow-windows-x64` - Windows x64

The main `@groeimetai/snow-flow-snowcode` package includes these as `optionalDependencies`, so npm automatically installs the correct one for the user's platform.

### How It Works

1. **User installs**: `npm install -g @groeimetai/snow-flow-snowcode`
2. **npm resolves**: Automatically installs correct platform binary (e.g., `@groeimetai/snow-flow-darwin-arm64`)
3. **Wrapper script**: `bin/snowcode` detects platform and executes the correct binary
4. **Standalone execution**: Binary runs without requiring Node.js, Bun, or any other runtime

## Building Platform Binaries

### Prerequisites

- **Bun** (for compilation): `curl -fsSL https://bun.sh/install | bash`
- **Platform-specific machine**: Cross-compilation doesn't work reliably with native modules

### Build Process

#### 1. Prepare tree-sitter Native Module

tree-sitter requires a native `.node` binary. Before building, ensure it's in the correct location:

```bash
cd packages/snowcode
bun install  # Builds tree-sitter native module

# Create prebuilds directory for Bun compilation
cd node_modules/.bun/tree-sitter@0.25.0/node_modules/tree-sitter
mkdir -p prebuilds/darwin-arm64  # Or linux-x64, etc.
cp build/Release/tree_sitter_runtime_binding.node prebuilds/darwin-arm64/tree-sitter.node
```

**Note**: This step must be repeated for each target platform on the appropriate OS.

#### 2. Run Build Script

```bash
cd packages/snowcode
bun run build
```

This creates `dist/@groeimetai/snow-flow-{platform}-{arch}/` with:
- `bin/snowcode` (or `snowcode.exe` for Windows) - Standalone executable (~70MB)
- `package.json` - Package metadata for npm

#### 3. Test Binary

```bash
./dist/@groeimetai/snow-flow-darwin-arm64/bin/snowcode --version
# Should output: 0.15.28
```

### Building All Platforms

**Current limitation**: Can only build for the current platform due to tree-sitter native dependencies.

**Solution**: Use CI/CD (GitHub Actions) with matrix builds:

```yaml
strategy:
  matrix:
    os: [macos-latest, ubuntu-latest, windows-latest]
    arch: [x64, arm64]
```

Each runner builds for its native platform, then all binaries are collected and published.

## Publishing

### 1. Publish Platform Binaries

Each platform binary is a separate package:

```bash
cd dist/@groeimetai/snow-flow-darwin-arm64
npm publish --access public
```

Repeat for all platforms:
- `@groeimetai/snow-flow-darwin-arm64`
- `@groeimetai/snow-flow-darwin-x64`
- `@groeimetai/snow-flow-linux-arm64`
- `@groeimetai/snow-flow-linux-x64`
- `@groeimetai/snow-flow-linux-x64-baseline`
- `@groeimetai/snow-flow-windows-x64`

### 2. Publish Main Package

After all platform binaries are published:

```bash
cd packages/snowcode
npm publish --access public
```

The main package's `optionalDependencies` will automatically pull in the correct platform binary.

## Version Management

**CRITICAL**: All platform packages and the main package **MUST** have the same version number!

When bumping version:
1. Update `packages/snowcode/package.json` version
2. Update `optionalDependencies` versions to match
3. Rebuild all platform binaries (they read version from package.json)
4. Publish all packages with the same version

## Troubleshooting

### "Cannot find package 'bun'" Error

**Problem**: tsx approach was trying to run TypeScript directly, requiring runtime dependencies.
**Solution**: Platform binaries are standalone executables - this error should never occur with v0.15.28+.

### tree-sitter Build Errors

**Problem**: `Could not resolve: "./prebuilds/{platform}-{arch}/tree-sitter.node"`
**Solution**: Create prebuilds directory and copy the built `.node` file (see "Prepare tree-sitter Native Module" above).

### Binary Doesn't Execute

**Problem**: Permission denied or not found errors.
**Solution**:
```bash
chmod +x dist/@groeimetai/snow-flow-*/bin/snowcode
```

### Wrong Platform Binary Installed

**Problem**: npm installed binary for wrong platform.
**Solution**: Check `os` and `cpu` fields in platform package.json match npm's platform detection.

## Key Branding & Architecture

### Branding

All references updated to use `snow-code` branding:
- Package names: `@groeimetai/snow-flow-*`
- Binary names: `snow-code` (with `snowcode` alias for compatibility)
- Install directories: `.snowcode`
- Constants: `SNOWCODE_VERSION`, `SNOWCODE_*` environment variables
- User agent: `snowcode/`

### Dependency Fixes

- **Removed**: `import { $ } from "bun"` in `src/installation/index.ts`
- **Added**: Node.js `execSync` for shell commands (runtime compatible)
- **Fixed**: Workspace dependencies to use `@groeimetai/snow-flow-*` namespace

## Development Workflow

### Local Development

```bash
cd packages/snowcode
bun run dev  # Runs source directly with Bun
```

### Production Build

```bash
bun run build  # Creates standalone binaries
```

### Testing Changes

```bash
bun run build
./dist/@groeimetai/snow-flow-darwin-arm64/bin/snowcode auth login
# Test your changes...
```

## Future Improvements

1. **GitHub Actions CI/CD**: Automate building all platforms
2. **Automated Testing**: Test binaries on all platforms before publish
3. **Code Signing**: Sign macOS/Windows binaries for security
4. **Auto-updates**: Implement self-update mechanism
5. **Baseline Builds**: Add x64-baseline builds for older CPUs

## References

- [Bun Build Documentation](https://bun.sh/docs/bundler/executables)
- [npm optionalDependencies](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#optionaldependencies)
- [Platform Binary Pattern](https://nodejs.org/api/process.html#processplatform)
