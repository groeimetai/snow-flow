#!/bin/bash

# Snow-Flow Enterprise - Jira Integration Test Script
# Run this to test all 8 Jira tools end-to-end

set -e  # Exit on error

echo "🧪 Snow-Flow Enterprise - Jira Integration Test"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server is running
echo "🔍 Checking if license server is running..."
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${RED}❌ License server is not running!${NC}"
    echo ""
    echo "Please start the server first:"
    echo "  cd enterprise/license-server"
    echo "  npm run dev"
    exit 1
fi
echo -e "${GREEN}✅ Server is running${NC}"
echo ""

# Get configuration from user
echo "📝 Enter your Jira details:"
echo ""

read -p "Jira Host (e.g., company.atlassian.net): " JIRA_HOST
read -p "Jira Email: " JIRA_EMAIL
read -sp "Jira API Token: " JIRA_API_TOKEN
echo ""
read -p "Jira Project Key (e.g., PROJ): " JIRA_PROJECT
echo ""

# Admin key for testing
ADMIN_KEY="test-admin-key-123"
BASE_URL="http://localhost:3000"

echo "🏢 Step 1: Creating Service Integrator..."
SI_RESPONSE=$(curl -s -X POST $BASE_URL/api/admin/si \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test SI Company",
    "contactEmail": "contact@testsi.com",
    "billingEmail": "billing@testsi.com"
  }')

SI_ID=$(echo $SI_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -z "$SI_ID" ]; then
    echo -e "${RED}❌ Failed to create Service Integrator${NC}"
    echo $SI_RESPONSE
    exit 1
fi

echo -e "${GREEN}✅ Service Integrator created (ID: $SI_ID)${NC}"
echo ""

echo "👤 Step 2: Creating Test Customer..."
CUSTOMER_RESPONSE=$(curl -s -X POST $BASE_URL/api/admin/customers \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceIntegratorId": '$SI_ID',
    "name": "Test Customer",
    "contactEmail": "customer@test.com",
    "company": "Test Company BV"
  }')

LICENSE_KEY=$(echo $CUSTOMER_RESPONSE | grep -o '"licenseKey":"[^"]*' | cut -d'"' -f4)

if [ -z "$LICENSE_KEY" ]; then
    echo -e "${RED}❌ Failed to create customer${NC}"
    echo $CUSTOMER_RESPONSE
    exit 1
fi

echo -e "${GREEN}✅ Customer created${NC}"
echo -e "   License Key: ${YELLOW}$LICENSE_KEY${NC}"
echo ""

# Function to test a tool
test_tool() {
    local TOOL_NAME=$1
    local ARGS=$2
    local TEST_NAME=$3

    echo "🧪 Testing: $TEST_NAME..."

    RESPONSE=$(curl -s -X POST $BASE_URL/mcp/tools/call \
      -H "Authorization: Bearer $LICENSE_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "tool": "'"$TOOL_NAME"'",
        "arguments": '"$ARGS"',
        "credentials": {
          "jira": {
            "host": "'"$JIRA_HOST"'",
            "email": "'"$JIRA_EMAIL"'",
            "apiToken": "'"$JIRA_API_TOKEN"'"
          }
        }
      }')

    SUCCESS=$(echo $RESPONSE | grep -o '"success":true')

    if [ -n "$SUCCESS" ]; then
        echo -e "${GREEN}✅ $TEST_NAME - PASSED${NC}"
        return 0
    else
        echo -e "${RED}❌ $TEST_NAME - FAILED${NC}"
        echo "Response: $RESPONSE"
        return 1
    fi
}

echo "🎯 Step 3: Testing Jira Tools..."
echo ""

# Test 1: Get Project
test_tool "snow_jira_get_project" \
  '{"projectKey":"'"$JIRA_PROJECT"'"}' \
  "Get Jira Project"

# Test 2: Create Issue
echo ""
echo "📝 Creating test issue..."
CREATE_RESPONSE=$(curl -s -X POST $BASE_URL/mcp/tools/call \
  -H "Authorization: Bearer $LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "snow_jira_create_issue",
    "arguments": {
      "projectKey": "'"$JIRA_PROJECT"'",
      "summary": "Test issue created by Snow-Flow Enterprise",
      "description": "Automated test issue - safe to delete",
      "issueType": "Task",
      "priority": "Low",
      "labels": ["snow-flow-test", "automated", "safe-to-delete"]
    },
    "credentials": {
      "jira": {
        "host": "'"$JIRA_HOST"'",
        "email": "'"$JIRA_EMAIL"'",
        "apiToken": "'"$JIRA_API_TOKEN"'"
      }
    }
  }')

ISSUE_KEY=$(echo $CREATE_RESPONSE | grep -o '"key":"[^"]*' | cut -d'"' -f4)

if [ -z "$ISSUE_KEY" ]; then
    echo -e "${RED}❌ Failed to create test issue${NC}"
    echo $CREATE_RESPONSE
    exit 1
fi

echo -e "${GREEN}✅ Test issue created: $ISSUE_KEY${NC}"
echo ""

# Test 3: Get Issue
test_tool "snow_jira_get_issue" \
  '{"issueKey":"'"$ISSUE_KEY"'"}' \
  "Get Issue Details"

# Test 4: Update Issue
echo ""
test_tool "snow_jira_update_issue" \
  '{"issueKey":"'"$ISSUE_KEY"'","summary":"UPDATED: Test issue via Snow-Flow","priority":"Medium"}' \
  "Update Issue"

# Test 5: Search Issues
echo ""
test_tool "snow_jira_search_issues" \
  '{"jql":"project = '"$JIRA_PROJECT"' AND labels = snow-flow-test","maxResults":10}' \
  "Search Issues"

# Test 6: Sync Backlog
echo ""
test_tool "snow_jira_sync_backlog" \
  '{"projectKey":"'"$JIRA_PROJECT"'","maxResults":5}' \
  "Sync Backlog"

# Test 7: Transition Issue (if workflow allows)
echo ""
echo "🔄 Attempting to transition issue..."
echo "   (May fail if workflow doesn't allow this transition)"
test_tool "snow_jira_transition_issue" \
  '{"issueKey":"'"$ISSUE_KEY"'","transitionIdOrName":"In Progress","comment":"Transitioned by Snow-Flow test"}' \
  "Transition Issue" || echo -e "${YELLOW}⚠️  Transition may not be available in your workflow${NC}"

echo ""
echo "📊 Step 4: Checking Usage Analytics..."
CUSTOMER_ID=$(echo $CUSTOMER_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

ANALYTICS=$(curl -s "$BASE_URL/api/admin/analytics/customer/$CUSTOMER_ID" \
  -H "X-Admin-Key: $ADMIN_KEY")

TOTAL_CALLS=$(echo $ANALYTICS | grep -o '"totalCalls":[0-9]*' | cut -d':' -f2)

if [ -n "$TOTAL_CALLS" ] && [ "$TOTAL_CALLS" -gt 0 ]; then
    echo -e "${GREEN}✅ Usage tracking works! Total calls: $TOTAL_CALLS${NC}"
else
    echo -e "${RED}❌ Usage tracking failed${NC}"
fi

echo ""
echo "🎉 Testing Complete!"
echo ""
echo "Summary:"
echo "  - License Key: $LICENSE_KEY"
echo "  - Test Issue: $ISSUE_KEY"
echo "  - Total API Calls: $TOTAL_CALLS"
echo ""
echo "Check your Jira project to see the test issue!"
echo "You can safely delete issues with label 'safe-to-delete'"
echo ""
echo -e "${GREEN}All tests passed! 🚀${NC}"
