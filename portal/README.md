# Snow-Flow Enterprise Portal

## Overview

The **Snow-Flow Enterprise Portal** is the central management hub for enterprise customers. It provides a web-based UI and REST APIs for:

- **Authentication**: License key validation and JWT issuance
- **Integration Management**: Configure Jira, Azure DevOps, and Confluence credentials
- **Theme Customization**: Custom branding for SnowCode IDE
- **SSO Configuration**: SAML-based single sign-on for enterprise customers
- **Monitoring**: Usage analytics, audit logs, and billing metrics
- **Admin Panel**: Customer management, license provisioning, and support tools

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Portal Service                          │
│                  (portal.snow-flow.dev)                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐         ┌───────────────────┐        │
│  │  React Frontend │ ◄─────► │  Express Backend  │        │
│  │   (Vite Build)  │         │   (REST APIs)     │        │
│  └─────────────────┘         └───────────────────┘        │
│                                      │                      │
│                                      ▼                      │
│                              ┌───────────────┐             │
│                              │   PostgreSQL  │             │
│                              │  (Cloud SQL)  │             │
│                              └───────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + TypeScript + Node.js 20
- **Database**: PostgreSQL (Cloud SQL) or MySQL
- **Authentication**: JWT + Passport.js + SAML
- **Deployment**: Cloud Run (Docker)

## Directory Structure

```
portal/
├── backend/                  # Express.js backend
│   ├── src/
│   │   ├── index.ts         # Main entry point
│   │   ├── routes/          # API routes
│   │   │   ├── auth.ts      # /api/auth - Login, logout, validate
│   │   │   ├── admin.ts     # /api/admin - Customer management
│   │   │   ├── credentials.ts # /api/credentials - Integration configs
│   │   │   ├── themes.ts    # /api/themes - Theme management
│   │   │   ├── sso.ts       # /api/sso - SAML configuration
│   │   │   └── monitoring.ts # /api/monitoring - Analytics
│   │   ├── middleware/      # Auth, validation, error handling
│   │   ├── database/        # Database clients and schemas
│   │   └── types/           # TypeScript types
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                # React frontend
│   ├── src/
│   │   ├── App.tsx          # Main app component
│   │   ├── pages/           # Page components
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Integrations.tsx
│   │   │   ├── Themes.tsx
│   │   │   └── Admin.tsx
│   │   ├── components/      # Reusable components
│   │   ├── api/             # API client
│   │   └── types/           # TypeScript types
│   ├── package.json
│   └── vite.config.ts
│
├── Dockerfile               # Multi-stage build
├── cloudbuild.yaml          # Cloud Run deployment
└── README.md                # This file
```

## API Reference

### Authentication Endpoints

#### POST /api/auth/login
Login with license key and get JWT token.

**Request:**
```json
{
  "licenseKey": "SF-ENT-XXXX-XXXX-XXXX"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "30d",
  "customer": {
    "id": "cust_123",
    "name": "Acme Corp",
    "tier": "enterprise",
    "features": ["jira", "azure-devops", "confluence", "sso"]
  }
}
```

#### POST /api/auth/validate
Validate JWT token and return customer info.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "valid": true,
  "customer": { ... },
  "expiresAt": "2025-11-27T12:00:00Z"
}
```

#### POST /api/auth/logout
Invalidate JWT token (blacklist).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

### Integration Endpoints

#### GET /api/credentials
Get all configured integrations for current customer.

**Response:**
```json
{
  "integrations": [
    {
      "id": "int_123",
      "type": "jira",
      "name": "Jira Production",
      "configured": true,
      "lastTested": "2025-10-27T10:00:00Z"
    }
  ]
}
```

#### POST /api/credentials/jira
Configure Jira integration credentials.

**Request:**
```json
{
  "name": "Jira Production",
  "host": "acme.atlassian.net",
  "email": "api@acme.com",
  "apiToken": "ATATT3xFfGF0...",
  "defaultProject": "PROJ"
}
```

**Response:**
```json
{
  "id": "int_123",
  "message": "Jira integration configured successfully",
  "testConnection": "passed"
}
```

#### POST /api/credentials/azure
Configure Azure DevOps integration.

**Request:**
```json
{
  "name": "Azure DevOps Main",
  "organization": "acme-corp",
  "personalAccessToken": "xxxxxxxxxxxxx",
  "defaultProject": "MainProject"
}
```

#### POST /api/credentials/confluence
Configure Confluence integration.

**Request:**
```json
{
  "name": "Confluence Docs",
  "host": "acme.atlassian.net",
  "email": "api@acme.com",
  "apiToken": "ATATT3xFfGF0...",
  "defaultSpace": "DOCS"
}
```

### Theme Endpoints

#### GET /api/themes
Get all custom themes for current customer.

**Response:**
```json
{
  "themes": [
    {
      "id": "theme_123",
      "name": "Acme Dark",
      "colors": {
        "primary": "#3B82F6",
        "secondary": "#10B981"
      },
      "logo": "https://storage.googleapis.com/..."
    }
  ]
}
```

#### POST /api/themes
Create custom theme.

**Request (multipart/form-data):**
```
name: "Acme Dark"
colors: {"primary": "#3B82F6"}
logo: [file upload]
```

### SSO Endpoints

#### GET /api/sso/config
Get SAML SSO configuration.

#### POST /api/sso/config
Configure SAML SSO.

**Request:**
```json
{
  "entityId": "https://acme.com/saml",
  "ssoUrl": "https://idp.acme.com/sso",
  "certificate": "-----BEGIN CERTIFICATE-----..."
}
```

### Monitoring Endpoints

#### GET /api/monitoring/usage
Get usage statistics for current customer.

**Query Parameters:**
- `startDate`: ISO date string
- `endDate`: ISO date string
- `groupBy`: day | week | month

**Response:**
```json
{
  "toolCalls": 1250,
  "uniqueUsers": 15,
  "byTool": {
    "jira_sync_backlog_advanced": 450,
    "azure_sync_work_items": 320
  }
}
```

#### GET /api/monitoring/audit-logs
Get audit logs.

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2025-10-27T10:00:00Z",
      "userId": "user_123",
      "action": "credentials.updated",
      "resource": "jira",
      "ip": "192.168.1.1"
    }
  ]
}
```

### Admin Endpoints (Admin users only)

#### GET /api/admin/customers
List all customers.

#### POST /api/admin/customers
Create new customer and license.

#### PATCH /api/admin/customers/:id
Update customer (tier, features, limits).

#### DELETE /api/admin/customers/:id
Deactivate customer.

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL or MySQL
- Docker (optional)

### Setup

1. **Clone repository:**
```bash
cd /Users/nielsvanderwerf/snow-flow-enterprise/portal
```

2. **Install backend dependencies:**
```bash
cd backend
npm install
```

3. **Install frontend dependencies:**
```bash
cd ../frontend
npm install
```

4. **Configure environment:**
```bash
# Create .env in backend/
cat > backend/.env << EOF
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=snow_flow_dev
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=dev-secret-change-in-production
SESSION_SECRET=dev-session-secret
NODE_ENV=development
PORT=8080
EOF

# Create .env in frontend/
cat > frontend/.env << EOF
VITE_API_URL=http://localhost:8080/api
EOF
```

5. **Run database migrations:**
```bash
cd backend
npm run migrate
```

### Running Locally

**Backend:**
```bash
cd backend
npm run dev  # Runs on http://localhost:8080
```

**Frontend (separate terminal):**
```bash
cd frontend
npm run dev  # Runs on http://localhost:5173
```

**Visit**: http://localhost:5173

### Building for Production

**Backend:**
```bash
cd backend
npm run build  # Output: dist/
```

**Frontend:**
```bash
cd frontend
npm run build  # Output: dist/
```

**Docker:**
```bash
cd portal
docker build -t snow-flow-portal .
docker run -p 8080:8080 --env-file backend/.env snow-flow-portal
```

## Testing

**Backend tests:**
```bash
cd backend
npm test
```

**Frontend tests:**
```bash
cd frontend
npm test
```

**E2E tests:**
```bash
npm run test:e2e
```

## Deployment

See [SPLIT-SERVICES-DEPLOYMENT.md](../SPLIT-SERVICES-DEPLOYMENT.md) for full deployment instructions.

**Quick deploy:**
```bash
gcloud builds submit --config=portal/cloudbuild.yaml
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_TYPE` | Yes | Database type (postgres or mysql) |
| `DB_HOST` | Yes | Database host (Cloud SQL connection name) |
| `DB_PORT` | Yes | Database port |
| `DB_NAME` | Yes | Database name |
| `DB_USER` | Yes | Database user |
| `DB_PASSWORD` | Yes | Database password |
| `JWT_SECRET` | Yes | JWT signing secret (MUST match MCP server!) |
| `SESSION_SECRET` | Yes | Session cookie secret |
| `SAML_CERT` | No | SAML certificate for SSO |
| `SAML_PRIVATE_KEY` | No | SAML private key for SSO |
| `NODE_ENV` | Yes | Environment (development/production) |
| `PORT` | Yes | Server port (default 8080) |

## Security

- **JWT Authentication**: All API endpoints require valid JWT (except /api/auth/login)
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Configured for portal.snow-flow.dev and localhost
- **Encryption**: All credentials encrypted at rest with AES-256
- **HTTPS**: Enforced in production
- **CSP**: Content Security Policy headers enabled
- **SAML SSO**: Enterprise customers can use SSO

## Monitoring

**Health check:**
```bash
curl https://portal.snow-flow.dev/health
```

**Metrics (Cloud Monitoring):**
- Request latency
- Error rates
- Active users
- Database connections
- Memory usage

## Support

- **Issues**: Report at https://github.com/snow-flow/snow-flow-enterprise/issues
- **Docs**: https://docs.snow-flow.dev
- **Email**: support@snow-flow.dev

---

**Version**: 2.0.0
**Last Updated**: 2025-10-27
