# Snow-Flow Enterprise - Monitoring & Alerting Configuration

## Overview

This document describes the comprehensive monitoring and alerting setup for Snow-Flow Enterprise running on Google Cloud Platform.

## Services Being Monitored

| Service | Type | Region | Purpose |
|---------|------|--------|---------|
| `snow-flow-enterprise` | Cloud Run | europe-west4 | Customer portal (web UI) |
| `snow-flow-enterprise-mcp-server` | Cloud Run | europe-west4 | MCP server (enterprise tools) |

## Alert Policies

### 1. **Uptime Alerts** (CRITICAL)

**Purpose:** Detect when services are down or unresponsive

| Alert | Threshold | Severity | Notification |
|-------|-----------|----------|--------------|
| MCP Server Down | Health check fails 3x in 1 min | CRITICAL | Email + SMS |
| Portal Down | Health check fails 3x in 1 min | CRITICAL | Email + SMS |
| MCP Server Degraded | Success rate < 95% for 5 min | WARNING | Email |
| Portal Degraded | Success rate < 95% for 5 min | WARNING | Email |

**Configuration:**
```bash
# Uptime check for MCP Server
gcloud monitoring uptime create \
  --display-name="Snow-Flow MCP Server Uptime" \
  --resource-type="uptime-url" \
  --host="https://snow-flow-enterprise-mcp-server-761141808583.europe-west4.run.app" \
  --path="/health" \
  --check-interval="60s" \
  --timeout="10s" \
  --project=snow-flow-ai

# Uptime check for Portal
gcloud monitoring uptime create \
  --display-name="Snow-Flow Portal Uptime" \
  --resource-type="uptime-url" \
  --host="https://snow-flow-enterprise-761141808583.europe-west4.run.app" \
  --path="/health" \
  --check-interval="60s" \
  --timeout="10s" \
  --project=snow-flow-ai
```

### 2. **Response Time Alerts** (WARNING)

**Purpose:** Detect performance degradation

| Alert | Threshold | Severity | Notification |
|-------|-----------|----------|--------------|
| MCP Server Slow | P95 latency > 1000ms for 5 min | WARNING | Email |
| Portal Slow | P95 latency > 2000ms for 5 min | WARNING | Email |
| MCP Server Very Slow | P95 latency > 5000ms for 2 min | CRITICAL | Email + SMS |

### 3. **Error Rate Alerts** (CRITICAL)

**Purpose:** Detect when errors are spiking

| Alert | Threshold | Severity | Notification |
|-------|-----------|----------|--------------|
| High Error Rate | Error rate > 5% for 5 min | CRITICAL | Email + SMS |
| Elevated Errors | Error rate > 1% for 10 min | WARNING | Email |
| Auth Failures Spike | 401/403 errors > 100 in 5 min | WARNING | Email |

### 4. **Resource Utilization Alerts** (WARNING)

**Purpose:** Prevent resource exhaustion

| Alert | Threshold | Severity | Notification |
|-------|-----------|----------|--------------|
| High CPU Usage | CPU > 80% for 10 min | WARNING | Email |
| Critical CPU | CPU > 95% for 2 min | CRITICAL | Email + SMS |
| High Memory | Memory > 80% for 10 min | WARNING | Email |
| Critical Memory | Memory > 95% for 2 min | CRITICAL | Email + SMS |
| Container Restarts | > 3 restarts in 10 min | WARNING | Email |

### 5. **Database Alerts** (CRITICAL)

**Purpose:** Monitor database health and connection pool

| Alert | Threshold | Severity | Notification |
|-------|-----------|----------|--------------|
| High DB Connections | Connections > 80/100 for 5 min | WARNING | Email |
| DB Connection Exhaustion | Connections > 95/100 for 1 min | CRITICAL | Email + SMS |
| Slow Queries | Query time > 10s | WARNING | Email |
| DB Connection Errors | Connection errors > 10 in 5 min | CRITICAL | Email + SMS |

### 6. **Cost Alerts** (INFORMATIONAL)

**Purpose:** Track and control costs

| Alert | Threshold | Severity | Notification |
|-------|-----------|----------|--------------|
| Budget 50% Reached | Monthly spend > 50% budget | INFO | Email |
| Budget 75% Reached | Monthly spend > 75% budget | WARNING | Email |
| Budget 90% Reached | Monthly spend > 90% budget | WARNING | Email + SMS |
| Budget Exceeded | Monthly spend > 100% budget | CRITICAL | Email + SMS |
| Cost Anomaly | Daily spend > 150% of average | WARNING | Email |

## Notification Channels

### Email Notifications

**Recipients:**
- Primary: your-email@snow-flow.dev
- Secondary: alerts@snow-flow.dev (optional team email)

**Configuration:**
```bash
# Create email notification channel
gcloud alpha monitoring channels create \
  --display-name="Primary Email Alerts" \
  --type=email \
  --channel-labels=email_address=your-email@snow-flow.dev \
  --project=snow-flow-ai
```

### SMS Notifications (Optional)

**Recipients:**
- Primary: +31612345678

**Note:** SMS requires Twilio integration or Google Cloud SMS (additional setup required)

### Slack Notifications (Optional)

**Channel:** #alerts

**Configuration:**
```bash
# Create Slack notification channel (requires webhook URL)
gcloud alpha monitoring channels create \
  --display-name="Slack Alerts Channel" \
  --type=slack \
  --channel-labels=url=https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  --project=snow-flow-ai
```

## Alert Escalation Policy

### Level 1: Automated Response (Immediate)
- Auto-restart failed containers (Cloud Run automatic)
- Auto-scale up if CPU/Memory high (Cloud Run automatic)
- Log incident to monitoring dashboard

### Level 2: Email Notification (1-5 minutes)
- Send email alert for WARNING severity
- Include context: service, metric, threshold
- Link to Cloud Console logs

### Level 3: SMS/Slack Notification (Immediate)
- Send SMS for CRITICAL severity only
- Send Slack message for all alerts
- Include incident ID and priority

### Level 4: Manual Intervention (As needed)
- Review logs in Cloud Console
- Investigate root cause
- Apply fix or rollback
- Update status page

## Monitoring Dashboard

### Key Metrics to Display

**1. Service Health (Real-time)**
```
├─ Uptime percentage (last 24h, 7d, 30d)
├─ Request rate (requests/min)
├─ Success rate (%)
├─ Error rate (%)
└─ P50/P95/P99 latency
```

**2. Infrastructure**
```
├─ Active Cloud Run instances
├─ CPU utilization (%)
├─ Memory utilization (%)
├─ Container restarts (count)
└─ Auto-scaling status
```

**3. Database**
```
├─ Active connections (current/max)
├─ Query performance (avg time)
├─ Slow query count
└─ Connection errors
```

**4. Business Metrics**
```
├─ Active users (by tier)
├─ API calls per tool
├─ License key validations (success/fail)
└─ Geographic distribution
```

**5. Cost Tracking**
```
├─ Daily spend trend
├─ Monthly spend vs budget
├─ Cost per service
└─ Projected end-of-month cost
```

## Quick Setup Commands

### Step 1: Enable Required APIs
```bash
gcloud services enable monitoring.googleapis.com --project=snow-flow-ai
gcloud services enable cloudscheduler.googleapis.com --project=snow-flow-ai
gcloud services enable logging.googleapis.com --project=snow-flow-ai
```

### Step 2: Create Email Notification Channel
```bash
# Replace with your actual email
gcloud alpha monitoring channels create \
  --display-name="Snow-Flow Alerts" \
  --type=email \
  --channel-labels=email_address=YOUR_EMAIL@snow-flow.dev \
  --project=snow-flow-ai
```

### Step 3: Create Uptime Checks
```bash
# MCP Server health check
gcloud monitoring uptime create \
  --display-name="MCP Server Health" \
  --resource-type=uptime-url \
  --monitored-resource-type=uptime-url \
  --host=snow-flow-enterprise-mcp-server-761141808583.europe-west4.run.app \
  --path=/health \
  --check-interval=60s \
  --timeout=10s \
  --project=snow-flow-ai

# Portal health check
gcloud monitoring uptime create \
  --display-name="Portal Health" \
  --resource-type=uptime-url \
  --monitored-resource-type=uptime-url \
  --host=snow-flow-enterprise-761141808583.europe-west4.run.app \
  --path=/health \
  --check-interval=60s \
  --timeout=10s \
  --project=snow-flow-ai
```

### Step 4: Create Alert Policies (via Cloud Console)

**Note:** Alert policies are easiest to create via Cloud Console UI:
1. Go to: https://console.cloud.google.com/monitoring/alerting
2. Click "Create Policy"
3. Configure conditions, notifications, documentation

**Alternatively, use YAML configuration files (recommended for production)**

## Maintenance Windows

### Scheduled Maintenance
- **Frequency:** Monthly (first Sunday, 2-4 AM CET)
- **Duration:** Maximum 2 hours
- **Communication:** 7 days advance notice via status page
- **Alerts:** Disabled during maintenance window

## Status Page Integration

### Public Status Page URL
`status.snow-flow.dev` (to be configured)

### Status Levels
| Level | Description | Example |
|-------|-------------|---------|
| ✅ Operational | All systems working normally | Normal operation |
| ⚠️ Degraded Performance | Experiencing slowness | P95 latency > 2s |
| ⚠️ Partial Outage | Some features unavailable | Jira integration down |
| ❌ Major Outage | Service completely down | Cannot connect |
| 🔧 Maintenance | Planned downtime | Scheduled upgrade |

### Automatic Updates
- Status page updates automatically based on alert status
- Users can subscribe for email/SMS notifications
- Historical incident reports published

## Logging Configuration

### Log Retention
- **Error logs:** 90 days
- **Info logs:** 30 days
- **Debug logs:** 7 days

### Log Filters
```bash
# View errors from last hour
gcloud logging read "resource.type=cloud_run_revision AND severity=ERROR" \
  --limit=50 \
  --project=snow-flow-ai

# View MCP server logs
gcloud logging read "resource.labels.service_name=snow-flow-enterprise-mcp-server" \
  --limit=100 \
  --project=snow-flow-ai
```

## Cost Management

### Monthly Budget
- **Target:** $2,000/month
- **Alerts at:** 50%, 75%, 90%, 100%
- **Includes:** Cloud Run, Cloud SQL, Networking, Monitoring

### Cost Optimization
- Auto-scale down during off-peak hours (11PM - 6AM CET)
- Use sustained use discounts
- Monitor and remove unused resources
- Optimize database queries

## Support & On-Call

### On-Call Rotation
- **Primary:** Your email/phone
- **Secondary:** TBD (when team grows)
- **Escalation:** After 30 minutes

### Response Time SLA
| Severity | Response Time | Resolution Time |
|----------|---------------|-----------------|
| CRITICAL | 15 minutes | 1 hour |
| WARNING | 1 hour | 4 hours |
| INFO | 4 hours | 1 business day |

## Testing Alerts

### Test Alert Firing
```bash
# Simulate high CPU (optional - for testing only)
# This would require deploying a test workload

# View alert history
gcloud alpha monitoring policies list --project=snow-flow-ai

# Test notification channel
gcloud alpha monitoring channels send-verification-code CHANNEL_ID \
  --project=snow-flow-ai
```

## Next Steps

1. ✅ Enable monitoring APIs
2. ✅ Create notification channels (email, SMS, Slack)
3. ✅ Set up uptime checks
4. ✅ Configure alert policies
5. ⏳ Build monitoring dashboard (React/Next.js)
6. ⏳ Set up status page (status.snow-flow.dev)
7. ⏳ Integrate with incident management (PagerDuty optional)
8. ⏳ Document runbooks for common incidents

## Additional Resources

- **Cloud Monitoring Docs:** https://cloud.google.com/monitoring/docs
- **Alert Policy Best Practices:** https://cloud.google.com/monitoring/alerts/best-practices
- **Cloud Run Monitoring:** https://cloud.google.com/run/docs/monitoring
- **Cost Management:** https://cloud.google.com/billing/docs/how-to/budgets

---

**Last Updated:** 2025-01-28
**Document Owner:** Snow-Flow DevOps Team
**Review Frequency:** Monthly
