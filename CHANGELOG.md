# Changelog

All notable changes to Snow-Flow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [8.31.41] - 2025-11-13

### Fixed
- **🔧 Snow-Code Binary Auth Path**: Updated to `@groeimetai/snow-code@0.18.49` which fixes auth.json directory creation
  - snow-code binary now correctly uses `snow-code` directory (with dash) instead of `snowcode` (without dash)
  - Fixes root cause of authentication path issues at the source
  - Ensures auth.json is created at correct location (`~/.local/share/snow-code/auth.json`) from the start
  - Combined with v8.31.40's auto-fix, provides double protection against auth path issues
  - This is the **FINAL FIX** - auth.json will now ALWAYS be created and found at the correct location

### Changed
- **Dependency Update**: Upgraded `@groeimetai/snow-code` from v0.18.48 to v0.18.49
  - Contains critical fix for XDG directory naming (app name must be "snow-code" with dash)
  - Published to npm: https://www.npmjs.com/package/@groeimetai/snow-code

## [8.31.40] - 2025-11-13

### Added
- **🆕 Automatic Auth Location Fix**: `snow-flow auth login` now automatically corrects auth.json location
  - Detects if snow-code binary creates auth.json at wrong location (`snowcode/` without dash)
  - Automatically moves it to correct location (`snow-code/` with dash)
  - Creates symlink at old location for backwards compatibility
  - Shows clear confirmation message when fix is applied
  - Zero manual intervention required - fully automatic!

### Fixed
- **Auth Path Post-Processing**: Ensures auth.json is always at correct location after snow-code auth login
  - Fixes issue where snow-code binary may create auth.json without dash
  - Prevents "Authentication failed: No username/password available" errors
  - Makes authentication fully automatic and foolproof

### Changed
- **Enhanced Auth Flow**: `snow-flow auth login` now includes 3-step post-processing:
  1. Run snow-code auth login (OAuth flow)
  2. 🆕 Auto-correct auth.json location if needed
  3. Update project .mcp.json with credentials

## [8.31.39] - 2025-11-13

### Fixed
- **Auth Path Resolution**: Fixed MCP server to correctly find auth.json at `~/.local/share/snow-code/auth.json` (with dash, not snowcode without dash)
  - Now checks multiple locations in priority order for maximum compatibility
  - Enforces correct `snow-code` directory naming (must always be with dash)
  - Added detailed logging of which auth.json location was loaded
  - Moved misplaced auth.json from `snowcode/` to `snow-code/` directory
  - Fixed authentication errors where MCP tools returned "Authentication failed: No username/password available"

### Changed
- **Auth Location Priority**:
  1. `~/.local/share/snow-code/auth.json` (OFFICIAL - with dash, must always be used)
  2. `~/.snow-flow/auth.json` (snow-flow specific fallback)
  3. `~/.local/share/opencode/auth.json` (compatibility fallback)

## [8.31.38] - 2025-11-13

### Fixed
- **Auth Path Resolution**: Fixed MCP server to correctly find auth.json at `~/.local/share/snow-code/auth.json` (with dash, not snowcode without dash)
  - Now checks multiple locations in priority order for maximum compatibility
  - Enforces correct `snow-code` directory naming (must always be with dash)
  - Added detailed logging of which auth.json location was loaded
  - Moved misplaced auth.json from `snowcode/` to `snow-code/` directory

### Changed
- **Auth Location Priority**:
  1. `~/.local/share/snow-code/auth.json` (OFFICIAL - with dash)
  2. `~/.snow-flow/auth.json` (snow-flow specific)
  3. `~/.local/share/opencode/auth.json` (compatibility fallback)

## [8.31.36] - 2025-11-13

### Fixed
- **MCP Server Authentication**: Fixed critical authentication issue where MCP tools couldn't authenticate with ServiceNow after running `snow-flow auth login`
  - Added automatic fallback to read credentials from `~/.local/share/snow-code/auth.json`
  - Implemented 3-tier credential priority: env vars → auth.json → unauthenticated mode
  - Enhanced error messages to guide users through credential troubleshooting

### Added
- **AUTH-FLOW.md**: Comprehensive authentication documentation
  - Detailed explanation of credential loading priority
  - Troubleshooting guide for common auth issues
  - Security best practices
  - Multiple instance support guide

### Changed
- **MCP Server Startup**: Server now automatically detects and uses snow-code credentials
  - No manual environment variable configuration needed
  - Seamless integration with `snow-flow auth login` flow

## [8.31.35] - 2025-11-12

### Changed
- Updated to use `@groeimetai/snow-code` as dependency
- Fixed module resolution and credential sync issues

### Fixed
- Module resolution for session-memory
- Credential synchronization between snow-flow and snow-code

## Previous Versions

See git history for changes before v8.31.35.
