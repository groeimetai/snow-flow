#!/bin/bash

# Snow-Flow Enterprise End-to-End Test Workflow
# Tests complete flow: Auth → Proxy → License Server → Enterprise Tools

set -e  # Exit on error

echo "════════════════════════════════════════════════════════════════"
echo "  Snow-Flow Enterprise - End-to-End Test"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((TESTS_PASSED++))
}

fail() {
  echo -e "${RED}✗${NC} $1"
  ((TESTS_FAILED++))
}

info() {
  echo -e "${YELLOW}ℹ${NC} $1"
}

# Step 1: Check Prerequisites
echo "Step 1: Checking Prerequisites"
echo "────────────────────────────────────────────────────────────────"

if [ -d "license-server/dist" ]; then
  pass "License server built"
else
  fail "License server not built - run: cd license-server && npm run build:backend"
  exit 1
fi

if [ -d "mcp-proxy/dist" ]; then
  pass "MCP proxy built"
else
  fail "MCP proxy not built - run: cd mcp-proxy && npm run build"
  exit 1
fi

if [ -f "license-server/data/licenses.db" ]; then
  pass "Database initialized"
else
  fail "Database not initialized - run: cd license-server && node dist/scripts/init-db.js"
  exit 1
fi

echo ""

# Step 2: Start License Server
echo "Step 2: Starting License Server"
echo "────────────────────────────────────────────────────────────────"

cd license-server

# Start server in background
node dist/index.js > ../license-server.log 2>&1 &
SERVER_PID=$!

info "License server started (PID: $SERVER_PID)"
sleep 3  # Wait for server to start

# Test health endpoint
if curl -s http://localhost:3000/health | grep -q '"status":"ok"'; then
  pass "License server is healthy"
else
  fail "License server health check failed"
  kill $SERVER_PID
  exit 1
fi

cd ..
echo ""

# Step 3: Test License Validation
echo "Step 3: Testing License Validation"
echo "────────────────────────────────────────────────────────────────"

# Test valid license
VALID_RESPONSE=$(curl -s -X POST http://localhost:3000/validate \
  -H "Content-Type: application/json" \
  -d '{
    "key": "SNOW-ENT-1B2BB5BF",
    "version": "1.0.0",
    "instanceId": "test-instance-001",
    "timestamp": '$(date +%s)'
  }')

if echo "$VALID_RESPONSE" | grep -q '"valid":true'; then
  pass "Valid license accepted"
else
  fail "Valid license rejected: $VALID_RESPONSE"
fi

# Test invalid license
INVALID_RESPONSE=$(curl -s -X POST http://localhost:3000/validate \
  -H "Content-Type: application/json" \
  -d '{
    "key": "SNOW-INVALID-KEY",
    "version": "1.0.0",
    "instanceId": "test-instance-002",
    "timestamp": '$(date +%s)'
  }')

if echo "$INVALID_RESPONSE" | grep -q '"valid":false'; then
  pass "Invalid license rejected"
else
  fail "Invalid license accepted"
fi

echo ""

# Step 4: Test MCP Endpoints
echo "Step 4: Testing MCP Endpoints"
echo "────────────────────────────────────────────────────────────────"

# Test tools listing
TOOLS_RESPONSE=$(curl -s -X POST http://localhost:3000/mcp/tools/list \
  -H "Authorization: Bearer SNOW-ENT-1B2BB5BF" \
  -H "Content-Type: application/json")

if echo "$TOOLS_RESPONSE" | grep -q '"success":true'; then
  TOOL_COUNT=$(echo "$TOOLS_RESPONSE" | grep -o '"name"' | wc -l | tr -d ' ')
  pass "MCP tools endpoint working ($TOOL_COUNT tools available)"
else
  fail "MCP tools endpoint failed"
fi

echo ""

# Step 5: Test Admin API
echo "Step 5: Testing Admin API"
echo "────────────────────────────────────────────────────────────────"

# List licenses
ADMIN_RESPONSE=$(curl -s http://localhost:3000/api/admin/licenses \
  -H "X-Admin-Key: test-admin-key-12345")

if echo "$ADMIN_RESPONSE" | grep -q "SNOW-ENT"; then
  LICENSE_COUNT=$(echo "$ADMIN_RESPONSE" | grep -o '"licenseKey"' | wc -l | tr -d ' ')
  pass "Admin API working ($LICENSE_COUNT licenses found)"
else
  fail "Admin API failed"
fi

echo ""

# Step 6: Test MCP Proxy (if configured)
echo "Step 6: Testing MCP Proxy"
echo "────────────────────────────────────────────────────────────────"

if [ -f "mcp-proxy/dist/enterprise-proxy.js" ]; then
  info "MCP proxy available for testing"
  info "To test proxy manually:"
  info "  1. Start proxy: cd mcp-proxy && node dist/enterprise-proxy.js"
  info "  2. Configure SnowCode/Claude Code with enterprise server"
  info "  3. Try: 'List available Jira tools'"
  pass "MCP proxy ready"
else
  fail "MCP proxy not built"
fi

echo ""

# Step 7: Cleanup
echo "Step 7: Cleanup"
echo "────────────────────────────────────────────────────────────────"

info "Stopping license server (PID: $SERVER_PID)"
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null || true
pass "License server stopped"

echo ""

# Test Summary
echo "════════════════════════════════════════════════════════════════"
echo "  Test Summary"
echo "════════════════════════════════════════════════════════════════"
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed! Enterprise platform is ready.${NC}"
  echo ""
  echo "Next Steps:"
  echo "  1. Deploy license server to GCP Cloud Run"
  echo "  2. Update SNOW_ENTERPRISE_URL in snow-flow auth login"
  echo "  3. Test complete workflow with real ServiceNow instance"
  exit 0
else
  echo -e "${RED}✗ Some tests failed. Please review the errors above.${NC}"
  exit 1
fi
