#!/bin/bash
#
# SnowCode Launcher with MCP Server Pre-flight Checks
# Ensures MCP servers are running before starting SnowCode
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MCP_MANAGER="$SCRIPT_DIR/mcp-server-manager.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Snow-Flow SnowCode Launcher${NC}"
echo -e "${BLUE}════════════════════════════════════════════════${NC}"
echo ""

# Check if snowcode is installed
if ! command -v snowcode &> /dev/null; then
    echo -e "${RED}✗ SnowCode not found!${NC}"
    echo ""
    echo "Install SnowCode:"
    echo "  npm install -g @snowcode-ai/cli"
    echo ""
    echo "Or visit: https://snowcode.ai"
    exit 1
fi

echo -e "${GREEN}✓ SnowCode found${NC}"

# Check if .env exists
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo -e "${RED}✗ .env file not found!${NC}"
    echo ""
    echo "Create .env from template:"
    echo "  cp .env.example .env"
    echo "  # Then edit .env with your ServiceNow credentials"
    exit 1
fi

echo -e "${GREEN}✓ .env file found${NC}"

# Check if dist/ exists (built)
if [ ! -d "$PROJECT_ROOT/dist" ]; then
    echo -e "${YELLOW}Building Snow-Flow...${NC}"
    cd "$PROJECT_ROOT"
    npm run build
fi

echo -e "${GREEN}✓ Snow-Flow built${NC}"

# Check if MCP servers are running
echo -e "\n${BLUE}Checking MCP servers...${NC}"

if "$MCP_MANAGER" status > /dev/null 2>&1; then
    echo -e "${GREEN}✓ MCP servers already running${NC}"
else
    echo -e "${YELLOW}Starting MCP servers...${NC}"
    "$MCP_MANAGER" start
fi

# Run health check
echo -e "\n${BLUE}Running health check...${NC}"
if "$MCP_MANAGER" health; then
    echo -e "${GREEN}✓ All systems operational${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check logs: $MCP_MANAGER logs"
    echo "  2. Verify .env credentials"
    echo "  3. Test manually: $MCP_MANAGER health"
    exit 1
fi

# Check if snowcode-config.json exists
if [ ! -f "$PROJECT_ROOT/snowcode-config.json" ]; then
    echo -e "${YELLOW}Creating snowcode-config.json...${NC}"

    if [ -f "$PROJECT_ROOT/snowcode-config.example.json" ]; then
        cp "$PROJECT_ROOT/snowcode-config.example.json" "$PROJECT_ROOT/snowcode-config.json"

        # Replace variables in config
        source "$PROJECT_ROOT/.env"

        sed -i.bak "s|\${SNOW_INSTANCE}|${SNOW_INSTANCE}|g" "$PROJECT_ROOT/snowcode-config.json"
        sed -i.bak "s|\${SNOW_CLIENT_ID}|${SNOW_CLIENT_ID}|g" "$PROJECT_ROOT/snowcode-config.json"
        sed -i.bak "s|\${SNOW_CLIENT_SECRET}|${SNOW_CLIENT_SECRET}|g" "$PROJECT_ROOT/snowcode-config.json"
        sed -i.bak "s|\${SNOW_USERNAME}|${SNOW_USERNAME}|g" "$PROJECT_ROOT/snowcode-config.json"
        sed -i.bak "s|\${SNOW_PASSWORD}|${SNOW_PASSWORD}|g" "$PROJECT_ROOT/snowcode-config.json"
        sed -i.bak "s|/path/to/your/snow-flow/installation|${PROJECT_ROOT}|g" "$PROJECT_ROOT/snowcode-config.json"

        rm -f "$PROJECT_ROOT/snowcode-config.json.bak"

        echo -e "${GREEN}✓ snowcode-config.json created${NC}"
    else
        echo -e "${RED}✗ snowcode-config.example.json not found${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ SnowCode configuration ready${NC}"

# Start SnowCode
echo -e "\n${BLUE}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Starting SnowCode...${NC}"
echo -e "${BLUE}════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Tips:${NC}"
echo -e "  • MCP tools are loaded: snow_update_set_manage, snow_deploy, etc."
echo -e "  • Start with: ${GREEN}Create an Update Set${NC}"
echo -e "  • Check tools: Type ${GREEN}list available tools${NC}"
echo ""

cd "$PROJECT_ROOT"
exec snowcode "$@"
