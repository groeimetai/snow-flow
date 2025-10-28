# Snow-Flow Enterprise - Monitoring & Alerting Dashboard Specification

**Version**: 1.0
**Date**: October 28, 2025
**Target**: Enterprise Portal (portal.snow-flow.dev)
**Purpose**: Real-time monitoring dashboard for infrastructure health, performance, and alerts

---

## TABLE OF CONTENTS

1. [Overview](#1-overview)
2. [Dashboard Layout](#2-dashboard-layout)
3. [Metrics & Data Sources](#3-metrics--data-sources)
4. [Visualization Components](#4-visualization-components)
5. [Alert System](#5-alert-system)
6. [User Roles & Permissions](#6-user-roles--permissions)
7. [Technical Implementation](#7-technical-implementation)
8. [API Specifications](#8-api-specifications)
9. [UI/UX Design Guidelines](#9-uiux-design-guidelines)
10. [Deployment & Testing](#10-deployment--testing)

---

## 1. OVERVIEW

### Purpose

The Monitoring & Alerting Dashboard provides **real-time visibility** into:
- Infrastructure health (MCP servers, portal, database)
- Performance metrics (latency, error rates, throughput)
- Cost tracking (Google Cloud billing, per-customer usage)
- Alert history and incident management

### Target Users

| Role | Access Level | Primary Use Cases |
|------|--------------|-------------------|
| **Snow-Flow Admins** | Full access | Monitor all infrastructure, manage alerts, investigate incidents |
| **Partner Admins** | Partner-scoped | Monitor their white-label portal, view customer usage |
| **Support Team** | Read-only | View incidents, check system status during troubleshooting |
| **Finance Team** | Cost data only | Track cloud spend, forecast costs, analyze per-customer costs |

### Key Features

✅ **Real-Time Monitoring**: Live metrics updated every 30 seconds
✅ **Historical Data**: 30-day retention for trends and analysis
✅ **Alert Management**: View, acknowledge, resolve alerts
✅ **Custom Dashboards**: Partner-specific views with their data only
✅ **Export Capabilities**: Download metrics as CSV/PDF for reports
✅ **Mobile Responsive**: Full functionality on mobile devices

---

## 2. DASHBOARD LAYOUT

### 2.1 Main Dashboard (Home Page)

**Layout**: Grid-based (12 columns)

```
┌────────────────────────────────────────────────────────────────┐
│  [Header Bar]                                   [User Menu]    │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Status Banner]                                                │
│  ✅ All Systems Operational  │  Uptime: 99.97%  │  0 Alerts   │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Key Metrics Row - 4 Cards]                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Uptime   │  │ Latency  │  │ Error    │  │ Active   │     │
│  │ 99.97%   │  │ 245ms    │  │ Rate     │  │ Alerts   │     │
│  │          │  │          │  │ 0.02%    │  │ 0        │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Service Health Grid - 3 Columns]                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ MCP Server   │  │ Portal       │  │ Database     │        │
│  │ ✅ Healthy   │  │ ✅ Healthy   │  │ ✅ Healthy   │        │
│  │ Response:    │  │ Response:    │  │ Connections: │        │
│  │ 180ms        │  │ 320ms        │  │ 12/100       │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Time Series Charts - 2 Columns]                              │
│  ┌─────────────────────────────┐  ┌──────────────────────────┐│
│  │ Request Rate (24h)          │  │ Error Rate (24h)         ││
│  │ [Line Chart]                │  │ [Line Chart]             ││
│  │                             │  │                          ││
│  │ Current: 450 req/min        │  │ Current: 0.02%           ││
│  └─────────────────────────────┘  └──────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────┐  ┌──────────────────────────┐│
│  │ P95 Latency (24h)           │  │ Cost Tracking (30d)      ││
│  │ [Line Chart]                │  │ [Area Chart]             ││
│  │                             │  │                          ││
│  │ Current: 245ms              │  │ Month-to-date: €1,847    ││
│  └─────────────────────────────┘  └──────────────────────────┘│
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Recent Alerts Table]                                          │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ Time       │ Severity │ Service     │ Message      │ Status││
│  ├────────────────────────────────────────────────────────────┤│
│  │ 12:34 PM   │ WARNING  │ MCP Server  │ CPU >80%     │ ACK   ││
│  │ 11:20 AM   │ INFO     │ Portal      │ Deploy v8.6  │ RESOLV││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Detailed Service View (MCP Server / Portal / Database)

**Accessible by**: Clicking on service health card

**Layout**: Detailed metrics for single service

```
┌────────────────────────────────────────────────────────────────┐
│  [Breadcrumb: Home > MCP Server]               [Back Button]   │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  MCP Server - europe-west4                                      │
│  ✅ Healthy  │  Last Check: 2 minutes ago                      │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Detailed Metrics - 5 Cards]                                   │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐      │
│  │CPU     │ │Memory  │ │Requests│ │Latency │ │Errors  │      │
│  │45%     │ │1.2GB   │ │450/min │ │180ms   │ │2 (0.4%)│      │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘      │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Time Period Selector: 1h | 6h | 24h | 7d | 30d]             │
│                                                                 │
│  [Time Series Charts - Full Width]                             │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ CPU Usage (24h)                                          │ │
│  │ [Line Chart with threshold lines]                        │ │
│  │ Yellow line at 80% (WARNING), Red line at 90% (CRITICAL)│ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Memory Usage (24h)                                       │ │
│  │ [Area Chart]                                             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Request Rate & Latency (24h)                             │ │
│  │ [Dual-axis Chart: Line (rate) + Bar (latency)]          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Error Rate & Count (24h)                                 │ │
│  │ [Line Chart with annotations for incidents]             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Instance Details]                                             │
│  Instance ID: snow-flow-enterprise-mcp-server-001               │
│  Region: europe-west4                                           │
│  Last Deployment: Oct 28, 2025 10:45 AM                        │
│  Image: europe-west4-docker.pkg.dev/.../snow-flow:v8.6.7       │
│  Auto-scaling: 1-20 instances (currently 3 active)             │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

### 2.3 Alerts Dashboard

**Accessible by**: Navigation menu > Alerts

**Layout**: Alert management interface

```
┌────────────────────────────────────────────────────────────────┐
│  [Header: Alerts]                              [Filter/Search] │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Alert Summary Cards - 4 Cards]                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Active   │  │ Pending  │  │ Resolved │  │ Total    │     │
│  │ 0        │  │ 2        │  │ 15       │  │ 17       │     │
│  │ CRITICAL │  │ WARNING  │  │ (24h)    │  │ (24h)    │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Filters]                                                      │
│  Severity: [All ▼] [CRITICAL] [HIGH] [WARNING] [INFO]         │
│  Status:   [Active ▼] [Pending] [Acknowledged] [Resolved]     │
│  Service:  [All ▼] [MCP Server] [Portal] [Database]           │
│  Time:     [24h ▼] [7d] [30d] [Custom Range]                  │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Alerts Table - Sortable, Paginated]                          │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ Severity │ Time      │ Service   │ Alert Rule  │ Status   ││
│  ├────────────────────────────────────────────────────────────┤│
│  │ ⚠️ WARN  │ 12:34 PM  │ MCP       │ CPU High    │ [ACK]    ││
│  │         │ Oct 28    │           │ (>80%)      │          ││
│  │         │           │           │ Value: 85%  │          ││
│  ├────────────────────────────────────────────────────────────┤│
│  │ ℹ️ INFO  │ 11:20 AM  │ Portal    │ Deployment  │ [RESOLV] ││
│  │         │ Oct 28    │           │ v8.6.7      │          ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
│  [Pagination: < 1 2 3 ... 10 >]                                │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

**Alert Actions**:
- **Acknowledge**: Mark alert as seen (changes status to "Acknowledged")
- **Resolve**: Mark alert as resolved with resolution notes
- **Snooze**: Temporarily silence alert for X minutes
- **Escalate**: Send to on-call engineer via PagerDuty/Opsgenie

---

### 2.4 Cost Tracking Dashboard

**Accessible by**: Navigation menu > Cost Tracking

**Layout**: Financial monitoring and forecasting

```
┌────────────────────────────────────────────────────────────────┐
│  [Header: Cost Tracking]                        [Export CSV]   │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Cost Summary Cards - 4 Cards]                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Month-to │  │ Daily    │  │ Projected│  │ Budget   │     │
│  │ Date     │  │ Average  │  │ Month End│  │ Status   │     │
│  │ €1,847   │  │ €65.96   │  │ €2,012   │  │ ✅ 92%   │     │
│  │ (28 days)│  │          │  │          │  │ (€2,000) │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Cost Trend Chart - Full Width]                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Daily Cost (30 days)                                     │ │
│  │ [Area Chart with budget threshold line]                 │ │
│  │                                                          │ │
│  │ Budget line at €66.67/day (€2,000/month)                │ │
│  │ Alert thresholds at 50%, 75%, 90%, 100%                 │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Cost Breakdown by Service - Pie Chart + Table]               │
│  ┌─────────────────────┐  ┌────────────────────────────────┐ │
│  │ [Pie Chart]         │  │ Service      │ Cost    │ %     │ │
│  │                     │  ├────────────────────────────────┤ │
│  │ Cloud Run: 65%      │  │ Cloud Run    │ €1,200  │ 65%   │ │
│  │ Database: 20%       │  │ Database     │ €370    │ 20%   │ │
│  │ Storage: 10%        │  │ Storage      │ €185    │ 10%   │ │
│  │ Networking: 5%      │  │ Networking   │ €92     │ 5%    │ │
│  └─────────────────────┘  └────────────────────────────────┘ │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Cost Per Customer (Partner View Only)]                       │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ Customer       │ Active Seats │ Usage  │ Est. Cost/Month  ││
│  ├────────────────────────────────────────────────────────────┤│
│  │ Acme Corp      │ 25           │ High   │ €15.50           ││
│  │ Tech Solutions │ 15           │ Medium │ €9.30            ││
│  │ Global IT      │ 10           │ Low    │ €6.20            ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

### 2.5 Usage Analytics Dashboard

**Accessible by**: Navigation menu > Usage Analytics

**Layout**: Tool usage and customer activity metrics

```
┌────────────────────────────────────────────────────────────────┐
│  [Header: Usage Analytics]                      [Time Range ▼] │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Usage Summary Cards - 4 Cards]                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Active   │  │ API Calls│  │ Most Used│  │ Avg Daily│     │
│  │ Users    │  │ (24h)    │  │ Tool     │  │ Active   │     │
│  │ 450      │  │ 125,430  │  │ snow_    │  │ 312      │     │
│  │          │  │          │  │ query    │  │ users    │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Active Users Timeline - Full Width]                          │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Daily Active Users (30 days)                             │ │
│  │ [Area Chart with annotations for weekends/holidays]     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Top Tools by Usage - 2 Columns]                              │
│  ┌─────────────────────────────┐  ┌──────────────────────────┐│
│  │ Top 10 Tools (by API calls) │  │ Top 10 Tools (by users)  ││
│  │ [Horizontal Bar Chart]      │  │ [Horizontal Bar Chart]   ││
│  │                             │  │                          ││
│  │ 1. snow_query_table: 45.2K  │  │ 1. snow_query_table: 380 ││
│  │ 2. snow_update: 32.1K       │  │ 2. snow_create: 320      ││
│  │ 3. snow_create: 28.5K       │  │ 3. snow_update: 290      ││
│  │ ...                         │  │ ...                      ││
│  └─────────────────────────────┘  └──────────────────────────┘│
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Customer Usage Breakdown (Partner View)]                     │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ Customer       │ API Calls │ Active Users │ Top Tool       ││
│  ├────────────────────────────────────────────────────────────┤│
│  │ Acme Corp      │ 52,340    │ 25           │ snow_query     ││
│  │ Tech Solutions │ 38,120    │ 15           │ snow_deploy    ││
│  │ Global IT      │ 34,970    │ 10           │ snow_update    ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. METRICS & DATA SOURCES

### 3.1 Infrastructure Metrics (Google Cloud Monitoring)

**Source**: Google Cloud Monitoring API
**Update Frequency**: Every 30 seconds (live), 1 minute (historical)
**Retention**: 30 days

| Metric | Description | Threshold (Warning/Critical) | Data Source |
|--------|-------------|------------------------------|-------------|
| **Uptime** | % of time service is available | < 99.9% / < 99.0% | Cloud Monitoring uptime checks |
| **CPU Usage** | % CPU utilization | > 80% / > 90% | Cloud Run metrics |
| **Memory Usage** | Memory consumption (GB) | > 1.6GB / > 1.8GB (2GB limit) | Cloud Run metrics |
| **Request Rate** | Requests per minute | > 1,000/min / > 1,500/min | Cloud Run logs |
| **P95 Latency** | 95th percentile response time | > 500ms / > 1,000ms | Cloud Run logs |
| **Error Rate** | % of requests with errors (5xx) | > 1% / > 5% | Cloud Run logs |
| **Active Instances** | Number of running containers | > 15 / > 18 (max 20) | Cloud Run metrics |
| **Database Connections** | Active DB connections | > 80 / > 95 (max 100) | PostgreSQL metrics |

---

### 3.2 Application Metrics (Custom)

**Source**: Snow-Flow Enterprise MCP Server internal metrics
**Update Frequency**: Real-time (pushed every 60 seconds)
**Retention**: 30 days

| Metric | Description | Calculation | Data Source |
|--------|-------------|-------------|-------------|
| **API Calls (Total)** | Total API calls across all tools | Sum of all `/api/*` requests | Application logs |
| **API Calls (by Tool)** | API calls per MCP tool | Group by tool name | Application logs |
| **Active Users** | Distinct users making API calls | COUNT(DISTINCT user_id) | Application logs |
| **Active Customers** | Distinct customers with active users | COUNT(DISTINCT customer_id) | Application logs |
| **Tool Usage Ranking** | Most used tools by API calls | ORDER BY call_count DESC | Application logs |
| **User Engagement** | Average API calls per user | SUM(api_calls) / COUNT(users) | Application logs |
| **Session Duration** | Average session length | AVG(logout_time - login_time) | Session logs |
| **Failed Authentications** | Login failures (security) | COUNT(login_attempts WHERE success=false) | Auth logs |

---

### 3.3 Cost Metrics (Google Cloud Billing)

**Source**: Google Cloud Billing API
**Update Frequency**: Once per day (morning UTC)
**Retention**: 12 months

| Metric | Description | Calculation | Data Source |
|--------|-------------|-------------|-------------|
| **Daily Cost** | Total cost per day | Sum of all services | Billing API |
| **Month-to-Date Cost** | Cumulative monthly cost | Sum from 1st to current date | Billing API |
| **Projected Month Cost** | Forecasted end-of-month cost | (MTD cost / days elapsed) × days in month | Calculated |
| **Cost by Service** | Cost breakdown (Cloud Run, DB, etc.) | Group by service SKU | Billing API |
| **Cost per Customer** | Estimated cost per customer | Total cost / active customers | Calculated |
| **Budget Status** | % of monthly budget used | (MTD cost / budget) × 100 | Calculated |

---

### 3.4 Alert Metrics

**Source**: Snow-Flow alert management system (PostgreSQL)
**Update Frequency**: Real-time
**Retention**: 90 days

| Metric | Description | Data Source |
|--------|-------------|-------------|
| **Active Alerts** | Alerts currently firing | `alerts` table WHERE status='active' |
| **Pending Alerts** | Alerts awaiting acknowledgment | `alerts` table WHERE status='pending' |
| **Resolved Alerts (24h)** | Alerts resolved in last 24 hours | `alerts` table WHERE status='resolved' AND resolved_at > NOW() - INTERVAL '24 hours' |
| **Mean Time to Acknowledge (MTTA)** | Average time to acknowledge alert | AVG(acknowledged_at - created_at) |
| **Mean Time to Resolve (MTTR)** | Average time to resolve alert | AVG(resolved_at - created_at) |

---

## 4. VISUALIZATION COMPONENTS

### 4.1 Chart Types & Use Cases

| Chart Type | Use Cases | Library |
|------------|-----------|---------|
| **Line Chart** | Time series (latency, request rate, CPU) | Recharts / Chart.js |
| **Area Chart** | Cumulative metrics (cost, active users) | Recharts / Chart.js |
| **Bar Chart** | Comparisons (top tools, daily costs) | Recharts / Chart.js |
| **Pie Chart** | Proportions (cost by service, tool usage %) | Recharts / Chart.js |
| **Gauge Chart** | Single value with threshold (CPU %, uptime) | Recharts custom or D3.js |
| **Heatmap** | Activity patterns (hourly usage) | D3.js |
| **Sparkline** | Miniature trend indicator in cards | Recharts mini chart |

---

### 4.2 Component Library (React)

**Recommended Stack**:
- **Frontend**: React 18+ with TypeScript
- **Charting**: Recharts (responsive, React-native)
- **UI Components**: shadcn/ui or Material-UI
- **State Management**: React Query for API data fetching
- **Styling**: Tailwind CSS
- **Date Handling**: date-fns

**Example Component Structure**:

```typescript
// components/MonitoringDashboard/MetricCard.tsx
interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  suffix?: string; // e.g., "%", "ms", "€"
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title, value, trend, icon, suffix
}) => {
  return (
    <div className="metric-card">
      <div className="metric-header">
        {icon && <span className="metric-icon">{icon}</span>}
        <span className="metric-title">{title}</span>
      </div>
      <div className="metric-value">
        {value}{suffix}
        {trend && <TrendIndicator trend={trend} />}
      </div>
    </div>
  );
};
```

---

### 4.3 Color Palette & Status Indicators

**Status Colors**:
- ✅ **Healthy / OK**: `#10b981` (green-500)
- ⚠️ **Warning**: `#f59e0b` (yellow-500)
- 🔴 **Critical / Error**: `#ef4444` (red-500)
- ℹ️ **Info**: `#3b82f6` (blue-500)
- ⏸️ **Unknown / Pending**: `#6b7280` (gray-500)

**Chart Colors** (Snow-Flow brand palette):
- Primary: `#3b82f6` (blue)
- Secondary: `#8b5cf6` (purple)
- Accent: `#10b981` (green)
- Neutral: `#6b7280` (gray)

---

## 5. ALERT SYSTEM

### 5.1 Alert Severity Levels

| Severity | Description | Response Time | Notification Channels |
|----------|-------------|---------------|----------------------|
| **CRITICAL** | Service down, data loss | 15 minutes | Email + SMS + Slack + PagerDuty |
| **HIGH** | Degraded performance, nearing limits | 1 hour | Email + Slack |
| **WARNING** | Potential issue, proactive | 4 hours | Email |
| **INFO** | Informational, no action needed | N/A | Dashboard only |

---

### 5.2 Alert Rules (from monitoring-alerts-config.md)

**Already defined in `monitoring-alerts-config.md`**:
1. Uptime Alerts (CRITICAL)
2. Performance Alerts (WARNING/CRITICAL)
3. Error Rate Alerts (WARNING/CRITICAL)
4. Resource Alerts (WARNING/CRITICAL)
5. Database Alerts (WARNING/CRITICAL)
6. Cost Alerts (INFO/WARNING)

**Dashboard Integration**:
- Fetch alerts from Google Cloud Monitoring API
- Store alert history in PostgreSQL (`alerts` table)
- Display in real-time on Alerts Dashboard
- Allow manual actions: Acknowledge, Resolve, Snooze, Escalate

---

### 5.3 Alert Notification Flow

```
Google Cloud Monitoring Alert Fires
          │
          ▼
Alert sent to notification channels (Email/SMS/Slack)
          │
          ▼
Alert stored in PostgreSQL (alerts table)
          │
          ▼
Dashboard receives WebSocket update (real-time)
          │
          ▼
Alert appears in Dashboard UI
          │
          ▼
Admin acknowledges/resolves via Dashboard
          │
          ▼
Alert status updated in PostgreSQL
          │
          ▼
(Optional) Resolution notification sent
```

---

## 6. USER ROLES & PERMISSIONS

### 6.1 Role-Based Access Control (RBAC)

| Role | Permissions | Dashboard Access |
|------|-------------|------------------|
| **Super Admin** | Full access (all metrics, all partners, manage alerts) | All dashboards |
| **Snow-Flow Admin** | View all metrics, manage alerts for Snow-Flow services | Main, Alerts, Service Details |
| **Partner Admin** | View partner-specific metrics, manage white-label portal | Partner-scoped dashboards |
| **Support Engineer** | Read-only, view incidents and logs | Main, Alerts (read-only) |
| **Finance Team** | View cost metrics only | Cost Tracking Dashboard |
| **Developer** | View technical metrics (no cost/customer data) | Main, Service Details |

---

### 6.2 Data Filtering by Role

**Partner Admin View**:
- Only see metrics for their own customers
- Cannot see Snow-Flow infrastructure details
- Cannot see other partners' data

**Example SQL Filter**:
```sql
-- Partner Admin can only see their customers' usage
SELECT * FROM usage_analytics
WHERE customer_id IN (
  SELECT customer_id FROM customers WHERE partner_id = :current_user_partner_id
);
```

---

## 7. TECHNICAL IMPLEMENTATION

### 7.1 Technology Stack

**Backend**:
- **API**: Node.js + Express (or existing portal backend)
- **Database**: PostgreSQL (for alert history, usage logs)
- **Caching**: Redis (for frequently accessed metrics)
- **Real-time**: WebSockets (Socket.io) for live updates

**Frontend**:
- **Framework**: React 18+ with TypeScript
- **State Management**: React Query + Zustand
- **Charting**: Recharts
- **UI**: shadcn/ui + Tailwind CSS
- **Build**: Vite or Next.js

**Infrastructure**:
- **Hosting**: Google Cloud Run (same as MCP server)
- **Monitoring**: Google Cloud Monitoring API
- **Billing**: Google Cloud Billing API
- **Logs**: Cloud Logging API

---

### 7.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   User's Browser                             │
│          (React Dashboard with Recharts)                     │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTPS + WebSocket
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               Enterprise Portal (Backend)                    │
│              (Node.js + Express + Socket.io)                 │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  API Endpoints:                                    │    │
│  │  - GET /api/metrics/overview                       │    │
│  │  - GET /api/metrics/service/:serviceId             │    │
│  │  - GET /api/alerts                                 │    │
│  │  - POST /api/alerts/:id/acknowledge                │    │
│  │  - GET /api/costs                                  │    │
│  │  - GET /api/usage                                  │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────┬─────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Google     │  │ PostgreSQL  │  │   Redis     │
│  Cloud APIs │  │  Database   │  │   Cache     │
│             │  │             │  │             │
│ - Monitoring│  │ - Alerts    │  │ - Metrics   │
│ - Billing   │  │ - Usage     │  │ - Sessions  │
│ - Logging   │  │ - Customers │  │             │
└─────────────┘  └─────────────┘  └─────────────┘
```

---

### 7.3 Database Schema (PostgreSQL)

**Table: `alerts`**
```sql
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity VARCHAR(20) NOT NULL, -- CRITICAL, HIGH, WARNING, INFO
  service VARCHAR(50) NOT NULL, -- MCP Server, Portal, Database
  alert_rule VARCHAR(100) NOT NULL, -- e.g., "CPU High"
  message TEXT NOT NULL,
  value NUMERIC, -- e.g., CPU percentage
  threshold NUMERIC, -- e.g., 80% for WARNING
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, pending, acknowledged, resolved
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  resolution_notes TEXT,
  notification_sent BOOLEAN DEFAULT FALSE,
  INDEX idx_status (status),
  INDEX idx_created_at (created_at DESC),
  INDEX idx_service (service)
);
```

**Table: `usage_logs`**
```sql
CREATE TABLE usage_logs (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  user_id UUID NOT NULL REFERENCES users(id),
  tool_name VARCHAR(100) NOT NULL,
  api_endpoint VARCHAR(200) NOT NULL,
  http_method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  INDEX idx_timestamp (timestamp DESC),
  INDEX idx_customer (customer_id, timestamp),
  INDEX idx_tool (tool_name, timestamp)
);
```

**Table: `cost_snapshots`**
```sql
CREATE TABLE cost_snapshots (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_cost NUMERIC(10, 2) NOT NULL,
  cloud_run_cost NUMERIC(10, 2),
  database_cost NUMERIC(10, 2),
  storage_cost NUMERIC(10, 2),
  networking_cost NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  INDEX idx_date (date DESC)
);
```

---

## 8. API SPECIFICATIONS

### 8.1 Metrics API

**GET `/api/metrics/overview`**

**Description**: Get overview metrics for main dashboard

**Query Parameters**:
- `timeRange` (optional): `1h`, `6h`, `24h`, `7d`, `30d` (default: `24h`)

**Response**:
```json
{
  "status": "healthy",
  "uptime": 99.97,
  "alerts": {
    "active": 0,
    "pending": 2,
    "resolved_24h": 15
  },
  "services": {
    "mcp_server": {
      "status": "healthy",
      "cpu_usage": 45.2,
      "memory_usage": 1.2,
      "latency_p95": 180,
      "request_rate": 450,
      "error_rate": 0.02
    },
    "portal": {
      "status": "healthy",
      "cpu_usage": 32.5,
      "memory_usage": 0.8,
      "latency_p95": 320,
      "request_rate": 220,
      "error_rate": 0.01
    },
    "database": {
      "status": "healthy",
      "connections_active": 12,
      "connections_max": 100,
      "query_latency_avg": 45
    }
  },
  "costs": {
    "month_to_date": 1847.23,
    "daily_average": 65.96,
    "projected_month": 2012.45,
    "budget": 2000.00,
    "budget_percent": 92.36
  }
}
```

---

**GET `/api/metrics/service/:serviceId`**

**Description**: Get detailed metrics for a specific service

**Path Parameters**:
- `serviceId`: `mcp_server`, `portal`, or `database`

**Query Parameters**:
- `timeRange` (optional): `1h`, `6h`, `24h`, `7d`, `30d` (default: `24h`)
- `interval` (optional): `1m`, `5m`, `15m`, `1h` (default: auto-calculated)

**Response**:
```json
{
  "service_id": "mcp_server",
  "status": "healthy",
  "last_check": "2025-10-28T14:35:00Z",
  "time_series": {
    "cpu_usage": [
      { "timestamp": "2025-10-28T14:00:00Z", "value": 42.5 },
      { "timestamp": "2025-10-28T14:05:00Z", "value": 45.2 },
      // ... more data points
    ],
    "memory_usage": [ /* similar structure */ ],
    "latency_p95": [ /* similar structure */ ],
    "request_rate": [ /* similar structure */ ],
    "error_rate": [ /* similar structure */ ]
  },
  "metadata": {
    "instance_id": "snow-flow-enterprise-mcp-server-001",
    "region": "europe-west4",
    "last_deployment": "2025-10-28T10:45:00Z",
    "image": "europe-west4-docker.pkg.dev/.../snow-flow:v8.6.7",
    "auto_scaling": {
      "min": 1,
      "max": 20,
      "current": 3
    }
  }
}
```

---

### 8.2 Alerts API

**GET `/api/alerts`**

**Description**: Get list of alerts with filtering

**Query Parameters**:
- `status` (optional): `active`, `pending`, `acknowledged`, `resolved`
- `severity` (optional): `CRITICAL`, `HIGH`, `WARNING`, `INFO`
- `service` (optional): `mcp_server`, `portal`, `database`
- `timeRange` (optional): `24h`, `7d`, `30d`
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20)

**Response**:
```json
{
  "total": 17,
  "page": 1,
  "limit": 20,
  "alerts": [
    {
      "id": "a1b2c3d4-...",
      "severity": "WARNING",
      "service": "mcp_server",
      "alert_rule": "CPU High (>80%)",
      "message": "CPU usage exceeded 80% threshold",
      "value": 85.3,
      "threshold": 80,
      "status": "acknowledged",
      "created_at": "2025-10-28T12:34:00Z",
      "acknowledged_at": "2025-10-28T12:36:00Z",
      "acknowledged_by": {
        "id": "user123",
        "name": "John Doe"
      }
    }
    // ... more alerts
  ]
}
```

---

**POST `/api/alerts/:id/acknowledge`**

**Description**: Acknowledge an alert

**Path Parameters**:
- `id`: Alert UUID

**Request Body**: None

**Response**:
```json
{
  "success": true,
  "alert": {
    "id": "a1b2c3d4-...",
    "status": "acknowledged",
    "acknowledged_at": "2025-10-28T14:40:00Z",
    "acknowledged_by": {
      "id": "user123",
      "name": "John Doe"
    }
  }
}
```

---

**POST `/api/alerts/:id/resolve`**

**Description**: Resolve an alert

**Path Parameters**:
- `id`: Alert UUID

**Request Body**:
```json
{
  "resolution_notes": "Scaled up instances to handle load"
}
```

**Response**:
```json
{
  "success": true,
  "alert": {
    "id": "a1b2c3d4-...",
    "status": "resolved",
    "resolved_at": "2025-10-28T14:45:00Z",
    "resolved_by": {
      "id": "user123",
      "name": "John Doe"
    },
    "resolution_notes": "Scaled up instances to handle load"
  }
}
```

---

### 8.3 Cost Tracking API

**GET `/api/costs`**

**Description**: Get cost metrics

**Query Parameters**:
- `timeRange` (optional): `7d`, `30d`, `90d` (default: `30d`)
- `groupBy` (optional): `day`, `service` (default: `day`)

**Response**:
```json
{
  "month_to_date": 1847.23,
  "daily_average": 65.96,
  "projected_month": 2012.45,
  "budget": 2000.00,
  "budget_percent": 92.36,
  "daily_costs": [
    { "date": "2025-10-01", "cost": 62.35 },
    { "date": "2025-10-02", "cost": 68.12 },
    // ... more days
  ],
  "cost_by_service": [
    { "service": "Cloud Run", "cost": 1200.50, "percent": 65.0 },
    { "service": "Database", "cost": 370.20, "percent": 20.0 },
    { "service": "Storage", "cost": 185.10, "percent": 10.0 },
    { "service": "Networking", "cost": 91.43, "percent": 5.0 }
  ]
}
```

---

### 8.4 Usage Analytics API

**GET `/api/usage`**

**Description**: Get usage analytics

**Query Parameters**:
- `timeRange` (optional): `24h`, `7d`, `30d` (default: `24h`)
- `customerId` (optional): Filter by customer (partner admins only see their customers)

**Response**:
```json
{
  "active_users": 450,
  "api_calls_total": 125430,
  "most_used_tool": "snow_query_table",
  "avg_daily_active": 312,
  "daily_active_users": [
    { "date": "2025-10-28", "users": 450 },
    { "date": "2025-10-27", "users": 435 },
    // ... more days
  ],
  "top_tools_by_calls": [
    { "tool": "snow_query_table", "calls": 45200, "percent": 36.0 },
    { "tool": "snow_update", "calls": 32100, "percent": 25.6 },
    // ... top 10
  ],
  "top_tools_by_users": [
    { "tool": "snow_query_table", "users": 380 },
    { "tool": "snow_create", "users": 320 },
    // ... top 10
  ],
  "customer_breakdown": [
    {
      "customer_id": "cust123",
      "customer_name": "Acme Corp",
      "api_calls": 52340,
      "active_users": 25,
      "top_tool": "snow_query"
    }
    // ... more customers (partner admins only see their own)
  ]
}
```

---

## 9. UI/UX DESIGN GUIDELINES

### 9.1 Design Principles

1. **Clarity**: Metrics should be immediately understandable
2. **Hierarchy**: Most important metrics (uptime, alerts) at top
3. **Consistency**: Use same color scheme, typography across all dashboards
4. **Responsiveness**: Full functionality on mobile (not just read-only)
5. **Performance**: Load critical metrics first, lazy-load charts

---

### 9.2 Responsive Breakpoints

- **Desktop**: > 1200px (full 12-column grid)
- **Tablet**: 768px - 1199px (6-8 column grid, stacked charts)
- **Mobile**: < 768px (single column, cards stack vertically)

---

### 9.3 Typography

**Headings**:
- H1: 2rem (32px) - Page title
- H2: 1.5rem (24px) - Section title
- H3: 1.25rem (20px) - Card title
- H4: 1rem (16px) - Subsection

**Body**:
- Body text: 0.875rem (14px)
- Small text: 0.75rem (12px)
- Large numbers: 2rem (32px) - Metric values

**Font Family**:
- Sans-serif: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto

---

### 9.4 Accessibility

- ✅ WCAG 2.1 AA compliance
- ✅ Keyboard navigation support
- ✅ Screen reader friendly (ARIA labels)
- ✅ Color contrast ratio > 4.5:1
- ✅ Focus indicators on interactive elements
- ✅ Alternative text for charts (data tables)

---

## 10. DEPLOYMENT & TESTING

### 10.1 Deployment Steps

1. **Build Frontend**:
   ```bash
   cd portal-frontend
   npm run build
   ```

2. **Deploy to Cloud Run**:
   ```bash
   gcloud run deploy snow-flow-enterprise-portal \
     --source . \
     --region europe-west4 \
     --platform managed \
     --allow-unauthenticated \
     --port 3000 \
     --memory 1Gi \
     --cpu 1 \
     --min-instances 1 \
     --max-instances 10
   ```

3. **Configure Custom Domain**:
   - Map `portal.snow-flow.dev` to Cloud Run service
   - Configure SSL certificate (automatic with Cloud Run)

4. **Set Environment Variables**:
   ```bash
   gcloud run services update snow-flow-enterprise-portal \
     --set-env-vars="NODE_ENV=production,DATABASE_URL=postgresql://...,REDIS_URL=redis://...,GCP_PROJECT_ID=snow-flow-ai"
   ```

---

### 10.2 Testing Checklist

**Functional Testing**:
- [ ] All dashboards load correctly
- [ ] Metrics update in real-time (WebSocket)
- [ ] Charts render with correct data
- [ ] Alert actions work (acknowledge, resolve)
- [ ] Filters and date range selectors work
- [ ] Export CSV/PDF functionality works
- [ ] Role-based access control works (partner admins see only their data)

**Performance Testing**:
- [ ] Page load time < 2 seconds (initial)
- [ ] Time to interactive < 3 seconds
- [ ] Chart rendering < 500ms
- [ ] API response time < 200ms (cached), < 1s (uncached)
- [ ] No memory leaks (run for 24 hours)

**Security Testing**:
- [ ] Authentication required for all endpoints
- [ ] RBAC enforced (partner admins cannot see other partners' data)
- [ ] SQL injection protection
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Rate limiting on API endpoints

**Browser Compatibility**:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS 14+)
- [ ] Mobile Chrome (Android 10+)

---

### 10.3 Monitoring the Monitoring Dashboard

**Ironic but necessary!**

- Set up Google Cloud Monitoring for the portal itself
- Alert if portal is down or slow
- Monitor API endpoint performance
- Track dashboard usage (which metrics are viewed most)
- Monitor WebSocket connection stability

---

## 11. FUTURE ENHANCEMENTS

### Phase 2 (Q1 2026)

- [ ] **Anomaly Detection**: ML-based detection of unusual patterns
- [ ] **Predictive Alerts**: Predict when metrics will cross thresholds
- [ ] **Custom Dashboards**: Allow users to create custom dashboard layouts
- [ ] **Advanced Filtering**: Save filter presets, share with team
- [ ] **Incident Timeline**: Visual timeline of alerts and resolution actions
- [ ] **SLA Reporting**: Detailed SLA compliance reports with downtime analysis

### Phase 3 (Q2 2026)

- [ ] **Mobile App**: Native iOS/Android app for on-call engineers
- [ ] **Slack Integration**: Bi-directional Slack integration (acknowledge alerts from Slack)
- [ ] **PagerDuty Integration**: Automatic escalation for CRITICAL alerts
- [ ] **Audit Log**: Full audit trail of all dashboard actions
- [ ] **API Playground**: Test API endpoints directly from dashboard
- [ ] **Webhook Support**: Send alerts to custom webhooks

---

## DOCUMENT CONTROL

**Version**: 1.0
**Date**: October 28, 2025
**Author**: Snow-Flow Enterprise Infrastructure Team
**Review Cycle**: Quarterly
**Next Review**: January 28, 2026

**Changelog**:
- v1.0 (Oct 28, 2025): Initial specification

---

**For questions about this specification:**
- **Engineering**: engineering@snow-flow.dev
- **Product**: product@snow-flow.dev
- **DevOps**: devops@snow-flow.dev
