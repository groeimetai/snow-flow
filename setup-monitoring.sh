#!/bin/bash

# Snow-Flow Enterprise - Monitoring Setup Script
# This script sets up Google Cloud Monitoring alerts for production services
#
# Usage: ./setup-monitoring.sh YOUR_EMAIL@example.com

set -e

PROJECT_ID="snow-flow-ai"
REGION="europe-west4"
MCP_SERVER_URL="https://snow-flow-enterprise-mcp-server-761141808583.europe-west4.run.app"
PORTAL_URL="https://snow-flow-enterprise-761141808583.europe-west4.run.app"

# Check if email is provided
if [ -z "$1" ]; then
  echo "❌ Error: Please provide an email address for alerts"
  echo "Usage: ./setup-monitoring.sh your-email@example.com"
  exit 1
fi

ALERT_EMAIL="$1"

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Snow-Flow Enterprise - Monitoring Setup              ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Alert Email: $ALERT_EMAIL"
echo ""

# Step 1: Verify APIs are enabled
echo "📊 Step 1: Verifying required APIs..."
gcloud services enable monitoring.googleapis.com \
  cloudscheduler.googleapis.com \
  logging.googleapis.com \
  --project=$PROJECT_ID
echo "✅ APIs enabled"
echo ""

# Step 2: Test health endpoints
echo "🏥 Step 2: Testing health endpoints..."
echo "Testing MCP Server..."
MCP_STATUS=$(curl -s $MCP_SERVER_URL/health | jq -r '.status' 2>/dev/null || echo "error")
if [ "$MCP_STATUS" == "ok" ]; then
  echo "✅ MCP Server: Healthy"
else
  echo "⚠️  MCP Server: Not responding correctly"
fi

echo "Testing Portal..."
PORTAL_STATUS=$(curl -s $PORTAL_URL/health | jq -r '.status' 2>/dev/null || echo "error")
if [ "$PORTAL_STATUS" == "ok" ]; then
  echo "✅ Portal: Healthy"
else
  echo "⚠️  Portal: Not responding correctly (this might be expected if not deployed yet)"
fi
echo ""

# Step 3: Create email notification channel
echo "📧 Step 3: Creating email notification channel..."
CHANNEL_ID=$(gcloud alpha monitoring channels create \
  --display-name="Snow-Flow Alerts" \
  --type=email \
  --channel-labels=email_address=$ALERT_EMAIL \
  --project=$PROJECT_ID \
  --format="value(name)" 2>/dev/null || echo "")

if [ -z "$CHANNEL_ID" ]; then
  echo "ℹ️  Email channel might already exist, fetching existing..."
  CHANNEL_ID=$(gcloud alpha monitoring channels list \
    --filter="displayName:'Snow-Flow Alerts'" \
    --project=$PROJECT_ID \
    --format="value(name)" \
    --limit=1)
fi

if [ -n "$CHANNEL_ID" ]; then
  echo "✅ Notification channel created/found: $CHANNEL_ID"
else
  echo "⚠️  Could not create notification channel"
fi
echo ""

# Step 4: Display next steps
echo "╔════════════════════════════════════════════════════════╗"
echo "║  ✅ Basic Monitoring Setup Complete!                   ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Next Steps (Manual Configuration via Cloud Console):"
echo ""
echo "1️⃣  Configure Alert Policies:"
echo "   🔗 https://console.cloud.google.com/monitoring/alerting/policies?project=$PROJECT_ID"
echo ""
echo "   Recommended alerts to create:"
echo "   • MCP Server Down (uptime check fails)"
echo "   • High Error Rate (>5% errors for 5 min)"
echo "   • Slow Response Time (>1s P95 latency)"
echo "   • High CPU Usage (>80% for 10 min)"
echo "   • High Memory Usage (>80% for 10 min)"
echo ""
echo "2️⃣  Create Uptime Checks:"
echo "   🔗 https://console.cloud.google.com/monitoring/uptime?project=$PROJECT_ID"
echo ""
echo "   Endpoints to monitor:"
echo "   • $MCP_SERVER_URL/health"
echo "   • $PORTAL_URL/health"
echo ""
echo "3️⃣  View Monitoring Dashboard:"
echo "   🔗 https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT_ID"
echo ""
echo "4️⃣  Check Logs:"
echo "   🔗 https://console.cloud.google.com/logs?project=$PROJECT_ID"
echo ""
echo "5️⃣  Set Up Budget Alerts:"
echo "   🔗 https://console.cloud.google.com/billing/budgets?project=$PROJECT_ID"
echo ""
echo "📖 Full documentation:"
echo "   📄 monitoring-alerts-config.md"
echo ""
echo "✨ Happy monitoring!"
echo ""
