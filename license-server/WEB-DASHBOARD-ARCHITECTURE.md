# Snow-Flow Enterprise Web Dashboard - Architecture

**Version:** 1.0.0
**Date:** October 22, 2025
**Status:** 🔨 In Development

---

## Overview

Professional web dashboard voor Snow-Flow Enterprise License Server met twee portals:

1. **Admin Portal** - Voor Snow-Flow admins: klanten beheren, analytics, monitoring
2. **Customer Portal** - Voor enterprise klanten: credentials beheren, usage stats

---

## Technology Stack

### Frontend

**Core:**
- **React 18** - Modern, component-based UI
- **TypeScript** - Type safety, better DX
- **Vite** - Fast development, optimized builds
- **React Router 6** - Client-side routing

**Styling:**
- **Tailwind CSS 3** - Utility-first CSS, easy theming
- **Headless UI** - Accessible components
- **Heroicons** - Beautiful icons

**State & Data:**
- **React Context** - Global state (auth, theme)
- **React Query** - Server state, caching, automatic refetch
- **Axios** - HTTP client with interceptors

**Forms & Validation:**
- **React Hook Form** - Performant forms
- **Zod** - Schema validation

**Charts & Viz:**
- **Recharts** - Beautiful charts for analytics
- **Date-fns** - Date formatting

### Backend Integration

**Existing API Endpoints:**
```
/api/admin/*          - Admin API (klanten, SIs, stats)
/mcp/*                - MCP tools execution
/sso/*                - SSO/SAML
/api/credentials/*    - Credentials management
/api/themes/*         - Themes API
/monitoring/*         - Health & metrics
```

**New Endpoints (to add):**
```
/web/admin/login      - Admin login
/web/customer/login   - Customer login
/                     - Serve frontend (SPA)
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│                                                              │
│  ┌──────────────┐              ┌──────────────┐            │
│  │ Admin Portal │              │Customer Portal│            │
│  │              │              │               │            │
│  │ - Customers  │              │ - Credentials │            │
│  │ - SIs        │              │ - Profile     │            │
│  │ - Monitoring │              │ - Usage       │            │
│  │ - Themes     │              │ - Settings    │            │
│  └──────────────┘              └──────────────┘            │
│         │                               │                    │
│         └───────────────┬───────────────┘                    │
│                         │                                    │
└─────────────────────────┼────────────────────────────────────┘
                          │ HTTPS
                          │
┌─────────────────────────┼────────────────────────────────────┐
│  Cloud Run              ▼                                    │
│                                                              │
│  ┌────────────────────────────────────────┐                │
│  │  Express Server                        │                │
│  │                                        │                │
│  │  ┌──────────────────────────────────┐ │                │
│  │  │  Static File Serving             │ │                │
│  │  │  (Vite build output)             │ │                │
│  │  └──────────────────────────────────┘ │                │
│  │                                        │                │
│  │  ┌──────────────────────────────────┐ │                │
│  │  │  API Routes                      │ │                │
│  │  │  - /api/admin/*                  │ │                │
│  │  │  - /api/credentials/*            │ │                │
│  │  │  - /api/themes/*                 │ │                │
│  │  │  - /mcp/*                        │ │                │
│  │  └──────────────────────────────────┘ │                │
│  │                                        │                │
│  │  ┌──────────────────────────────────┐ │                │
│  │  │  Authentication Middleware       │ │                │
│  │  │  - Admin: ADMIN_KEY + session    │ │                │
│  │  │  - Customer: License key + JWT   │ │                │
│  │  └──────────────────────────────────┘ │                │
│  └────────────────────────────────────────┘                │
│         │                                                    │
│         ▼                                                    │
│  ┌────────────────────────────────────────┐                │
│  │  SQLite Database                       │                │
│  │  - Customers                           │                │
│  │  - Credentials (encrypted)             │                │
│  │  - MCP usage logs                      │                │
│  │  - Sessions                            │                │
│  └────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

---

## Features Breakdown

### Admin Portal

#### 1. Authentication
- **Login:** ADMIN_KEY + optional 2FA
- **Session:** HTTP-only cookies, 8 hour expiry
- **Security:** CSRF tokens, rate limiting

#### 2. Dashboard (Home)
**Widgets:**
- Total customers (active/suspended/churned)
- Total API calls (today/week/month)
- Active instances count
- Revenue metrics (future)
- Recent activity feed
- Quick actions (create customer, view logs)

**Charts:**
- API calls over time (line chart)
- Customers by status (pie chart)
- Tool usage distribution (bar chart)

#### 3. Customer Management
**List View (Table):**
| Name | Company | License Key | Theme | Status | API Calls | Actions |
|------|---------|-------------|-------|--------|-----------|---------|
| Acme | Acme Co | SNOW-ENT... | capgemini | active | 1,234 | Edit/View/Delete |

**Features:**
- Search (by name, email, license key)
- Filter (by status, theme, SI)
- Sort (by name, created date, API calls)
- Pagination (50 per page)
- Bulk actions (suspend, delete)

**Create Customer (Modal/Form):**
```
┌──────────────────────────────────────┐
│ Create New Customer                  │
├──────────────────────────────────────┤
│ Service Integrator: [Dropdown     ▼] │
│ Company Name:      [____________]     │
│ Contact Name:      [____________]     │
│ Contact Email:     [____________]     │
│ Theme:             [Dropdown     ▼]  │
│                    [Preview theme]    │
│ Status:            ● Active           │
│                    ○ Suspended        │
│                                       │
│ [Cancel]              [Create Customer]│
└──────────────────────────────────────┘
```

**Customer Detail View:**
- Overview tab: Info, license key, theme preview
- Instances tab: Active instances, last seen, version
- Credentials tab: Configured credentials (masked)
- Usage tab: API calls chart, tool breakdown
- Logs tab: Recent activity, errors
- Settings tab: Edit info, assign theme, suspend

#### 4. Service Integrator Management
**List View:**
- All SIs with customer count
- Create new SI
- Edit SI (white label, custom domain, logo)
- View SI customers

#### 5. Monitoring & Analytics
**System Health:**
- Database status
- MCP servers status
- Memory/CPU usage (from Cloud Run metrics)
- Recent errors

**Analytics:**
- API usage trends
- Most used tools
- Customer activity heatmap
- Performance metrics (avg response time)

**Logs:**
- Real-time log viewer
- Filter by level, customer, endpoint
- Search functionality

#### 6. Themes Management
**List Themes:**
- All available themes with preview
- Upload new theme (JSON)
- Edit theme
- Delete theme (if not in use)

**Theme Assignment:**
- Bulk assign theme to multiple customers
- Preview before assignment

### Customer Portal

#### 1. Authentication
- **Login:** License key
- **Session:** JWT token, 8 hour expiry
- **Security:** CSRF protection, rate limiting

#### 2. Dashboard (Home)
**Welcome:**
```
┌────────────────────────────────────────┐
│ Welcome back, Acme Corporation! 👋     │
│ Your theme: Capgemini                  │
└────────────────────────────────────────┘
```

**Quick Stats:**
- API calls this month
- Active instances
- Credentials configured
- Last login

**Recent Activity:**
- Last 10 API calls
- Recent credential updates

#### 3. Credentials Management
**List View:**
| Service | Username/Email | Status | Last Used | Actions |
|---------|---------------|--------|-----------|---------|
| Jira | admin@acme.com | ✅ Connected | 2h ago | Edit/Test/Delete |
| Azure DevOps | admin@acme.com | ⚠️ Expired | 1d ago | Reconnect |
| Confluence | - | ➖ Not configured | - | Add |

**Add Credentials (Modal):**
```
┌──────────────────────────────────────┐
│ Add Jira Credentials                 │
├──────────────────────────────────────┤
│ Service:    [Jira            ▼]      │
│                                       │
│ Authentication Method:                │
│ ● OAuth 2.0 (Recommended)            │
│ ○ API Token                          │
│ ○ Personal Access Token              │
│                                       │
│ [Option A: OAuth]                    │
│ Jira URL:  [https://acme.atlassian.net] │
│            [Connect with Jira ➜]     │
│                                       │
│ [Option B: API Token]                │
│ Email:     [admin@acme.com]          │
│ API Token: [••••••••••••••]          │
│ Jira URL:  [https://...]             │
│                                       │
│ [Cancel]           [Test & Save]     │
└──────────────────────────────────────┘
```

**Features:**
- OAuth flow integration (Jira, Azure DevOps)
- Credential testing (before save)
- Secure storage (encrypted in DB)
- Automatic token refresh
- Expiry warnings

#### 4. Profile & Settings
**Profile:**
- Company name
- Contact email
- License key (masked, copy button)
- License tier
- Expiry date
- Theme (with preview)

**Usage & Billing:**
- API calls chart (last 30 days)
- Tool usage breakdown
- Instance list
- Monthly limits (if applicable)

**Settings:**
- Change contact email
- Notification preferences
- API rate limits info

---

## Authentication & Authorization

### Admin Auth Flow

```
1. User visits /admin
2. Redirect to /admin/login
3. Enter ADMIN_KEY
4. POST /web/admin/login
5. Verify ADMIN_KEY (env variable)
6. Create session (HTTP-only cookie)
7. Redirect to /admin/dashboard
8. All /admin/* routes check session
```

**Session Structure:**
```typescript
interface AdminSession {
  id: string;
  role: 'admin';
  createdAt: number;
  expiresAt: number;
  ipAddress: string;
}
```

### Customer Auth Flow

```
1. User visits /portal
2. Redirect to /portal/login
3. Enter license key
4. POST /web/customer/login
5. Validate license key (DB lookup)
6. Check customer status (must be active)
7. Generate JWT token
8. Return token + customer info
9. Store token in localStorage
10. All /portal/* routes require valid JWT
```

**JWT Payload:**
```typescript
interface CustomerJWT {
  customerId: number;
  licenseKey: string;
  companyName: string;
  theme: string;
  tier: string;
  exp: number;
}
```

---

## API Integration

### API Client (frontend/src/api/client.ts)

```typescript
class ApiClient {
  private baseURL: string;
  private token?: string;

  // Admin requests
  async adminLogin(adminKey: string): Promise<AdminSession>;
  async getCustomers(filters?: CustomerFilters): Promise<Customer[]>;
  async createCustomer(data: CreateCustomerDto): Promise<Customer>;
  async updateCustomer(id: number, data: UpdateCustomerDto): Promise<Customer>;
  async deleteCustomer(id: number): Promise<void>;
  async getCustomerUsage(id: number, days: number): Promise<UsageStats>;

  // Customer requests
  async customerLogin(licenseKey: string): Promise<CustomerSession>;
  async getCredentials(): Promise<Credential[]>;
  async addCredential(data: AddCredentialDto): Promise<Credential>;
  async testCredential(id: number): Promise<TestResult>;
  async deleteCredential(id: number): Promise<void>;
  async getProfile(): Promise<CustomerProfile>;
  async getUsageStats(days: number): Promise<UsageStats>;
}
```

---

## Security Considerations

### Authentication
- ✅ Admin: ADMIN_KEY + secure sessions (HTTP-only cookies)
- ✅ Customer: License key → JWT with expiry
- ✅ Session expiry: 8 hours
- ✅ Automatic logout on inactivity

### Authorization
- ✅ Route guards: Check auth before rendering
- ✅ API middleware: Verify session/token on every request
- ✅ Role-based: Admin vs Customer routes separated

### Data Protection
- ✅ Credentials encrypted in DB (AES-256-GCM)
- ✅ Passwords/tokens masked in UI
- ✅ HTTPS only (enforced by Cloud Run)
- ✅ CSRF tokens on forms

### Input Validation
- ✅ Client-side: Zod schemas
- ✅ Server-side: Existing validation middleware
- ✅ SQL injection: Prepared statements (already implemented)

### Rate Limiting
- ✅ Login endpoints: 10 attempts per 15 min
- ✅ API endpoints: Per-customer limits (already implemented)

---

## File Structure

```
enterprise/license-server/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Customers.tsx
│   │   │   │   ├── CustomerDetail.tsx
│   │   │   │   ├── ServiceIntegrators.tsx
│   │   │   │   ├── Monitoring.tsx
│   │   │   │   ├── Themes.tsx
│   │   │   │   └── Login.tsx
│   │   │   ├── customer/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Credentials.tsx
│   │   │   │   ├── Profile.tsx
│   │   │   │   ├── Usage.tsx
│   │   │   │   └── Login.tsx
│   │   │   └── Home.tsx (landing page)
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AdminLayout.tsx
│   │   │   │   ├── CustomerLayout.tsx
│   │   │   │   ├── Navbar.tsx
│   │   │   │   └── Sidebar.tsx
│   │   │   ├── common/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Table.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   └── Badge.tsx
│   │   │   ├── customers/
│   │   │   │   ├── CustomerTable.tsx
│   │   │   │   ├── CustomerForm.tsx
│   │   │   │   └── CustomerStats.tsx
│   │   │   ├── credentials/
│   │   │   │   ├── CredentialList.tsx
│   │   │   │   ├── CredentialForm.tsx
│   │   │   │   └── OAuthCallback.tsx
│   │   │   └── charts/
│   │   │       ├── UsageChart.tsx
│   │   │       ├── StatusPieChart.tsx
│   │   │       └── ActivityHeatmap.tsx
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx
│   │   │   ├── ThemeContext.tsx
│   │   │   └── NotificationContext.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useCustomers.ts
│   │   │   ├── useCredentials.ts
│   │   │   └── useTheme.ts
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── admin.ts
│   │   │   ├── customer.ts
│   │   │   └── types.ts
│   │   ├── utils/
│   │   │   ├── formatters.ts
│   │   │   ├── validators.ts
│   │   │   └── constants.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── vite-env.d.ts
│   ├── public/
│   │   ├── favicon.ico
│   │   └── logo.png
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── .env.example
├── src/
│   └── routes/
│       └── web.ts (NEW - serve frontend + auth endpoints)
└── dist/ (generated by Vite build)
```

---

## Build & Deployment

### Development

```bash
# Install dependencies
cd frontend
npm install

# Start dev server (with API proxy)
npm run dev

# Backend runs on :3000
# Frontend dev server on :5173
# Vite proxies /api/* to :3000
```

### Production Build

```bash
# Build frontend
cd frontend
npm run build
# Output: frontend/dist/

# Backend serves static files from dist/
# All routes served by React Router (SPA)
```

### Docker Integration

```dockerfile
# Multi-stage build
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=backend-builder /app/dist ./dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY package*.json ./
RUN npm ci --only=production
CMD ["node", "dist/index.js"]
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- ✅ Project setup (Vite, React, TypeScript, Tailwind)
- ✅ Authentication system (admin & customer)
- ✅ Layout components (AdminLayout, CustomerLayout)
- ✅ API client implementation
- ✅ Protected routes

### Phase 2: Admin Portal (Week 2)
- ✅ Admin dashboard (stats, charts)
- ✅ Customer management (CRUD)
- ✅ Service integrator management
- ✅ Theme management

### Phase 3: Customer Portal (Week 3)
- ✅ Customer dashboard
- ✅ Credentials management (with OAuth)
- ✅ Profile & settings
- ✅ Usage statistics

### Phase 4: Polish & Deploy (Week 4)
- ✅ Security audit
- ✅ Performance optimization
- ✅ Testing (E2E, unit)
- ✅ Documentation
- ✅ Deploy to production

---

## Success Metrics

**Admin Experience:**
- Can create customer in < 30 seconds
- Can view customer usage in 1 click
- Can assign themes instantly
- All critical info visible at a glance

**Customer Experience:**
- Can add Jira credentials in < 1 minute
- OAuth flow works smoothly
- Credentials tested before saving
- Usage stats are clear and helpful

**Technical:**
- Page load < 2 seconds
- API response < 500ms (p95)
- Zero security vulnerabilities
- 99.9% uptime

---

## Next Steps

1. ✅ Architecture designed
2. ⏳ Setup Vite + React project
3. ⏳ Build authentication system
4. ⏳ Create admin portal
5. ⏳ Create customer portal
6. ⏳ Security review & testing
7. ⏳ Deploy to production

---

**Status:** 🔨 Architecture Complete - Ready to Build
**Timeline:** 4 weeks (can accelerate if needed)
**Priority:** High - Essential for enterprise customers
