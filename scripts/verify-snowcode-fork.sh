#!/bin/bash

# Verification script for Snowcode fork integration
# This script verifies that Snow-Flow is using @groeimetai/snowcode-plugin instead of @opencode-ai/plugin

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Snowcode Fork Verification${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

CHECKS_PASSED=0
CHECKS_TOTAL=0

# Function to run a check
check() {
  CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
  local description="$1"
  local command="$2"

  echo -e "${YELLOW}[$CHECKS_TOTAL]${NC} Checking: $description"

  if eval "$command" > /dev/null 2>&1; then
    echo -e "    ${GREEN}✓ PASS${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
    return 0
  else
    echo -e "    ${RED}✗ FAIL${NC}"
    return 1
  fi
}

# Function to display a value
display() {
  local description="$1"
  local command="$2"

  echo -e "${YELLOW}→${NC} $description"
  result=$(eval "$command" 2>&1 || echo "NOT FOUND")
  echo -e "    ${BLUE}$result${NC}"
}

echo -e "${BLUE}1. Checking npm registry packages...${NC}"
echo ""

check "Snowcode SDK exists on npm" "npm view @groeimetai/snowcode-sdk version"
display "  SDK Version" "npm view @groeimetai/snowcode-sdk version"

check "Snowcode Plugin exists on npm" "npm view @groeimetai/snowcode-plugin version"
display "  Plugin Version" "npm view @groeimetai/snowcode-plugin version"
display "  Plugin Dependencies" "npm view @groeimetai/snowcode-plugin dependencies"

echo ""
echo -e "${BLUE}2. Checking local .opencode/package.json...${NC}"
echo ""

if [ -f ".opencode/package.json" ]; then
  check ".opencode/package.json exists" "test -f .opencode/package.json"

  PLUGIN=$(cat .opencode/package.json | grep -o '@groeimetai/snowcode-plugin' || echo "")
  OLD_PLUGIN=$(cat .opencode/package.json | grep -o '@opencode-ai/plugin' || echo "")

  if [ ! -z "$PLUGIN" ]; then
    echo -e "    ${GREEN}✓ Using snowcode fork: $PLUGIN${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
  else
    echo -e "    ${RED}✗ NOT using snowcode fork${NC}"
  fi

  CHECKS_TOTAL=$((CHECKS_TOTAL + 1))

  if [ ! -z "$OLD_PLUGIN" ]; then
    echo -e "    ${RED}✗ WARNING: Still referencing old plugin: $OLD_PLUGIN${NC}"
  fi

  display "  Full package.json" "cat .opencode/package.json"
else
  echo -e "    ${YELLOW}⚠ .opencode/package.json not found${NC}"
  echo -e "    ${YELLOW}  Run 'snow-flow init' to create it${NC}"
fi

echo ""
echo -e "${BLUE}3. Checking installed node_modules...${NC}"
echo ""

if [ -d ".opencode/node_modules/@groeimetai/snowcode-plugin" ]; then
  check "Snowcode plugin installed in node_modules" "test -d .opencode/node_modules/@groeimetai/snowcode-plugin"
  display "  Installed Version" "cat .opencode/node_modules/@groeimetai/snowcode-plugin/package.json | grep '\"version\"' | head -1"

  if [ -d ".opencode/node_modules/@opencode-ai/plugin" ]; then
    echo -e "    ${RED}✗ WARNING: Old plugin still in node_modules!${NC}"
    echo -e "    ${YELLOW}  Run: cd .opencode && rm -rf node_modules && npm install${NC}"
  else
    echo -e "    ${GREEN}✓ Old plugin NOT in node_modules${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
  fi
elif [ -d ".opencode/node_modules/@opencode-ai/plugin" ]; then
  echo -e "    ${RED}✗ FAIL: Using old @opencode-ai/plugin${NC}"
  echo -e "    ${YELLOW}  Fix: cd .opencode && rm -rf node_modules package-lock.json && npm install${NC}"
else
  echo -e "    ${YELLOW}⚠ No plugins installed yet${NC}"
  echo -e "    ${YELLOW}  Run: cd .opencode && npm install${NC}"
fi

echo ""
echo -e "${BLUE}4. Testing plugin import...${NC}"
echo ""

if [ -d ".opencode/node_modules/@groeimetai/snowcode-plugin" ]; then
  if node -e "import('@groeimetai/snowcode-plugin').then(() => console.log('OK')).catch(e => process.exit(1))" 2>/dev/null; then
    echo -e "    ${GREEN}✓ Plugin loads successfully${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
  else
    echo -e "    ${RED}✗ Plugin failed to load${NC}"
  fi
  CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ $CHECKS_PASSED -eq $CHECKS_TOTAL ]; then
  echo -e "${GREEN}✓ All checks passed! ($CHECKS_PASSED/$CHECKS_TOTAL)${NC}"
  echo -e "${GREEN}  You are using the @groeimetai/snowcode fork!${NC}"
  exit 0
elif [ $CHECKS_PASSED -gt 0 ]; then
  echo -e "${YELLOW}⚠ Partial success: $CHECKS_PASSED/$CHECKS_TOTAL checks passed${NC}"
  echo -e "${YELLOW}  Review warnings above${NC}"
  exit 1
else
  echo -e "${RED}✗ Verification failed: $CHECKS_PASSED/$CHECKS_TOTAL checks passed${NC}"
  exit 1
fi
