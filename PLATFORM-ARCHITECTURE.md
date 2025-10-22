# Snow-Flow Enterprise Platform - Complete Architecture

## 🎯 Overview

Complete SaaS platform for Snow-Flow Enterprise license management with:
- Remote MCP server (code stays private!)
- Admin UI for license generation
- Real-time usage dashboard
- Customer management
- Analytics & reporting

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Web UI (React)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   License    │  │   Customer   │  │    Analytics    │  │
│  │  Management  │  │  Management  │  │    Dashboard    │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
│         Vite + React + Tailwind CSS + Recharts             │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTPS
┌─────────────────────────────────────────────────────────────┐
│              License Server (Express + SQLite)              │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  Admin API   │  │  License API │  │   MCP Server    │  │
│  │ /api/admin/* │  │ /api/validate│  │   /mcp/tools/*  │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
│                    Deployed to Cloud Run                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     SQLite Database                         │
│  • licenses         (license keys & config)                 │
│  • license_instances (active installations)                 │
│  • customers        (customer details)                      │
│  • mcp_usage        (tool usage logs)                       │
│  • api_logs         (request logs)                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Client Installation                      │
│  snow-flow CLI → OpenCode → Remote MCP Server              │
│  (No enterprise code locally - just license key!)          │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Features

### 1. License Management UI

**Generate License Keys:**
- Select tier (Team, Pro, Enterprise)
- Choose features (jira, devops, advanced-ml)
- Set expiry date or perpetual
- Set max instances
- Auto-generate secure key: `SNOW-{TIER}-{RANDOM}`

**License Dashboard:**
- List all licenses (filterable by status, tier, customer)
- Quick actions: Revoke, Extend, Edit
- Color coding: 🟢 Active, 🟡 Expiring Soon, 🔴 Expired, ⚫ Revoked

**License Details View:**
- License info (key, tier, features, expiry)
- Active instances (hostname, IP, last seen)
- Usage statistics (API calls, most used tools)
- Activity timeline
- Revoke/Extend actions

### 2. Customer Management

**Customer List:**
- All customers with licenses
- Contact information
- Company details
- Active licenses count
- Total usage metrics

**Customer Details:**
- All licenses for this customer
- Combined usage statistics
- Active instances across all licenses
- Revenue tracking (if pricing integrated)
- Communication history

**Add Customer:**
- Name, email, company
- Auto-generate license on creation
- Send welcome email with license key

### 3. Analytics Dashboard

**Overview Metrics:**
- Total licenses (active/inactive)
- Total API calls today/week/month
- Active instances right now
- Revenue (if pricing enabled)

**Usage Charts:**
- API calls over time (line chart)
- Most used MCP tools (bar chart)
- Usage by customer (pie chart)
- Geographic distribution (world map)
- Tool category breakdown

**Real-time Monitoring:**
- Active API requests
- Current load (requests/sec)
- Average response time
- Error rate (last hour)
- Active sessions

**Tool Analytics:**
- Top 10 most used tools
- Tool usage trends
- Error rates per tool
- Average execution time per tool

### 4. Admin Settings

**System Configuration:**
- ADMIN_KEY management
- Email settings (for notifications)
- Webhook URLs (for events)
- Rate limiting settings
- Grace period configuration

**API Keys:**
- Generate API keys for integrations
- Revoke API keys
- Usage per API key

**Audit Log:**
- All admin actions
- License changes
- System events
- Failed auth attempts

## 🗄️ Database Schema Updates

### New Tables

```sql
-- Customers table
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  company TEXT,
  phone TEXT,
  address TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'active' -- active, suspended, churned
);

-- MCP usage tracking
CREATE TABLE mcp_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id INTEGER NOT NULL,
  instance_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  duration_ms INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  request_params TEXT, -- JSON
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (license_id) REFERENCES licenses(id)
);

CREATE INDEX idx_mcp_usage_license ON mcp_usage(license_id);
CREATE INDEX idx_mcp_usage_timestamp ON mcp_usage(timestamp);
CREATE INDEX idx_mcp_usage_tool ON mcp_usage(tool_name);

-- API request logs
CREATE TABLE api_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  license_key TEXT,
  error_message TEXT
);

CREATE INDEX idx_api_logs_timestamp ON api_logs(timestamp);
CREATE INDEX idx_api_logs_endpoint ON api_logs(endpoint);

-- Admin users table (for future multi-admin support)
CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- bcrypt hash
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'admin', -- admin, viewer, superadmin
  created_at INTEGER NOT NULL,
  last_login INTEGER,
  active BOOLEAN DEFAULT 1
);

-- System events (audit trail)
CREATE TABLE system_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL, -- license_created, license_revoked, etc.
  admin_user_id INTEGER,
  entity_type TEXT, -- license, customer, etc.
  entity_id INTEGER,
  description TEXT NOT NULL,
  metadata TEXT, -- JSON
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
);

CREATE INDEX idx_system_events_timestamp ON system_events(timestamp);
CREATE INDEX idx_system_events_type ON system_events(event_type);
```

### Updated Tables

```sql
-- Add customer_id to licenses
ALTER TABLE licenses ADD COLUMN customer_id INTEGER REFERENCES customers(id);

-- Add usage tracking fields
ALTER TABLE licenses ADD COLUMN total_api_calls INTEGER DEFAULT 0;
ALTER TABLE licenses ADD COLUMN last_api_call INTEGER;
```

## 🔌 API Endpoints

### Admin API (Protected with ADMIN_KEY)

**License Management:**
```
POST   /api/admin/licenses                 - Create license
GET    /api/admin/licenses                 - List all licenses
GET    /api/admin/licenses/:id             - Get license details
PUT    /api/admin/licenses/:id             - Update license
DELETE /api/admin/licenses/:id             - Revoke license
POST   /api/admin/licenses/:id/extend      - Extend expiry
GET    /api/admin/licenses/:id/instances   - Get active instances
GET    /api/admin/licenses/:id/usage       - Get usage stats
```

**Customer Management:**
```
POST   /api/admin/customers                - Create customer
GET    /api/admin/customers                - List customers
GET    /api/admin/customers/:id            - Get customer details
PUT    /api/admin/customers/:id            - Update customer
DELETE /api/admin/customers/:id            - Delete customer
GET    /api/admin/customers/:id/licenses   - Get customer licenses
GET    /api/admin/customers/:id/usage      - Get customer usage
```

**Analytics:**
```
GET    /api/admin/analytics/overview       - Dashboard metrics
GET    /api/admin/analytics/usage          - Usage over time
GET    /api/admin/analytics/tools          - Tool usage stats
GET    /api/admin/analytics/customers      - Customer metrics
GET    /api/admin/analytics/real-time      - Real-time stats
```

**System:**
```
GET    /api/admin/events                   - Audit log
GET    /api/admin/health                   - System health
POST   /api/admin/settings                 - Update settings
GET    /api/admin/settings                 - Get settings
```

### MCP Endpoints (Protected with License Key)

**MCP Server (HTTP-based):**
```
POST   /mcp/tools/list                     - List available tools
POST   /mcp/tools/call                     - Execute MCP tool
POST   /mcp/tools/jira_sync_backlog        - Sync Jira backlog
POST   /mcp/tools/jira_get_issue           - Get Jira issue
POST   /mcp/tools/jira_create_issue        - Create Jira issue
POST   /mcp/tools/jira_update_issue        - Update Jira issue
POST   /mcp/tools/jira_transition_issue    - Transition Jira issue
POST   /mcp/tools/jira_search_issues       - Search Jira issues
POST   /mcp/tools/jira_get_project         - Get Jira project
POST   /mcp/tools/jira_link_issues         - Link Jira issues
```

**Request Format:**
```json
{
  "tool": "jira_sync_backlog",
  "arguments": {
    "host": "company.atlassian.net",
    "username": "user@company.com",
    "apiToken": "xxx",
    "projectKey": "PROJ"
  }
}
```

**Response Format:**
```json
{
  "success": true,
  "result": { /* tool result */ },
  "usage": {
    "duration_ms": 1234,
    "timestamp": 1234567890
  }
}
```

### Public API (No Auth)

```
GET    /health                             - Health check
POST   /api/validate                       - License validation
```

## 🎨 Frontend UI Structure

### Technology Stack

```json
{
  "framework": "React 18",
  "build": "Vite",
  "styling": "Tailwind CSS",
  "charts": "Recharts",
  "routing": "React Router",
  "state": "Zustand",
  "http": "Axios",
  "forms": "React Hook Form",
  "tables": "TanStack Table",
  "icons": "Lucide React"
}
```

### Pages

**1. Dashboard (`/`)**
- Overview metrics (cards)
- Usage chart (line chart - last 30 days)
- Active licenses (mini table)
- Recent activity (timeline)

**2. Licenses (`/licenses`)**
- License list (table with filters)
- Search and filter controls
- Bulk actions
- New license button → modal

**3. License Detail (`/licenses/:id`)**
- License information (card)
- Active instances (table)
- Usage statistics (charts)
- Activity timeline
- Actions (Revoke, Extend, Edit)

**4. Customers (`/customers`)**
- Customer list (table)
- Add customer button
- Search and filter

**5. Customer Detail (`/customers/:id`)**
- Customer info (card)
- Licenses (table)
- Usage statistics (charts)
- Contact history

**6. Analytics (`/analytics`)**
- Time range selector
- Overview metrics
- Multiple charts:
  - API calls over time
  - Tool usage breakdown
  - Customer usage distribution
  - Geographic map
- Export data button

**7. Tools (`/tools`)**
- Tool list with usage stats
- Tool details (usage, errors, avg time)
- Tool category grouping

**8. Settings (`/settings`)**
- System configuration
- Admin users
- API keys
- Webhooks
- Email settings

**9. Audit Log (`/audit`)**
- Event timeline
- Filter by type, user, date
- Export to CSV

### Components

```
src/
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── Layout.tsx
│   ├── dashboard/
│   │   ├── MetricCard.tsx
│   │   ├── UsageChart.tsx
│   │   └── ActivityTimeline.tsx
│   ├── licenses/
│   │   ├── LicenseTable.tsx
│   │   ├── LicenseCard.tsx
│   │   ├── NewLicenseModal.tsx
│   │   └── InstanceList.tsx
│   ├── customers/
│   │   ├── CustomerTable.tsx
│   │   ├── CustomerCard.tsx
│   │   └── NewCustomerModal.tsx
│   ├── analytics/
│   │   ├── UsageChart.tsx
│   │   ├── ToolBreakdown.tsx
│   │   └── GeographicMap.tsx
│   └── common/
│       ├── Table.tsx
│       ├── Modal.tsx
│       ├── Button.tsx
│       └── Card.tsx
├── pages/
│   ├── Dashboard.tsx
│   ├── Licenses.tsx
│   ├── LicenseDetail.tsx
│   ├── Customers.tsx
│   ├── Analytics.tsx
│   └── Settings.tsx
├── hooks/
│   ├── useLicenses.ts
│   ├── useCustomers.ts
│   └── useAnalytics.ts
├── services/
│   └── api.ts
└── App.tsx
```

## 🚀 Deployment Architecture

### Cloud Run Configuration

**Single Service with Multiple Responsibilities:**

```dockerfile
# Multi-stage build
FROM node:20-alpine AS frontend-builder
WORKDIR /app/admin-ui
COPY admin-ui/package*.json ./
RUN npm ci
COPY admin-ui/ ./
RUN npm run build

FROM node:20-alpine AS backend-builder
WORKDIR /app/license-server
COPY license-server/package*.json ./
RUN npm ci
COPY license-server/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app

# Copy backend
COPY --from=backend-builder /app/license-server/dist ./dist
COPY --from=backend-builder /app/license-server/package*.json ./
RUN npm ci --only=production

# Copy frontend build
COPY --from=frontend-builder /app/admin-ui/dist ./public

# Serve both
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "dist/index.js"]
```

**Express serves both API and UI:**

```typescript
// Server serves UI at root, API at /api, MCP at /mcp
app.use(express.static('public'));
app.use('/api', apiRouter);
app.use('/mcp', mcpRouter);

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/mcp')) {
    res.sendFile(join(__dirname, '../public/index.html'));
  }
});
```

### Environment Variables

```env
# Server
PORT=8080
NODE_ENV=production
LOG_LEVEL=info

# Database
DATABASE_PATH=/app/data/licenses.db

# Admin
ADMIN_KEY=<secret-from-gcp-secret-manager>

# Optional: Email notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@snow-flow.dev
SMTP_PASS=<secret>

# Optional: Webhooks
WEBHOOK_URL=https://your-webhook.com/events
```

## 🔐 Security

### Authentication

**Admin UI:**
- Protected with ADMIN_KEY
- Login page checks key against GCP Secret Manager
- Session stored in localStorage (with expiry)
- All admin API calls include `X-Admin-Key` header

**MCP Endpoints:**
- Protected with license key
- Each request validates license in real-time
- Logs all requests for audit trail

### Rate Limiting

```typescript
// Different limits for different endpoints
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // 1000 requests per 15 min
});

const mcpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // 100 MCP calls per 15 min per license
  keyGenerator: (req) => req.headers['authorization'] // Per license key
});
```

### CORS

```typescript
// Admin UI and MCP can have different CORS policies
app.use('/api/admin', cors({
  origin: process.env.ADMIN_UI_ORIGIN || '*'
}));

app.use('/mcp', cors({
  origin: '*', // MCP clients can be anywhere
  methods: ['POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

## 📈 Usage Tracking

### Middleware

```typescript
// Track every MCP tool call
async function trackMcpUsage(req, res, next) {
  const startTime = Date.now();
  const license = req.license; // Set by auth middleware

  res.on('finish', async () => {
    const duration = Date.now() - startTime;

    await db.prepare(`
      INSERT INTO mcp_usage (
        license_id, instance_id, tool_name, timestamp,
        duration_ms, success, error_message, request_params,
        ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      license.id,
      req.headers['x-instance-id'],
      req.body.tool,
      Date.now(),
      duration,
      res.statusCode < 400,
      res.statusCode >= 400 ? res.errorMessage : null,
      JSON.stringify(req.body.arguments),
      req.ip,
      req.headers['user-agent']
    );

    // Update license total
    db.prepare(`
      UPDATE licenses
      SET total_api_calls = total_api_calls + 1,
          last_api_call = ?
      WHERE id = ?
    `).run(Date.now(), license.id);
  });

  next();
}
```

## 🎯 Customer Experience Flow

### Initial Setup

```bash
# 1. Customer purchases license (via website, email, etc.)
# 2. You create license in Admin UI
# 3. License key sent to customer: SNOW-ENT-ABC123XYZ

# 4. Customer installs Snow-Flow Core
npm install -g snow-flow

# 5. Customer runs auth (with enterprise integration)
snow-flow auth login

# Interactive prompts:
? ServiceNow Instance: https://dev123456.service-now.com
? Username: admin
? Password: ••••••••

? Do you have a Snow-Flow Enterprise license? Yes
? License Key: SNOW-ENT-ABC123XYZ

# Validates against remote server
✓ License validated (Tier: Enterprise)
✓ Features: jira, devops, advanced-ml

? Jira Host (for enterprise features): company.atlassian.net
? Jira Email: user@company.com
? Jira API Token: ••••••••

✓ Configuration saved
✓ OpenCode MCP configured

# 6. Customer uses enterprise features
snow-flow swarm "Sync Jira epic PROJ-123 to ServiceNow"

# Uses remote MCP server - your code stays private!
```

### What Gets Configured

**.env file:**
```env
SNOW_INSTANCE=https://dev123456.service-now.com
SNOW_USERNAME=admin
SNOW_PASSWORD=xxx

# Enterprise
SNOW_LICENSE_KEY=SNOW-ENT-ABC123XYZ
JIRA_HOST=company.atlassian.net
JIRA_EMAIL=user@company.com
JIRA_API_TOKEN=xxx
```

**.opencode/config.json:**
```json
{
  "mcpServers": {
    "servicenow-unified": {
      "command": "node",
      "args": ["dist/cli.js", "mcp", "servicenow-unified"],
      "env": {
        "SNOW_INSTANCE": "https://dev123456.service-now.com",
        "SNOW_USERNAME": "admin",
        "SNOW_PASSWORD": "xxx"
      }
    },
    "snow-flow-enterprise": {
      "url": "https://license-server-prod-xxx.run.app/mcp",
      "headers": {
        "Authorization": "Bearer SNOW-ENT-ABC123XYZ",
        "X-Jira-Host": "company.atlassian.net",
        "X-Jira-Email": "user@company.com",
        "X-Jira-Token": "xxx"
      }
    }
  }
}
```

## 📊 Monitoring & Alerts

### Metrics to Track

**Business Metrics:**
- New licenses created
- Active vs inactive licenses
- Revenue (MRR if pricing integrated)
- Churn rate

**Technical Metrics:**
- API requests per second
- Average response time
- Error rate
- Tool usage distribution
- Database size

**Alerts:**
- High error rate (>5%)
- Slow response times (>2s avg)
- Failed license validations spike
- Database size approaching limit

### Dashboard Integration

Use Recharts for beautiful visualizations:

```tsx
<LineChart data={usageData}>
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
  <Legend />
  <Line type="monotone" dataKey="api_calls" stroke="#8884d8" />
  <Line type="monotone" dataKey="errors" stroke="#ff0000" />
</LineChart>
```

## 🚢 Deployment Steps

1. **Build Admin UI** (`admin-ui/`)
2. **Update License Server** (add MCP + Admin endpoints)
3. **Update Database Schema** (run migrations)
4. **Build Docker Image** (multi-stage)
5. **Deploy to Cloud Run** (test + prod)
6. **Test Admin UI** (create license, view dashboard)
7. **Update Core CLI** (enterprise auth flow)
8. **Test End-to-End** (customer flow)

## 💰 Pricing Tiers (Suggested)

| Tier | Price/Month | Features | Max Instances |
|------|-------------|----------|---------------|
| Team | €29 | Jira integration | 3 |
| Pro | €99 | Jira + DevOps | 10 |
| Enterprise | €299 | All features + Priority support | Unlimited |

## 🎉 Benefits Summary

✅ **Your Code Stays Private** - Never leaves GCP server
✅ **True SaaS Model** - Recurring revenue, no piracy
✅ **Complete Visibility** - See exactly what customers do
✅ **Easy Updates** - Deploy new tools, customers get them instantly
✅ **Usage-Based Pricing** - Can add metering later
✅ **Professional Admin UI** - Manage everything easily
✅ **Analytics Built-In** - Make data-driven decisions
✅ **Scalable** - Cloud Run auto-scales

---

**Next Step:** Implement this complete platform! 🚀
