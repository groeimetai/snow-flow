#!/bin/bash
#
# MCP Server Manager for Snow-Flow
# Helps start, stop, and monitor MCP servers for OpenCode
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MCP_SERVER_PATH="$PROJECT_ROOT/dist/mcp/servicenow-mcp-unified/index.js"
PID_FILE="/tmp/snow-flow-mcp.pid"
LOG_FILE="/tmp/snow-flow-mcp.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load .env file if exists
load_env() {
  if [ -f "$PROJECT_ROOT/.env" ]; then
    echo -e "${BLUE}Loading environment from .env...${NC}"
    export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | grep -v '^$' | xargs)
  else
    echo -e "${YELLOW}Warning: No .env file found${NC}"
    echo "Please create one from .env.example:"
    echo "  cp .env.example .env"
    echo "  # Then edit .env with your credentials"
    exit 1
  fi
}

# Check if MCP server is built
check_build() {
  if [ ! -f "$MCP_SERVER_PATH" ]; then
    echo -e "${RED}Error: MCP server not built!${NC}"
    echo "Run: npm run build"
    exit 1
  fi
  echo -e "${GREEN}✓ MCP server binary found${NC}"
}

# Check if MCP server is running
is_running() {
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
      return 0
    else
      rm -f "$PID_FILE"
      return 1
    fi
  fi
  return 1
}

# Start MCP server
start_server() {
  echo -e "${BLUE}Starting MCP server...${NC}"

  load_env
  check_build

  if is_running; then
    echo -e "${YELLOW}MCP server is already running (PID: $(cat $PID_FILE))${NC}"
    return 0
  fi

  # Prepare environment variables
  export SERVICENOW_INSTANCE_URL="https://${SNOW_INSTANCE}"

  # Try OAuth first, fall back to username/password
  if [ -n "$SNOW_CLIENT_ID" ] && [ -n "$SNOW_CLIENT_SECRET" ]; then
    echo -e "${GREEN}Using OAuth authentication${NC}"
    export SERVICENOW_CLIENT_ID="$SNOW_CLIENT_ID"
    export SERVICENOW_CLIENT_SECRET="$SNOW_CLIENT_SECRET"
  elif [ -n "$SNOW_USERNAME" ] && [ -n "$SNOW_PASSWORD" ]; then
    echo -e "${GREEN}Using Username/Password authentication${NC}"
    export SERVICENOW_USERNAME="$SNOW_USERNAME"
    export SERVICENOW_PASSWORD="$SNOW_PASSWORD"
  else
    echo -e "${RED}Error: No authentication credentials found!${NC}"
    echo "Set either:"
    echo "  - SNOW_CLIENT_ID + SNOW_CLIENT_SECRET (OAuth)"
    echo "  - SNOW_USERNAME + SNOW_PASSWORD"
    exit 1
  fi

  # Start server in background
  nohup node "$MCP_SERVER_PATH" > "$LOG_FILE" 2>&1 &
  PID=$!
  echo $PID > "$PID_FILE"

  # Wait for server to start
  echo -e "${BLUE}Waiting for server to start...${NC}"
  sleep 2

  if is_running; then
    echo -e "${GREEN}✓ MCP server started (PID: $PID)${NC}"
    echo -e "${BLUE}Log file: $LOG_FILE${NC}"
    return 0
  else
    echo -e "${RED}✗ Failed to start MCP server${NC}"
    echo "Check logs: cat $LOG_FILE"
    return 1
  fi
}

# Stop MCP server
stop_server() {
  echo -e "${BLUE}Stopping MCP server...${NC}"

  if ! is_running; then
    echo -e "${YELLOW}MCP server is not running${NC}"
    return 0
  fi

  PID=$(cat "$PID_FILE")
  kill $PID 2>/dev/null || true
  sleep 1

  if ! is_running; then
    echo -e "${GREEN}✓ MCP server stopped${NC}"
    rm -f "$PID_FILE"
  else
    echo -e "${YELLOW}Forcing server shutdown...${NC}"
    kill -9 $PID 2>/dev/null || true
    rm -f "$PID_FILE"
    echo -e "${GREEN}✓ MCP server killed${NC}"
  fi
}

# Check MCP server status
status_check() {
  echo -e "${BLUE}Checking MCP server status...${NC}"

  check_build

  if is_running; then
    PID=$(cat "$PID_FILE")
    echo -e "${GREEN}✓ MCP server is running (PID: $PID)${NC}"

    # Check tool count
    TOOL_COUNT=$(grep -c "Registered:" "$LOG_FILE" 2>/dev/null || echo "0")
    echo -e "${GREEN}✓ Tools loaded: $TOOL_COUNT${NC}"

    # Check last 10 log lines
    echo -e "\n${BLUE}Recent logs:${NC}"
    tail -n 10 "$LOG_FILE" 2>/dev/null || echo "No logs available"

    return 0
  else
    echo -e "${RED}✗ MCP server is not running${NC}"
    return 1
  fi
}

# Health check with tool test
health_check() {
  echo -e "${BLUE}Running health check...${NC}"

  if ! is_running; then
    echo -e "${RED}✗ MCP server is not running${NC}"
    echo "Start it with: $0 start"
    return 1
  fi

  load_env

  # Test JSON-RPC communication
  echo -e "${BLUE}Testing JSON-RPC communication...${NC}"

  cat > /tmp/mcp_health_check.js << 'EOF'
const { spawn } = require('child_process');

const mcp = spawn('node', [process.argv[2]], {
  env: process.env,
  stdio: ['pipe', 'pipe', 'pipe']
});

let buffer = '';
let testPassed = false;

mcp.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop();

  lines.forEach(line => {
    if (line.trim() && line.startsWith('{')) {
      try {
        const msg = JSON.parse(line);
        if (msg.result && msg.result.tools) {
          console.log(`✓ Health check passed - ${msg.result.tools.length} tools available`);
          testPassed = true;
          mcp.kill();
          process.exit(0);
        }
      } catch (e) {}
    }
  });
});

mcp.stderr.on('data', (data) => {
  // Ignore stderr logs from server
});

// Initialize and list tools
setTimeout(() => {
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'health-check', version: '1.0.0' }
    }
  };
  mcp.stdin.write(JSON.stringify(initRequest) + '\n');
}, 500);

setTimeout(() => {
  const toolsRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  };
  mcp.stdin.write(JSON.stringify(toolsRequest) + '\n');
}, 1500);

setTimeout(() => {
  if (!testPassed) {
    console.log('✗ Health check failed - timeout');
    mcp.kill();
    process.exit(1);
  }
}, 5000);
EOF

  SERVICENOW_INSTANCE_URL="https://${SNOW_INSTANCE}" \
  SERVICENOW_CLIENT_ID="$SNOW_CLIENT_ID" \
  SERVICENOW_CLIENT_SECRET="$SNOW_CLIENT_SECRET" \
  SERVICENOW_USERNAME="$SNOW_USERNAME" \
  SERVICENOW_PASSWORD="$SNOW_PASSWORD" \
  node /tmp/mcp_health_check.js "$MCP_SERVER_PATH"

  rm -f /tmp/mcp_health_check.js
}

# Show logs
show_logs() {
  if [ -f "$LOG_FILE" ]; then
    echo -e "${BLUE}MCP Server Logs:${NC}"
    tail -f "$LOG_FILE"
  else
    echo -e "${YELLOW}No logs available${NC}"
  fi
}

# Restart server
restart_server() {
  stop_server
  sleep 1
  start_server
}

# Main menu
show_help() {
  echo "MCP Server Manager for Snow-Flow"
  echo ""
  echo "Usage: $0 [command]"
  echo ""
  echo "Commands:"
  echo "  start       Start MCP server"
  echo "  stop        Stop MCP server"
  echo "  restart     Restart MCP server"
  echo "  status      Show server status"
  echo "  health      Run health check"
  echo "  logs        Show server logs (live)"
  echo "  help        Show this help"
  echo ""
  echo "Examples:"
  echo "  $0 start        # Start MCP server in background"
  echo "  $0 health       # Test JSON-RPC communication"
  echo "  $0 logs         # Follow server logs"
}

# Parse command
case "${1:-help}" in
  start)
    start_server
    ;;
  stop)
    stop_server
    ;;
  restart)
    restart_server
    ;;
  status)
    status_check
    ;;
  health)
    health_check
    ;;
  logs)
    show_logs
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    echo -e "${RED}Unknown command: $1${NC}"
    show_help
    exit 1
    ;;
esac
