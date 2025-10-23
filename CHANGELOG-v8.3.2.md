# Snow-Flow v8.3.2 - Automatic MCP Server Setup

**Release Date**: 2025-10-22

## 🚀 Major Enhancement: Automated MCP Server Management

Snow-Flow now automatically sets up complete MCP server management infrastructure when running `snow-flow init`!

### What's New

#### Automatic Script Installation
When you run `snow-flow init`, Snow-Flow now automatically:

1. **Creates `scripts/` directory** in your project
2. **Copies MCP server management scripts**:
   - `mcp-server-manager.sh` - Full MCP server lifecycle management (start/stop/restart/status/health/logs)
   - `start-opencode.sh` - Smart OpenCode launcher with pre-flight checks
3. **Makes scripts executable** automatically (chmod +x)
4. **Copies troubleshooting guide** (OPENCODE-TROUBLESHOOTING.md) to project root

#### Smart OpenCode Launcher (`./scripts/start-opencode.sh`)

The new launcher provides:
- ✅ Pre-flight validation (.env exists, Snow-Flow built)
- ✅ Automatic MCP server startup
- ✅ Health checks before launching OpenCode
- ✅ Automatic `opencode-config.json` creation from template
- ✅ Environment variable substitution
- ✅ Clear error messages with solutions

**Usage**:
```bash
# After snow-flow init:
./scripts/start-opencode.sh

# Or with arguments:
./scripts/start-opencode.sh --verbose
```

#### MCP Server Manager (`./scripts/mcp-server-manager.sh`)

Full lifecycle management for MCP servers:

**Commands**:
- `./scripts/mcp-server-manager.sh start` - Start MCP servers in background
- `./scripts/mcp-server-manager.sh stop` - Stop MCP servers
- `./scripts/mcp-server-manager.sh restart` - Restart MCP servers
- `./scripts/mcp-server-manager.sh status` - Check server status and tool count
- `./scripts/mcp-server-manager.sh health` - Run JSON-RPC health check
- `./scripts/mcp-server-manager.sh logs` - Follow live server logs

**Features**:
- OAuth + username/password authentication support
- Automatic fallback to username/password if OAuth fails
- Health checks verify 370+ tools are loaded
- Clear status messages and error diagnostics

### Updated `snow-flow init` Output

The init command now shows:

```
✅ Snow-Flow project initialized successfully!

📋 Created Snow-Flow configuration:
   ✓ .opencode/ - OpenCode configuration with both MCP servers
   ✓ .opencode/themes/ - ServiceNow custom theme for OpenCode
   ✓ .claude/ - Claude Code MCP configuration (backward compatibility)
   ✓ .mcp.json - 2 unified MCP servers (370 tools total)
   ✓ scripts/ - MCP server management and OpenCode launcher
   ✓ AGENTS.md - OpenCode primary instructions
   ✓ CLAUDE.md - Claude Code compatibility
   ✓ README.md - Complete capabilities documentation
   ✓ OPENCODE-TROUBLESHOOTING.md - Troubleshooting guide
   ✓ .snow-flow/ - Project workspace and memory

🎯 Next steps:
1. Configure credentials: Edit .env
   - Add your ServiceNow instance URL, username/password or OAuth credentials
2. Authenticate: snow-flow auth login
   - Authenticates with your LLM provider (Claude/OpenAI/Google/Ollama)
   - Then authenticates with ServiceNow OAuth
   - Your provider choice is automatically saved to .env
3. Start developing with OpenCode: ./scripts/start-opencode.sh
   - Smart launcher with pre-flight checks and MCP server management
   - Or use swarm: snow-flow swarm "create incident dashboard"
   - Or launch OpenCode directly: opencode
```

### Package Updates

#### Updated `package.json` files array:
- Added `scripts/` directory (includes all MCP management scripts)
- Added `OPENCODE-SETUP.md` (complete setup guide)
- Added `OPENCODE-TROUBLESHOOTING.md` (comprehensive troubleshooting)

#### Updated directory structure:
```
your-project/
├── scripts/
│   ├── mcp-server-manager.sh    (executable)
│   └── start-opencode.sh         (executable)
├── OPENCODE-TROUBLESHOOTING.md
├── opencode-config.example.json
└── .env
```

### Benefits

1. **Zero Manual Setup**: No need to manually copy scripts or create launcher
2. **Consistent Environment**: Same scripts for all users, version-controlled
3. **Better DX**: Clear next steps, automatic validation, helpful error messages
4. **Production Ready**: Scripts handle OAuth failures, provide diagnostics, manage lifecycle

### Migration from v8.3.1

If you already have a Snow-Flow project:

```bash
# Update to v8.3.2
npm install -g snow-flow@latest

# Re-run init with --force to get new scripts
cd your-project
snow-flow init --force

# Or manually copy scripts (if you want to preserve customizations)
cp node_modules/snow-flow/scripts/*.sh ./scripts/
chmod +x ./scripts/*.sh
```

### Technical Details

#### Implementation Changes

**src/cli.ts**:
- Added `copyMCPServerScripts()` helper function
- Integrated into init command workflow
- Updated "Next steps" to recommend `./scripts/start-opencode.sh`
- Added `scripts/` to directory structure creation

**package.json**:
- Added `scripts/` to files array
- Added `OPENCODE-SETUP.md` and `OPENCODE-TROUBLESHOOTING.md` to files array
- Ensures all necessary files are included in npm package

#### Script Features

**mcp-server-manager.sh**:
- Loads environment from `.env`
- Validates MCP server binary exists (dist/mcp/servicenow-mcp-unified/index.js)
- Manages PID file (/tmp/snow-flow-mcp.pid)
- Logs to /tmp/snow-flow-mcp.log
- Health check tests JSON-RPC communication (tools/list request)

**start-opencode.sh**:
- Validates OpenCode installed
- Checks `.env` exists
- Builds Snow-Flow if needed (npm run build)
- Auto-starts MCP servers
- Runs health checks
- Creates `opencode-config.json` from template
- Substitutes environment variables (${SNOW_INSTANCE}, ${SNOW_USERNAME}, etc.)

### Breaking Changes

None! This is a backward-compatible enhancement.

### Bug Fixes

None in this release (focused on new automation feature).

---

## Previous Releases

- **v8.3.1**: Fixed OpenCode MCP configuration format + added username/password auth fallback
- **v8.3.0**: Added enterprise theme features + updated templates
- **v8.2.0**: Optimized MCP tools + merged Update Set tools (14 tools removed)

---

**Full Changelog**: https://github.com/groeimetai/snow-flow/blob/main/CHANGELOG.md
