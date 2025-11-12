# Changelog

All notable changes to Snow-Flow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
