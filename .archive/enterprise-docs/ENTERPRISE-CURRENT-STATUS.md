# Snow-Flow Enterprise - Current Status & Action Plan

**Date:** October 27, 2025
**Status:** 🔄 Existing Infrastructure + New Requirements

---

## ✅ **WHAT ALREADY EXISTS**

### 1. **snow-flow-enterprise Repository**
Location: `/Users/nielsvanderwerf/snow-flow-enterprise`

#### A. License Server (`/license-server/`)
**Current Status:** ✅ Built and deployed to `portal.snow-flow.dev`

**What It Has:**
- ✅ **Backend Server (`src/`):**
  - `routes/auth.ts` - JWT authentication
  - `routes/admin.ts` - Admin API for license management
  - `routes/credentials.ts` - Encrypted credential storage
  - `routes/mcp.ts` - MCP server endpoints (31KB - big!)
  - `routes/monitoring.ts` - Usage analytics & monitoring
  - `routes/sso.ts` - SAML/SSO support
  - `routes/themes.ts` - Theme management
  - `database/` - PostgreSQL/SQLite support
  - `integrations/` - Jira, Azure DevOps, Confluence clients

- ✅ **Frontend (`frontend/src/`):**
  - React + Vite + Tailwind CSS
  - `App.tsx` - Main app component
  - `pages/` - Dashboard pages (some built)
  - `components/` - UI components
  - `api/` - API client
  - `contexts/` - React contexts

- ✅ **Integrations (`src/integrations/`):**
  - `jira-client.ts` (14KB) - Jira API client
  - `jira-tools.ts` (9KB) - Jira MCP tools
  - `azdo-client.ts` (20KB) - Azure DevOps client
  - `azdo-tools.ts` (13KB) - Azure DevOps MCP tools
  - `confluence-client.ts` (11KB) - Confluence client
  - `confluence-tools.ts` (9KB) - Confluence MCP tools

- ✅ **Deployment:**
  - `cloudbuild.yaml` - Cloud Build config
  - `Dockerfile` - Docker image
  - `deploy.sh` - Deployment script
  - Currently deployed to Cloud Run at `portal.snow-flow.dev`

#### B. Core Enterprise Features (`/src/`)
- ✅ `auth/` - Enterprise license validation
- ✅ `integrations/jira/` - Jira sync engine
- ✅ `themes/` - Theme management
- ✅ `tools/` - MCP tool schemas
- ✅ `license/` - License validation logic

---

## ❌ **WHAT'S MISSING / NEEDS TO CHANGE**

### **Issue 1: Portal & MCP Server Are Combined**
**Current:** One Cloud Run service (`portal.snow-flow.dev`) hosts BOTH portal UI and MCP server
**Problem:** Mixing concerns, can't scale independently
**Solution:** Split into 2 Cloud Run services:

```
┌─────────────────────────────────────────────────────────┐
│ Cloud Run Service 1: portal.snow-flow.dev              │
│ • React frontend (dashboard, config pages)             │
│ • Auth API (/api/auth/login, /api/auth/refresh)       │
│ • Credentials API (/api/credentials/*)                 │
│ • Themes API (/api/themes/*)                           │
│ • SSO API (/api/sso/*)                                 │
│ • Admin API (/api/admin/*) - license management       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Cloud Run Service 2: enterprise.snow-flow.dev          │
│ • MCP Server (SSE endpoint at /mcp/sse)                │
│ • Enterprise MCP tools:                                │
│   - jira_sync_backlog_advanced                         │
│   - azure_sync_work_items                              │
│   - confluence_sync_documentation                      │
│   - (auto-fetches credentials from portal DB)          │
└─────────────────────────────────────────────────────────┘
```

### **Issue 2: Portal UI Missing Config Pages**
**Current:** Portal has basic structure but missing integration config pages
**Needed:**
- ❌ `/integrations/jira` - Jira configuration page
- ❌ `/integrations/azure` - Azure DevOps configuration page
- ❌ `/integrations/confluence` - Confluence configuration page
- ❌ Full theme selector with company logos

### **Issue 3: Open Source Has Enterprise Adapter Tools**
**Current:** `snow-flow/src/mcp/servicenow-mcp-unified/tools/adapters/` contains:
- `snow_jira_integration.ts`
- `snow_ldap_sync.ts`
- `snow_saml_config.ts`
- `snow_oauth_provider.ts`
- `snow_webhook_config.ts`

**Problem:** These should be enterprise-only
**Solution:** Remove these from open source repo

### **Issue 4: Missing CLI Commands**
**Current:** No CLI commands for enterprise features
**Needed:**
- ❌ `snow-flow login <license-key>` - Login with license
- ❌ `snow-flow status` - Show license status
- ❌ `snow-flow portal` - Open portal in browser
- ❌ `snow-flow logout` - Logout
- ❌ `snow-flow swarm` enterprise feature detection

### **Issue 5: No Remote MCP Client in Open Source**
**Current:** Open source doesn't connect to enterprise MCP server
**Needed:** Remote MCP client that connects to `enterprise.snow-flow.dev`

---

## 📋 **ACTION PLAN**

### **Phase 1: Split Portal & MCP Server (Week 1)**

**Goal:** 2 separate Cloud Run services

#### **1.1 Restructure Repositories**

**Current Structure:**
```
snow-flow-enterprise/
├── license-server/          ← Portal + MCP server (combined)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── credentials.ts
│   │   │   ├── mcp.ts      ← MCP server (31KB)
│   │   │   ├── themes.ts
│   │   │   └── ...
│   │   └── integrations/    ← Jira/Azure/Confluence clients
│   └── frontend/            ← React UI
└── src/                     ← Core enterprise features
```

**New Structure:**
```
snow-flow-enterprise/
├── portal/                  ← NEW: Portal only
│   ├── backend/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── credentials.ts
│   │   │   ├── themes.ts
│   │   │   └── admin.ts
│   │   └── database/
│   ├── frontend/            ← React UI (moved from license-server)
│   ├── Dockerfile
│   └── cloudbuild.yaml
│
├── mcp-server/              ← NEW: MCP server only
│   ├── src/
│   │   ├── mcp-server.ts    ← From routes/mcp.ts
│   │   ├── tools/
│   │   │   ├── jira-tools.ts
│   │   │   ├── azdo-tools.ts
│   │   │   └── confluence-tools.ts
│   │   └── integrations/    ← Shared with portal
│   ├── Dockerfile
│   └── cloudbuild.yaml
│
└── src/                     ← Shared core (themes, auth, license)
```

#### **1.2 Create Portal cloudbuild.yaml**

```yaml
# snow-flow-enterprise/portal/cloudbuild.yaml
substitutions:
  _SERVICE_NAME: 'snow-flow-portal'
  _REGION: 'europe-west4'

steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', '${_REGION}-docker.pkg.dev/$PROJECT_ID/snow-flow-enterprise/${_SERVICE_NAME}:$COMMIT_SHA', 'portal']

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', '${_REGION}-docker.pkg.dev/$PROJECT_ID/snow-flow-enterprise/${_SERVICE_NAME}:$COMMIT_SHA']

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args:
      - 'run'
      - 'services'
      - 'update'
      - '${_SERVICE_NAME}'
      - '--image=${_REGION}-docker.pkg.dev/$PROJECT_ID/snow-flow-enterprise/${_SERVICE_NAME}:$COMMIT_SHA'
      - '--region=${_REGION}'
```

#### **1.3 Create MCP Server cloudbuild.yaml**

```yaml
# snow-flow-enterprise/mcp-server/cloudbuild.yaml
substitutions:
  _SERVICE_NAME: 'snow-flow-enterprise-mcp'
  _REGION: 'europe-west4'

steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', '${_REGION}-docker.pkg.dev/$PROJECT_ID/snow-flow-enterprise/${_SERVICE_NAME}:$COMMIT_SHA', 'mcp-server']

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', '${_REGION}-docker.pkg.dev/$PROJECT_ID/snow-flow-enterprise/${_SERVICE_NAME}:$COMMIT_SHA']

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args:
      - 'run'
      - 'services'
      - 'update'
      - '${_SERVICE_NAME}'
      - '--image=${_REGION}-docker.pkg.dev/$PROJECT_ID/snow-flow-enterprise/${_SERVICE_NAME}:$COMMIT_SHA'
      - '--region=${_REGION}'
```

#### **1.4 Deployment Commands**

```bash
# Deploy portal
cd snow-flow-enterprise/portal
gcloud builds submit --config cloudbuild.yaml

# Deploy MCP server
cd snow-flow-enterprise/mcp-server
gcloud builds submit --config cloudbuild.yaml

# Result:
# portal.snow-flow.dev      → Portal UI + APIs
# enterprise.snow-flow.dev  → MCP server (SSE)
```

---

### **Phase 2: Extend Portal UI (Week 1-2)**

**Goal:** Add Jira/Azure/Confluence configuration pages

#### **2.1 Create Integration Config Pages**

**File:** `portal/frontend/src/pages/integrations/JiraConfig.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { Button, Input, Switch, Select } from '@/components/ui';

export function JiraConfigPage() {
  const [config, setConfig] = useState({
    jiraUrl: '',
    apiToken: '',
    email: '',
    defaultProject: '',
    syncDirection: 'bidirectional',
    syncInterval: 15,
    aiParsing: true
  });

  useEffect(() => {
    // Load existing config
    fetch('/api/credentials/jira', {
      headers: { Authorization: `Bearer ${localStorage.getItem('jwt')}` }
    })
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error('Failed to load config:', err));
  }, []);

  const handleSave = async () => {
    await fetch('/api/credentials/jira', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('jwt')}`
      },
      body: JSON.stringify(config)
    });
    alert('✅ Jira configuration saved!');
  };

  const handleTest = async () => {
    const res = await fetch('/api/credentials/jira/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('jwt')}`
      },
      body: JSON.stringify({ jiraUrl: config.jiraUrl, apiToken: config.apiToken, email: config.email })
    });
    const data = await res.json();
    alert(data.success ? '✅ Connection successful!' : '❌ Connection failed: ' + data.error);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Jira Configuration</h1>

      <div className="space-y-6 bg-white p-6 rounded-lg shadow">
        <div>
          <label className="block text-sm font-medium mb-2">Jira Instance URL</label>
          <Input
            type="url"
            value={config.jiraUrl}
            onChange={(e) => setConfig({ ...config, jiraUrl: e.target.value })}
            placeholder="https://yourcompany.atlassian.net"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <Input
            type="email"
            value={config.email}
            onChange={(e) => setConfig({ ...config, email: e.target.value })}
            placeholder="your-email@company.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">API Token</label>
          <Input
            type="password"
            value={config.apiToken}
            onChange={(e) => setConfig({ ...config, apiToken: e.target.value })}
            placeholder="Your Jira API token"
          />
          <p className="text-xs text-gray-500 mt-1">
            Generate at: Account Settings → Security → API tokens
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Default Project Key</label>
          <Input
            type="text"
            value={config.defaultProject}
            onChange={(e) => setConfig({ ...config, defaultProject: e.target.value })}
            placeholder="PROJ"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Sync Direction</label>
          <Select
            value={config.syncDirection}
            onChange={(e) => setConfig({ ...config, syncDirection: e.target.value })}
          >
            <option value="jira-to-snow">Jira → ServiceNow</option>
            <option value="snow-to-jira">ServiceNow → Jira</option>
            <option value="bidirectional">Bidirectional</option>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Sync Interval (minutes)</label>
          <Input
            type="number"
            value={config.syncInterval}
            onChange={(e) => setConfig({ ...config, syncInterval: parseInt(e.target.value) })}
            min="0"
          />
          <p className="text-xs text-gray-500 mt-1">Set to 0 for manual sync only</p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium">AI-Powered Requirement Parsing</label>
            <p className="text-xs text-gray-500">Use AI to extract structured requirements</p>
          </div>
          <Switch
            checked={config.aiParsing}
            onCheckedChange={(checked) => setConfig({ ...config, aiParsing: checked })}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button onClick={handleTest} variant="outline">Test Connection</Button>
          <Button onClick={handleSave} className="flex-1">Save Configuration</Button>
        </div>
      </div>
    </div>
  );
}
```

**Similar pages needed:**
- `AzureConfig.tsx` - Azure DevOps configuration
- `ConfluenceConfig.tsx` - Confluence configuration

#### **2.2 Update App.tsx Routes**

```tsx
// portal/frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { JiraConfigPage } from './pages/integrations/JiraConfig';
import { AzureConfigPage } from './pages/integrations/AzureConfig';
import { ConfluenceConfigPage } from './pages/integrations/ConfluenceConfig';
import { ThemesPage } from './pages/ThemesPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/integrations">
          <Route path="jira" element={<JiraConfigPage />} />
          <Route path="azure" element={<AzureConfigPage />} />
          <Route path="confluence" element={<ConfluenceConfigPage />} />
        </Route>
        <Route path="/themes" element={<ThemesPage />} />
        <Route path="/licenses" element={<LicensesPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

### **Phase 3: Remove Enterprise Tools from Open Source (Week 2)**

**Goal:** Clean up open source repo

#### **3.1 Remove Adapter Tools**

```bash
cd /Users/nielsvanderwerf/snow-flow

# Remove enterprise adapter tools
rm src/mcp/servicenow-mcp-unified/tools/adapters/snow_jira_integration.ts
rm src/mcp/servicenow-mcp-unified/tools/adapters/snow_ldap_sync.ts
rm src/mcp/servicenow-mcp-unified/tools/adapters/snow_saml_config.ts
rm src/mcp/servicenow-mcp-unified/tools/adapters/snow_oauth_provider.ts
rm src/mcp/servicenow-mcp-unified/tools/adapters/snow_webhook_config.ts

# Update index.ts to remove exports
# Edit: src/mcp/servicenow-mcp-unified/tools/adapters/index.ts
# Remove all exports related to these tools

# Rebuild
npm run build
```

---

### **Phase 4: Implement CLI Commands (Week 2)**

**Goal:** Add enterprise CLI commands to open source

#### **4.1 Create `src/cli/enterprise.ts`**

```typescript
// snow-flow/src/cli/enterprise.ts
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import open from 'open';

const AUTH_FILE = path.join(os.homedir(), '.snow-flow', 'auth.json');
const PORTAL_URL = process.env.PORTAL_URL || 'https://portal.snow-flow.dev';
const ENTERPRISE_URL = process.env.ENTERPRISE_URL || 'https://enterprise.snow-flow.dev';

interface AuthData {
  licenseKey: string;
  jwt: string;
  expiresAt: string;
  tier: string;
  company: string;
  companyName: string;
  features: string[];
}

export async function loginCommand(licenseKey: string) {
  console.log('🔐 Authenticating with Snow-Flow Enterprise...');

  try {
    // Authenticate with portal
    const response = await axios.post(`${PORTAL_URL}/api/auth/login`, {
      licenseKey,
      clientType: 'cli'
    });

    const { token, tier, company, companyName, features, expiresAt } = response.data;

    // Save auth data
    await fs.mkdir(path.dirname(AUTH_FILE), { recursive: true });
    await fs.writeFile(
      AUTH_FILE,
      JSON.stringify({
        licenseKey,
        jwt: token,
        expiresAt,
        tier,
        company,
        companyName,
        features
      } as AuthData, null, 2)
    );

    console.log('');
    console.log('✅ Logged in successfully!');
    console.log('');
    console.log(`🏢 Company: ${companyName}`);
    console.log(`📦 Tier: ${tier}`);
    console.log(`🎯 Features: ${features.join(', ')}`);
    console.log(`📅 Expires: ${new Date(expiresAt).toLocaleDateString()}`);
    console.log('');
    console.log(`🌐 Portal: ${PORTAL_URL}`);
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Run: snow-flow portal (configure integrations)');
    console.log('   2. Use enterprise tools in SnowCode!');
    console.log('');
  } catch (error: any) {
    console.error('❌ Login failed:', error.response?.data?.error || error.message);
    process.exit(1);
  }
}

export async function statusCommand() {
  try {
    const authData: AuthData = JSON.parse(await fs.readFile(AUTH_FILE, 'utf-8'));

    console.log('📊 Snow-Flow Enterprise Status');
    console.log('');
    console.log(`🏢 Company: ${authData.companyName}`);
    console.log(`📦 Tier: ${authData.tier}`);
    console.log(`🎯 Features: ${authData.features.join(', ')}`);
    console.log(`📅 Expires: ${new Date(authData.expiresAt).toLocaleDateString()}`);
    console.log('');

    const expiresAt = new Date(authData.expiresAt);
    const now = new Date();
    if (expiresAt < now) {
      console.log('⚠️  License expired. Contact sales@snow-flow.dev');
    } else {
      const daysLeft = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`✅ License valid (${daysLeft} days remaining)`);
    }
  } catch (error) {
    console.log('❌ Not logged in. Run: snow-flow login <license-key>');
    process.exit(1);
  }
}

export async function portalCommand() {
  try {
    const authData: AuthData = JSON.parse(await fs.readFile(AUTH_FILE, 'utf-8'));

    console.log(`🌐 Opening portal: ${PORTAL_URL}`);

    // Open browser with auto-login token
    await open(`${PORTAL_URL}?token=${authData.jwt}`);
  } catch (error) {
    console.log('❌ Not logged in. Run: snow-flow login <license-key>');
    process.exit(1);
  }
}

export async function logoutCommand() {
  try {
    await fs.unlink(AUTH_FILE);
    console.log('✅ Logged out successfully');
  } catch (error) {
    console.log('❌ Not logged in');
  }
}

export async function getAuthData(): Promise<AuthData | null> {
  try {
    return JSON.parse(await fs.readFile(AUTH_FILE, 'utf-8'));
  } catch {
    return null;
  }
}
```

#### **4.2 Update `src/cli.ts`**

```typescript
// snow-flow/src/cli.ts
import { Command } from 'commander';
import { loginCommand, statusCommand, portalCommand, logoutCommand } from './cli/enterprise.js';
import { swarmCommand } from './cli/swarm.js';

const program = new Command();

program
  .name('snow-flow')
  .description('Snow-Flow - ServiceNow development with AI')
  .version('8.5.8');

// Enterprise commands
program
  .command('login <license-key>')
  .description('Login with enterprise license key')
  .action(loginCommand);

program
  .command('status')
  .description('Show enterprise license status')
  .action(statusCommand);

program
  .command('portal')
  .description('Open enterprise portal in browser')
  .action(portalCommand);

program
  .command('logout')
  .description('Logout from enterprise')
  .action(logoutCommand);

// Swarm command with enterprise detection
program
  .command('swarm <task>')
  .description('Multi-agent task orchestration')
  .option('--enterprise', 'Use enterprise features')
  .action(swarmCommand);

program.parse();
```

#### **4.3 Update Swarm Command**

```typescript
// snow-flow/src/cli/swarm.ts
import { getAuthData } from './enterprise.js';

export async function swarmCommand(task: string, options: { enterprise?: boolean }) {
  const authData = await getAuthData();

  if (authData && authData.features.length > 0) {
    console.log('🌟 Enterprise features enabled!');
    console.log(`   Available: ${authData.features.join(', ')}`);
    console.log('');

    // Use enterprise swarm with Jira/Azure/Confluence tools
    await executeEnterpriseSwarm(task, authData);
  } else {
    console.log('💡 Using community swarm');
    console.log('   (Upgrade for Jira, Azure DevOps, Confluence integration)');
    console.log('');

    // Use community swarm
    await executeCommunitySwarm(task);
  }
}

async function executeEnterpriseSwarm(task: string, authData: any) {
  // Connect to enterprise MCP server
  // Use enterprise tools (jira_sync_backlog_advanced, etc.)
  console.log('🚀 Executing with enterprise tools...');
}

async function executeCommunitySwarm(task: string) {
  // Use only open source tools
  console.log('🚀 Executing with community tools...');
}
```

---

### **Phase 5: Implement Remote MCP Client (Week 2-3)**

**Goal:** Open source connects to enterprise MCP server

#### **5.1 Create Remote MCP Client**

```typescript
// snow-flow/src/mcp/clients/enterprise-remote-client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { getAuthData } from '../../cli/enterprise.js';

export class EnterpriseRemoteClient {
  private client: Client;
  private connected: boolean = false;

  constructor() {
    this.client = new Client({
      name: 'snow-flow-enterprise-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
  }

  async connect(): Promise<void> {
    const authData = await getAuthData();

    if (!authData) {
      throw new Error('Not logged in. Run: snow-flow login <license-key>');
    }

    // Connect to enterprise MCP server
    const ENTERPRISE_URL = process.env.ENTERPRISE_URL || 'https://enterprise.snow-flow.dev';

    const transport = new SSEClientTransport(
      new URL(`${ENTERPRISE_URL}/mcp/sse`),
      {
        headers: {
          Authorization: `Bearer ${authData.jwt}`
        }
      }
    );

    await this.client.connect(transport);
    this.connected = true;

    console.log('✅ Connected to enterprise MCP server');
    console.log(`   Company: ${authData.companyName}`);
    console.log(`   Features: ${authData.features.join(', ')}`);
  }

  async listTools(): Promise<any> {
    if (!this.connected) {
      await this.connect();
    }
    return await this.client.listTools();
  }

  async callTool(name: string, args: any): Promise<any> {
    if (!this.connected) {
      await this.connect();
    }
    return await this.client.callTool({ name, arguments: args });
  }

  async close(): Promise<void> {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
    }
  }
}
```

#### **5.2 Update .mcp.json Template**

```json
// snow-flow/.mcp.json.template
{
  "mcpServers": {
    "servicenow-unified": {
      "command": "node",
      "args": ["{{PROJECT_ROOT}}/dist/mcp/servicenow-mcp-unified/index.js"],
      "env": {
        "SERVICENOW_INSTANCE_URL": "{{SNOW_INSTANCE}}",
        "SERVICENOW_CLIENT_ID": "{{SNOW_CLIENT_ID}}",
        "SERVICENOW_CLIENT_SECRET": "{{SNOW_CLIENT_SECRET}}"
      }
    },
    "snow-flow-orchestration": {
      "command": "node",
      "args": ["{{PROJECT_ROOT}}/dist/mcp/snow-flow-mcp.js"]
    },
    "snow-flow-enterprise": {
      "command": "node",
      "args": ["{{PROJECT_ROOT}}/dist/mcp/clients/enterprise-remote-client.js"],
      "description": "Enterprise features (requires license)"
    }
  }
}
```

---

## 🗓️ **TIMELINE**

### Week 1 (Oct 28 - Nov 3)
- ✅ Split portal & MCP server into 2 Cloud Run services
- ✅ Create separate cloudbuild.yaml files
- ✅ Deploy both services
- ✅ Test portal at portal.snow-flow.dev
- ✅ Test MCP server at enterprise.snow-flow.dev

### Week 2 (Nov 4 - Nov 10)
- ✅ Build Jira/Azure/Confluence config pages in portal
- ✅ Remove enterprise adapter tools from open source
- ✅ Implement CLI commands (login, status, portal, logout)
- ✅ Update swarm command with enterprise detection

### Week 3 (Nov 11 - Nov 17)
- ✅ Implement remote MCP client
- ✅ Test complete flow end-to-end
- ✅ Documentation & user guides

---

## 📝 **IMMEDIATE NEXT STEPS**

1. **Zou je willen dat ik begin met het splitsen van portal & MCP server?**
   - Maak portal/ en mcp-server/ directories
   - Verplaats code
   - Maak 2 cloudbuild.yaml files

2. **Of wil je eerst de frontend uitbreiden?**
   - Bouw Jira/Azure/Confluence config pages
   - Update App.tsx met routes

3. **Of wil je eerst de open source cleanen?**
   - Verwijder adapter tools
   - Implementeer CLI commands

Welke wil je als eerste aanpakken? 🚀
