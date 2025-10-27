# Snow-Flow Enterprise Integration Plan

**Version:** 1.0
**Date:** October 27, 2025
**Status:** 🚧 Planning Phase

---

## 1. Architecture Overview

### 1.1 Three-Tier Architecture

```
┌────────────────────────────────────────────────────────────┐
│ Tier 1: Local Open Source (snow-flow)                     │
│ - Basic MCP servers (235+ tools)                          │
│ - License key detection                                   │
│ - Remote MCP client (connects to enterprise server)      │
└────────────────────┬───────────────────────────────────────┘
                     │
                     │ HTTPS/SSE + JWT Auth
                     ↓
┌────────────────────────────────────────────────────────────┐
│ Tier 2: Remote Enterprise Server (snow-flow-enterprise)   │
│ - Authentication & license validation                     │
│ - Enterprise MCP tools (Jira, Azure DevOps, Confluence)  │
│ - SSE transport for MCP protocol                         │
└────────────────────┬───────────────────────────────────────┘
                     │
                     │ Integrations
                     ↓
┌────────────────────────────────────────────────────────────┐
│ Tier 3: External Services                                 │
│ - Jira Cloud/Server                                       │
│ - Azure DevOps                                            │
│ - Confluence                                              │
│ - ServiceNow instances (customer's)                      │
└────────────────────────────────────────────────────────────┘
```

### 1.2 Authentication Flow

#### Service Integrator Login (e.g., Capgemini)
```javascript
// 1. Service integrator heeft master license key
const licenseKey = "SNOW-ENT-CAPGEMINI-20261231-A3F2E9C1";

// 2. Login naar enterprise server
POST https://enterprise.snow-flow.dev/auth/login
Body: {
  licenseKey: "SNOW-ENT-CAPGEMINI-20261231-A3F2E9C1",
  role: "integrator",
  instanceUrl: "https://capgeminidev.service-now.com" // Optional
}

// 3. Response met JWT token
Response: {
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  tier: "enterprise",
  company: "capgemini",
  features: ["jira", "azure-devops", "confluence", "sso", "audit-logs"],
  expiresAt: "2025-10-28T12:00:00Z",
  allowedInstances: "*" // Integrator can access any instance
}
```

#### Customer Login (Client of Service Integrator)
```javascript
// 1. Customer heeft delegated license van integrator
const licenseKey = "SNOW-ENT-CAPGEMINI-CLIENT123-20251231-B4E1F3D2";

// 2. Login naar enterprise server
POST https://enterprise.snow-flow.dev/auth/login
Body: {
  licenseKey: "SNOW-ENT-CAPGEMINI-CLIENT123-20251231-B4E1F3D2",
  role: "customer",
  instanceUrl: "https://client123.service-now.com" // Required
}

// 3. Response met restricted JWT token
Response: {
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  tier: "enterprise",
  company: "capgemini",
  features: ["jira", "azure-devops", "confluence"], // No SSO/audit for customers
  expiresAt: "2025-10-28T12:00:00Z",
  allowedInstances: ["https://client123.service-now.com"] // Restricted
}
```

---

## 2. Implementation Roadmap

### Phase 1: Enterprise Server Core (Week 1-2)

**Repo:** `snow-flow-enterprise` (private)

```
snow-flow-enterprise/
├── src/
│   ├── auth/
│   │   ├── enterprise-validator.ts      ← License validation
│   │   ├── jwt-manager.ts               ← JWT creation/validation
│   │   ├── role-manager.ts              ← Integrator vs Customer roles
│   │   └── license-db.ts                ← License storage (SQLite/Postgres)
│   ├── server/
│   │   ├── enterprise-mcp-server.ts     ← SSE-based MCP server
│   │   ├── auth-routes.ts               ← /auth/login, /auth/refresh
│   │   └── health-routes.ts             ← /health, /status
│   ├── themes/
│   │   ├── theme-manager.ts
│   │   ├── capgemini.json
│   │   ├── ey.json
│   │   └── ...
│   └── index.ts                         ← Main entry point
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

**Key Files to Create:**

1. **`src/auth/enterprise-validator.ts`**
```typescript
import crypto from 'crypto';

export interface LicenseValidationResult {
  valid: boolean;
  tier: 'community' | 'professional' | 'team' | 'enterprise';
  company?: string;
  companyName?: string;
  features: string[];
  expiresAt?: Date;
  error?: string;
}

export function validateLicenseKey(licenseKey: string): LicenseValidationResult {
  // Format: SNOW-[TIER]-[ORG-ID]-[EXPIRY]-[CHECKSUM]
  const parts = licenseKey.split('-');

  if (parts.length !== 5 || parts[0] !== 'SNOW') {
    return { valid: false, tier: 'community', features: [], error: 'Invalid format' };
  }

  const [_, tier, orgId, expiry, checksum] = parts;

  // Validate checksum
  const expectedChecksum = crypto
    .createHash('md5')
    .update(`${tier}${orgId}${expiry}`)
    .digest('hex')
    .substring(0, 8)
    .toUpperCase();

  if (checksum !== expectedChecksum && process.env.NODE_ENV === 'production') {
    return { valid: false, tier: 'community', features: [], error: 'Invalid checksum' };
  }

  // Validate expiry
  const expiryDate = new Date(
    parseInt(expiry.substring(0, 4)),
    parseInt(expiry.substring(4, 6)) - 1,
    parseInt(expiry.substring(6, 8))
  );

  if (expiryDate < new Date()) {
    return { valid: false, tier: 'community', features: [], error: 'License expired' };
  }

  // Map tier to features
  const tierMap = {
    'PRO': 'professional',
    'TEAM': 'team',
    'ENT': 'enterprise'
  };

  const tierName = tierMap[tier as keyof typeof tierMap] || 'community';

  const featuresByTier = {
    professional: ['jira', 'azure-devops'],
    team: ['jira', 'azure-devops', 'confluence'],
    enterprise: ['jira', 'azure-devops', 'confluence', 'sso', 'audit-logs', 'advanced-ml']
  };

  const companyNames: Record<string, string> = {
    'CAPGEMINI': 'Capgemini',
    'EY': 'EY',
    'DELOITTE': 'Deloitte',
    'PWC': 'PwC',
    'KPMG': 'KPMG'
  };

  return {
    valid: true,
    tier: tierName as any,
    company: orgId.toLowerCase(),
    companyName: companyNames[orgId] || orgId,
    features: featuresByTier[tierName as keyof typeof featuresByTier] || [],
    expiresAt: expiryDate
  };
}

export function generateSampleLicenseKey(tier: 'PRO' | 'TEAM' | 'ENT', orgId: string, daysValid: number): string {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + daysValid);
  const expiryStr = expiry.toISOString().split('T')[0].replace(/-/g, '');

  const checksum = crypto
    .createHash('md5')
    .update(`${tier}${orgId}${expiryStr}`)
    .digest('hex')
    .substring(0, 8)
    .toUpperCase();

  return `SNOW-${tier}-${orgId}-${expiryStr}-${checksum}`;
}
```

2. **`src/auth/jwt-manager.ts`**
```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '24h';

export interface JWTPayload {
  licenseKey: string;
  tier: string;
  company: string;
  features: string[];
  role: 'integrator' | 'customer';
  allowedInstances: string[]; // ['*'] for integrator, specific URLs for customer
  iat?: number;
  exp?: number;
}

export function createJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    console.error('[JWT] Verification failed:', error);
    return null;
  }
}

export function isInstanceAllowed(jwtPayload: JWTPayload, instanceUrl: string): boolean {
  if (jwtPayload.allowedInstances.includes('*')) {
    return true; // Integrator can access any instance
  }
  return jwtPayload.allowedInstances.includes(instanceUrl);
}
```

3. **`src/server/enterprise-mcp-server.ts`**
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import { verifyJWT, JWTPayload } from '../auth/jwt-manager.js';

// Enterprise MCP tools (to be implemented)
import { jiraSyncBacklog } from '../tools/jira/sync-backlog.js';
import { azureSyncWorkItems } from '../tools/azure/sync-work-items.js';
import { confluenceSyncDocs } from '../tools/confluence/sync-docs.js';

export class EnterpriseMCPServer {
  private server: Server;
  private app: express.Application;

  constructor() {
    this.server = new Server({
      name: 'snow-flow-enterprise',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.registerTools();
  }

  private setupMiddleware() {
    this.app.use(express.json());

    // CORS for local development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // SSE endpoint for MCP
    this.app.get('/mcp/sse', async (req, res) => {
      // Extract JWT from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
      }

      const token = authHeader.substring(7);
      const jwtPayload = verifyJWT(token);

      if (!jwtPayload) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      console.log('[Enterprise MCP] Client connected:', {
        company: jwtPayload.company,
        tier: jwtPayload.tier,
        role: jwtPayload.role
      });

      // Create SSE transport
      const transport = new SSEServerTransport('/mcp/messages', res);

      // Store JWT payload in server context for tool authorization
      (this.server as any)._jwtPayload = jwtPayload;

      // Connect server to transport
      await this.server.connect(transport);
    });

    // Message endpoint for SSE
    this.app.post('/mcp/messages', async (req, res) => {
      // Handle incoming MCP messages
      // This is called by the SSE transport
      res.json({ received: true });
    });
  }

  private registerTools() {
    // Register Jira tools
    this.server.setRequestHandler('tools/list', async () => {
      const jwtPayload = (this.server as any)._jwtPayload as JWTPayload;

      // Filter tools based on license features
      const allTools = [
        {
          name: 'jira_sync_backlog',
          description: 'Sync Jira backlog to ServiceNow',
          inputSchema: {
            type: 'object' as const,
            properties: {
              jiraProjectKey: { type: 'string', description: 'Jira project key' },
              targetTable: { type: 'string', description: 'ServiceNow table' }
            },
            required: ['jiraProjectKey', 'targetTable']
          },
          requiredFeature: 'jira'
        },
        {
          name: 'azure_sync_work_items',
          description: 'Sync Azure DevOps work items to ServiceNow',
          inputSchema: {
            type: 'object' as const,
            properties: {
              project: { type: 'string', description: 'Azure DevOps project' },
              targetTable: { type: 'string', description: 'ServiceNow table' }
            },
            required: ['project', 'targetTable']
          },
          requiredFeature: 'azure-devops'
        },
        {
          name: 'confluence_sync_docs',
          description: 'Sync Confluence documentation to ServiceNow knowledge',
          inputSchema: {
            type: 'object' as const,
            properties: {
              spaceKey: { type: 'string', description: 'Confluence space key' },
              knowledgeBase: { type: 'string', description: 'ServiceNow knowledge base' }
            },
            required: ['spaceKey', 'knowledgeBase']
          },
          requiredFeature: 'confluence'
        }
      ];

      // Filter by licensed features
      const availableTools = allTools.filter(tool =>
        jwtPayload.features.includes(tool.requiredFeature)
      );

      return {
        tools: availableTools.map(({ requiredFeature, ...tool }) => tool)
      };
    });

    // Register tool call handlers
    this.server.setRequestHandler('tools/call', async (request: any) => {
      const jwtPayload = (this.server as any)._jwtPayload as JWTPayload;

      // Tool authorization check
      const toolFeatureMap: Record<string, string> = {
        'jira_sync_backlog': 'jira',
        'azure_sync_work_items': 'azure-devops',
        'confluence_sync_docs': 'confluence'
      };

      const requiredFeature = toolFeatureMap[request.params.name];
      if (requiredFeature && !jwtPayload.features.includes(requiredFeature)) {
        throw new Error(`Tool '${request.params.name}' requires feature: ${requiredFeature}`);
      }

      // Execute tool
      switch (request.params.name) {
        case 'jira_sync_backlog':
          return await jiraSyncBacklog(request.params.arguments);
        case 'azure_sync_work_items':
          return await azureSyncWorkItems(request.params.arguments);
        case 'confluence_sync_docs':
          return await confluenceSyncDocs(request.params.arguments);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  public start(port: number = 3000) {
    this.app.listen(port, () => {
      console.log(`[Enterprise MCP] Server listening on http://localhost:${port}`);
      console.log(`[Enterprise MCP] SSE endpoint: http://localhost:${port}/mcp/sse`);
    });
  }
}

// Start server
if (require.main === module) {
  const server = new EnterpriseMCPServer();
  server.start(parseInt(process.env.PORT || '3000'));
}
```

4. **`src/server/auth-routes.ts`**
```typescript
import express from 'express';
import { validateLicenseKey } from '../auth/enterprise-validator.js';
import { createJWT } from '../auth/jwt-manager.js';

export const authRouter = express.Router();

authRouter.post('/login', async (req, res) => {
  const { licenseKey, role, instanceUrl } = req.body;

  if (!licenseKey) {
    return res.status(400).json({ error: 'licenseKey is required' });
  }

  // Validate license key
  const validation = validateLicenseKey(licenseKey);

  if (!validation.valid) {
    return res.status(401).json({
      error: 'Invalid license',
      details: validation.error
    });
  }

  // Determine allowed instances based on role
  let allowedInstances: string[];

  if (role === 'integrator') {
    // Service integrators can access any instance
    allowedInstances = ['*'];
  } else {
    // Customers must specify their instance
    if (!instanceUrl) {
      return res.status(400).json({
        error: 'instanceUrl is required for customer role'
      });
    }
    allowedInstances = [instanceUrl];
  }

  // Create JWT token
  const token = createJWT({
    licenseKey,
    tier: validation.tier,
    company: validation.company!,
    features: validation.features,
    role: role || 'customer',
    allowedInstances
  });

  res.json({
    token,
    tier: validation.tier,
    company: validation.company,
    companyName: validation.companyName,
    features: validation.features,
    expiresAt: validation.expiresAt?.toISOString(),
    allowedInstances
  });
});

authRouter.post('/refresh', async (req, res) => {
  // TODO: Implement token refresh logic
  res.status(501).json({ error: 'Not implemented' });
});
```

---

### Phase 2: Remote MCP Client in snow-flow (Week 2-3)

**Repo:** `snow-flow` (open source)

**Files to Create/Modify:**

1. **`src/mcp/clients/enterprise-remote-client.ts`** (NEW)
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import axios from 'axios';

export interface EnterpriseClientConfig {
  licenseKey: string;
  role: 'integrator' | 'customer';
  instanceUrl?: string; // Required for customers
  enterpriseServerUrl?: string; // Default: https://enterprise.snow-flow.dev
}

export class EnterpriseRemoteClient {
  private client: Client;
  private token: string | null = null;
  private config: EnterpriseClientConfig;

  constructor(config: EnterpriseClientConfig) {
    this.config = {
      ...config,
      enterpriseServerUrl: config.enterpriseServerUrl || 'https://enterprise.snow-flow.dev'
    };

    this.client = new Client({
      name: 'snow-flow-enterprise-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
  }

  async connect(): Promise<void> {
    // Step 1: Authenticate and get JWT token
    const authResponse = await axios.post(
      `${this.config.enterpriseServerUrl}/auth/login`,
      {
        licenseKey: this.config.licenseKey,
        role: this.config.role,
        instanceUrl: this.config.instanceUrl
      }
    );

    this.token = authResponse.data.token;

    console.log('[Enterprise Client] Authenticated:', {
      tier: authResponse.data.tier,
      company: authResponse.data.companyName,
      features: authResponse.data.features
    });

    // Step 2: Connect to SSE endpoint with JWT token
    const transport = new SSEClientTransport(
      new URL(`${this.config.enterpriseServerUrl}/mcp/sse`),
      {
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      }
    );

    await this.client.connect(transport);

    console.log('[Enterprise Client] Connected to remote MCP server');
  }

  async listTools(): Promise<any> {
    return await this.client.listTools();
  }

  async callTool(name: string, args: any): Promise<any> {
    return await this.client.callTool({ name, arguments: args });
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
```

2. **Update `.mcp.json.template`** to include remote server option:
```json
{
  "servers": {
    "servicenow-unified": {
      "command": "node",
      "args": ["{{PROJECT_ROOT}}/dist/mcp/servicenow-mcp-unified/index.js"],
      "description": "Unified ServiceNow MCP Server - ALL 235+ ServiceNow tools"
    },
    "snow-flow-orchestration": {
      "command": "node",
      "args": ["{{PROJECT_ROOT}}/dist/mcp/snow-flow-mcp.js"],
      "description": "Snow-Flow orchestration"
    },
    "snow-flow-enterprise": {
      "type": "sse",
      "url": "https://enterprise.snow-flow.dev/mcp/sse",
      "headers": {
        "Authorization": "Bearer {{ENTERPRISE_JWT_TOKEN}}"
      },
      "description": "Enterprise features (Jira, Azure DevOps, Confluence) - requires license"
    }
  }
}
```

---

### Phase 3: Enterprise Tools Implementation (Week 3-4)

**Repo:** `snow-flow-enterprise` (private)

Create enterprise-specific MCP tools:

```
enterprise/src/tools/
├── jira/
│   ├── sync-backlog.ts
│   ├── create-issue.ts
│   ├── webhook-handler.ts
│   └── index.ts
├── azure/
│   ├── sync-work-items.ts
│   ├── track-pipelines.ts
│   └── index.ts
├── confluence/
│   ├── sync-docs.ts
│   ├── export-specs.ts
│   └── index.ts
└── sso/
    ├── configure-saml.ts
    ├── configure-oauth.ts
    └── index.ts
```

**Example: `tools/jira/sync-backlog.ts`**
```typescript
import axios from 'axios';

export async function jiraSyncBacklog(args: {
  jiraProjectKey: string;
  targetTable: string;
  jiraBaseUrl?: string;
  jiraAuthToken?: string;
}) {
  // 1. Fetch Jira issues
  const jiraResponse = await axios.get(
    `${args.jiraBaseUrl}/rest/api/3/search`,
    {
      params: {
        jql: `project = ${args.jiraProjectKey} AND status != Done`,
        maxResults: 100
      },
      headers: {
        Authorization: `Bearer ${args.jiraAuthToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const issues = jiraResponse.data.issues;

  // 2. Sync to ServiceNow
  // (Use ServiceNow API to create/update records in targetTable)

  return {
    success: true,
    synced: issues.length,
    issues: issues.map((i: any) => ({
      key: i.key,
      summary: i.fields.summary,
      status: i.fields.status.name
    }))
  };
}
```

---

## 3. Testing Strategy

### 3.1 Local Development Testing

```bash
# Terminal 1: Start enterprise server locally
cd snow-flow-enterprise
npm run dev  # Runs on http://localhost:3000

# Terminal 2: Test with curl
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "SNOW-ENT-CAPGEMINI-20261231-A3F2E9C1",
    "role": "integrator"
  }'

# Terminal 3: Test MCP connection
cd snow-flow
node -e "
  const { EnterpriseRemoteClient } = require('./dist/mcp/clients/enterprise-remote-client.js');

  const client = new EnterpriseRemoteClient({
    licenseKey: 'SNOW-ENT-CAPGEMINI-20261231-A3F2E9C1',
    role: 'integrator',
    enterpriseServerUrl: 'http://localhost:3000'
  });

  await client.connect();
  const tools = await client.listTools();
  console.log('Available enterprise tools:', tools);
"
```

### 3.2 Service Integrator Testing

**Setup:**
1. Generate integrator license key
2. Configure local SnowCode to use remote enterprise server
3. Test Jira/Azure DevOps/Confluence integrations

**Test Scenarios:**
- ✅ Integrator can access ANY ServiceNow instance
- ✅ Integrator has access to ALL enterprise features
- ✅ Integrator can create customer licenses
- ✅ Theme is applied correctly (Capgemini blue, etc.)

### 3.3 Customer Testing

**Setup:**
1. Generate customer license key (delegated from integrator)
2. Configure local SnowCode with customer license
3. Test restricted access

**Test Scenarios:**
- ✅ Customer can ONLY access their specific instance
- ✅ Customer has limited feature set (no SSO/audit)
- ✅ Customer cannot access other customer instances
- ✅ License expiry is enforced

---

## 4. Deployment Plan

### 4.1 Enterprise Server Hosting

**Option 1: Heroku/Railway**
- Easy deployment
- Auto-scaling
- $25-50/month

**Option 2: AWS ECS/Fargate**
- Production-grade
- Better control
- ~$50-100/month

**Option 3: Vercel (Serverless)**
- Edge functions
- Auto-scaling
- $20/month (Pro)

**Recommendation:** Start with Railway for MVP, migrate to AWS for production.

### 4.2 Domain Setup

```
enterprise.snow-flow.dev
- /auth/login
- /auth/refresh
- /mcp/sse
- /health
```

### 4.3 Environment Variables

```bash
# snow-flow-enterprise/.env
NODE_ENV=production
PORT=3000
JWT_SECRET=<generate-secure-secret>
DATABASE_URL=<postgres-connection-string>

# Jira integration
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_AUTH_TOKEN=<oauth-token>

# Azure DevOps integration
AZURE_DEVOPS_ORG=<your-org>
AZURE_DEVOPS_PAT=<personal-access-token>

# Confluence integration
CONFLUENCE_BASE_URL=https://yourcompany.atlassian.net/wiki
CONFLUENCE_AUTH_TOKEN=<oauth-token>
```

---

## 5. Next Steps

### Immediate (This Week)
1. ✅ Create `snow-flow-enterprise` private repository
2. ⏳ Implement authentication service
3. ⏳ Implement basic SSE MCP server
4. ⏳ Generate test license keys

### Short-term (Next 2 Weeks)
5. ⏳ Implement Jira integration tools
6. ⏳ Implement Azure DevOps integration tools
7. ⏳ Implement remote MCP client in snow-flow
8. ⏳ Local testing with SnowCode

### Medium-term (Next Month)
9. ⏳ Deploy enterprise server to Railway/AWS
10. ⏳ Implement Confluence integration
11. ⏳ Add SSO/SAML features
12. ⏳ Build customer portal for license management

---

## 6. Revenue Model

### Pricing Tiers

| Tier | Users | Price/Month | Features |
|------|-------|-------------|----------|
| **Professional** | 5 | €499 | Jira + Azure DevOps |
| **Team** | 20 | €999 | + Confluence |
| **Enterprise** | Unlimited | €1,999 | + SSO + Audit + Custom |

### Service Integrator Partnership

- **Capgemini/EY/Deloitte Partnership:**
  - Master license: €5,000/month (unlimited seats)
  - They resell to clients with markup
  - We provide white-label option with their branding

### Customer Acquisition Strategy

1. **Direct Sales:** Target Fortune 500 ServiceNow customers
2. **Partner Channel:** Sell through service integrators (60% of revenue)
3. **Marketplace:** ServiceNow Store listing (future)

---

## 7. Security Considerations

### 7.1 License Key Security
- ✅ License keys stored hashed in database
- ✅ Rate limiting on auth endpoints (10 req/min per IP)
- ✅ JWT tokens expire after 24 hours
- ✅ Refresh tokens for automatic renewal

### 7.2 Data Privacy
- ✅ No customer data stored on enterprise server
- ✅ All ServiceNow operations proxied through customer's instance
- ✅ Audit logs of all API calls
- ✅ GDPR compliance (EU data residency option)

### 7.3 Network Security
- ✅ HTTPS only (TLS 1.3)
- ✅ JWT signature validation
- ✅ IP whitelist option for enterprise tier
- ✅ DDoS protection via Cloudflare

---

## 8. Success Metrics

### Technical KPIs
- 🎯 Uptime: 99.9%
- 🎯 API response time: <200ms (p95)
- 🎯 MCP connection success rate: >99%
- 🎯 License validation time: <50ms

### Business KPIs
- 🎯 Month 1: 5 beta customers
- 🎯 Month 3: 20 paying customers
- 🎯 Month 6: 2 service integrator partnerships
- 🎯 Month 12: €50k MRR

---

**Status:** 🚀 Ready to implement!
**Next Action:** Create snow-flow-enterprise repository and implement Phase 1
