# Snow-Flow Enterprise - Master Plan & Implementation Guide

**Version:** 1.0 MASTER
**Date:** October 27, 2025
**Status:** 🎯 Single Source of Truth

---

## 📖 Table of Contents

1. [Current Status Overview](#current-status-overview)
2. [Architecture](#architecture)
3. [What Exists vs What's Needed](#what-exists-vs-whats-needed)
4. [Implementation Roadmap](#implementation-roadmap)
5. [Technical Specifications](#technical-specifications)
6. [Deployment Guide](#deployment-guide)
7. [Testing Strategy](#testing-strategy)

---

## 1. Current Status Overview

### ✅ What Already Exists

#### A. **snow-flow-enterprise Repository**
Location: `/Users/nielsvanderwerf/snow-flow-enterprise`

**License Server** (Currently at `portal.snow-flow.dev`):
- ✅ Backend Express server with full API
- ✅ PostgreSQL/SQLite database support
- ✅ JWT authentication & license validation
- ✅ Encrypted credential storage (AES-256)
- ✅ SSO/SAML support
- ✅ Theme management
- ✅ Monitoring & analytics
- ✅ Admin API for license management

**Integrations** (Fully Implemented):
- ✅ Jira client (14KB) - Full API integration
- ✅ Jira MCP tools (9KB) - Sync, webhooks, AI parsing
- ✅ Azure DevOps client (20KB) - Work items, pipelines
- ✅ Azure DevOps tools (13KB) - MCP tools
- ✅ Confluence client (11KB) - Documentation sync
- ✅ Confluence tools (9KB) - MCP tools

**Frontend Portal**:
- ✅ React + Vite + Tailwind CSS
- ✅ Basic pages (login, dashboard)
- ⚠️ Integration config pages MISSING (Jira/Azure/Confluence)
- ⚠️ Theme selector needs enhancement

**Deployment**:
- ✅ Dockerfile
- ✅ cloudbuild.yaml (Cloud Build)
- ✅ Currently deployed to Cloud Run
- ⚠️ Portal + MCP server are COMBINED (needs split)

#### B. **snow-flow Repository** (Open Source)
- ✅ 235+ ServiceNow MCP tools
- ✅ Agent orchestration
- ✅ Local MCP servers
- ⚠️ Has enterprise adapter tools (need to remove)
- ❌ NO CLI commands for enterprise
- ❌ NO remote MCP client

---

## 2. Architecture

### 🎯 Target Architecture (Portal-First Design)

```
┌─────────────────────────────────────────────────────────────┐
│ LOCAL: snow-flow (Open Source)                             │
│                                                             │
│  CLI Commands:                                              │
│  • snow-flow login <key>     → Authenticate                │
│  • snow-flow status          → Check license               │
│  • snow-flow portal          → Open browser                │
│  • snow-flow logout          → Clear auth                  │
│  • snow-flow swarm <task>    → Auto-detect enterprise      │
│                                                             │
│  Local MCP Servers:                                         │
│  • servicenow-unified (235+ tools)                          │
│  • snow-flow-orchestration                                  │
│                                                             │
│  Remote MCP Client:                                         │
│  • Connects to enterprise.snow-flow.dev                     │
│  • Sends JWT with requests                                  │
│  • NO credentials stored locally                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTPS + JWT
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ CLOUD RUN 1: portal.snow-flow.dev                          │
│                                                             │
│  Frontend (React):                                          │
│  • /login              - Login with license key            │
│  • /dashboard          - Overview & analytics              │
│  • /integrations/jira  - Configure Jira ⚠️ TODO            │
│  • /integrations/azure - Configure Azure DevOps ⚠️ TODO    │
│  • /integrations/confluence - Configure Confluence ⚠️ TODO │
│  • /themes             - Theme selector                    │
│  • /licenses           - License management (integrators)  │
│                                                             │
│  Backend APIs:                                              │
│  • POST /api/auth/login       - Authenticate               │
│  • GET  /api/auth/me          - Get user info              │
│  • POST /api/credentials/jira - Save Jira config           │
│  • POST /api/credentials/azure - Save Azure config         │
│  • POST /api/credentials/confluence - Save Confluence      │
│  • GET  /api/themes           - Get available themes       │
│  • POST /api/admin/*          - License management         │
│                                                             │
│  Database (PostgreSQL):                                     │
│  • licenses                   - License keys & tiers       │
│  • integration_credentials    - Jira/Azure/Confluence      │
│  • themes                     - Company themes             │
│  • usage_logs                 - Analytics & billing        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ CLOUD RUN 2: enterprise.snow-flow.dev                      │
│                                                             │
│  MCP Server (SSE):                                          │
│  • GET  /mcp/sse              - SSE connection             │
│  • POST /mcp/messages         - MCP protocol               │
│                                                             │
│  Enterprise MCP Tools:                                      │
│  • jira_sync_backlog_advanced                              │
│  • jira_webhook_handler                                    │
│  • jira_ai_parser                                          │
│  • azure_sync_work_items                                   │
│  • azure_pipeline_tracker                                  │
│  • azure_pr_integration                                    │
│  • confluence_sync_documentation                           │
│  • confluence_spec_parser                                  │
│                                                             │
│  Each tool:                                                 │
│  1. Validates JWT token                                     │
│  2. Fetches credentials from portal DB                      │
│  3. Executes integration logic                              │
│  4. Returns results                                         │
└─────────────────────────────────────────────────────────────┘
```

### 🔄 Complete User Flow

```bash
# 1. Install & Login
npm install -g snow-flow
snow-flow login SNOW-ENT-CAPGEMINI-20261231-XXX

# Output:
# ✅ Logged in as: Capgemini (Enterprise)
# 🌐 Portal: https://portal.snow-flow.dev
# 💡 Next: Run 'snow-flow portal' to configure

# 2. Configure in Portal
snow-flow portal  # Opens browser

# User navigates to /integrations/jira
# User enters:
#   - Jira URL: https://capgemini.atlassian.net
#   - API Token: [secure]
#   - Default Project: PROJ
#   - Sync: Bidirectional, 15 min
#   - AI Parsing: ON
# Click "Save" → Stored encrypted in DB

# 3. Use in SnowCode
snowcode

# User: "Sync Jira PROJ to incidents"
# → SnowCode calls jira_sync_backlog_advanced
# → Request to enterprise.snow-flow.dev with JWT
# → MCP server fetches Jira creds from portal DB
# → Executes sync
# → Returns results
# → User NEVER provided credentials in CLI!
```

---

## 3. What Exists vs What's Needed

### 🔴 Critical Changes Required

| Component | Current State | Required State | Priority |
|-----------|---------------|----------------|----------|
| **Portal & MCP Server** | Combined in 1 Cloud Run | Split into 2 services | 🔴 HIGH |
| **Portal Config Pages** | Missing Jira/Azure/Confluence | Need 3 config pages | 🔴 HIGH |
| **Open Source Adapters** | Has enterprise tools | Remove enterprise tools | 🔴 HIGH |
| **CLI Commands** | None | login, status, portal, logout | 🔴 HIGH |
| **Remote MCP Client** | None | Connect to enterprise server | 🟡 MEDIUM |
| **Swarm Enterprise Detection** | None | Auto-detect enterprise features | 🟡 MEDIUM |

---

## 4. Implementation Roadmap

### **Phase 1: Split Portal & MCP Server** (Week 1)

**Goal:** 2 separate Cloud Run services

#### Step 1: Create New Directory Structure

```bash
cd /Users/nielsvanderwerf/snow-flow-enterprise

# Create new structure
mkdir -p portal/backend portal/frontend
mkdir -p mcp-server/src

# Move files
mv license-server/frontend/* portal/frontend/
mv license-server/src/* portal/backend/
mv license-server/src/routes/mcp.ts mcp-server/src/
mv license-server/src/integrations/* mcp-server/src/integrations/
```

#### Step 2: Create Portal cloudbuild.yaml

**File:** `portal/cloudbuild.yaml`

```yaml
substitutions:
  _SERVICE_NAME: 'snow-flow-portal'
  _REGION: 'europe-west4'
  _ARTIFACT_REGISTRY_REPO: 'snow-flow-enterprise'

steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - '${_REGION}-docker.pkg.dev/$PROJECT_ID/${_ARTIFACT_REGISTRY_REPO}/${_SERVICE_NAME}:$COMMIT_SHA'
      - 'portal'

  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - '${_REGION}-docker.pkg.dev/$PROJECT_ID/${_ARTIFACT_REGISTRY_REPO}/${_SERVICE_NAME}:$COMMIT_SHA'

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args:
      - 'run'
      - 'services'
      - 'update'
      - '${_SERVICE_NAME}'
      - '--image=${_REGION}-docker.pkg.dev/$PROJECT_ID/${_ARTIFACT_REGISTRY_REPO}/${_SERVICE_NAME}:$COMMIT_SHA'
      - '--region=${_REGION}'
```

#### Step 3: Create MCP Server cloudbuild.yaml

**File:** `mcp-server/cloudbuild.yaml`

```yaml
substitutions:
  _SERVICE_NAME: 'snow-flow-enterprise-mcp'
  _REGION: 'europe-west4'
  _ARTIFACT_REGISTRY_REPO: 'snow-flow-enterprise'

steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - '${_REGION}-docker.pkg.dev/$PROJECT_ID/${_ARTIFACT_REGISTRY_REPO}/${_SERVICE_NAME}:$COMMIT_SHA'
      - 'mcp-server'

  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - '${_REGION}-docker.pkg.dev/$PROJECT_ID/${_ARTIFACT_REGISTRY_REPO}/${_SERVICE_NAME}:$COMMIT_SHA'

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args:
      - 'run'
      - 'services'
      - 'update'
      - '${_SERVICE_NAME}'
      - '--image=${_REGION}-docker.pkg.dev/$PROJECT_ID/${_ARTIFACT_REGISTRY_REPO}/${_SERVICE_NAME}:$COMMIT_SHA'
      - '--region=${_REGION}'
```

#### Step 4: Deploy Both Services

```bash
# Deploy portal
cd snow-flow-enterprise/portal
gcloud builds submit --config cloudbuild.yaml

# Deploy MCP server
cd snow-flow-enterprise/mcp-server
gcloud builds submit --config cloudbuild.yaml

# Configure DNS
# portal.snow-flow.dev → snow-flow-portal
# enterprise.snow-flow.dev → snow-flow-enterprise-mcp
```

---

### **Phase 2: Build Portal Config Pages** (Week 1-2)

#### Jira Configuration Page

**File:** `portal/frontend/src/pages/integrations/JiraConfig.tsx`

```tsx
import React, { useState, useEffect } from 'react';

export function JiraConfigPage() {
  const [config, setConfig] = useState({
    jiraUrl: '',
    email: '',
    apiToken: '',
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
      .then(data => setConfig(data));
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
    alert('✅ Configuration saved!');
  };

  const handleTest = async () => {
    const res = await fetch('/api/credentials/jira/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('jwt')}`
      },
      body: JSON.stringify({
        jiraUrl: config.jiraUrl,
        email: config.email,
        apiToken: config.apiToken
      })
    });
    const data = await res.json();
    alert(data.success ? '✅ Connection successful!' : '❌ Failed: ' + data.error);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Jira Configuration</h1>

      <div className="space-y-6 bg-white p-6 rounded-lg shadow">
        <div>
          <label className="block text-sm font-medium mb-2">Jira URL</label>
          <input
            type="url"
            value={config.jiraUrl}
            onChange={(e) => setConfig({ ...config, jiraUrl: e.target.value })}
            placeholder="https://yourcompany.atlassian.net"
            className="w-full border rounded p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <input
            type="email"
            value={config.email}
            onChange={(e) => setConfig({ ...config, email: e.target.value })}
            placeholder="your-email@company.com"
            className="w-full border rounded p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">API Token</label>
          <input
            type="password"
            value={config.apiToken}
            onChange={(e) => setConfig({ ...config, apiToken: e.target.value })}
            placeholder="Your Jira API token"
            className="w-full border rounded p-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            Generate at: Account Settings → Security → API tokens
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Default Project</label>
          <input
            type="text"
            value={config.defaultProject}
            onChange={(e) => setConfig({ ...config, defaultProject: e.target.value })}
            placeholder="PROJ"
            className="w-full border rounded p-2"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleTest}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Test Connection
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Similar pages needed:**
- `AzureConfig.tsx`
- `ConfluenceConfig.tsx`

---

### **Phase 3: Clean Open Source** (Week 2)

#### Remove Enterprise Adapter Tools

```bash
cd /Users/nielsvanderwerf/snow-flow

# Remove tools
rm src/mcp/servicenow-mcp-unified/tools/adapters/snow_jira_integration.ts
rm src/mcp/servicenow-mcp-unified/tools/adapters/snow_ldap_sync.ts
rm src/mcp/servicenow-mcp-unified/tools/adapters/snow_saml_config.ts
rm src/mcp/servicenow-mcp-unified/tools/adapters/snow_oauth_provider.ts
rm src/mcp/servicenow-mcp-unified/tools/adapters/snow_webhook_config.ts

# Update index
# Edit: src/mcp/servicenow-mcp-unified/tools/adapters/index.ts
# Remove all exports

npm run build
```

#### Add CLI Commands

**File:** `src/cli/enterprise.ts`

```typescript
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import open from 'open';

const AUTH_FILE = path.join(os.homedir(), '.snow-flow', 'auth.json');
const PORTAL_URL = process.env.PORTAL_URL || 'https://portal.snow-flow.dev';

export async function loginCommand(licenseKey: string) {
  console.log('🔐 Authenticating...');

  const response = await axios.post(`${PORTAL_URL}/api/auth/login`, {
    licenseKey,
    clientType: 'cli'
  });

  const { token, tier, company, companyName, features, expiresAt } = response.data;

  await fs.mkdir(path.dirname(AUTH_FILE), { recursive: true });
  await fs.writeFile(
    AUTH_FILE,
    JSON.stringify({ licenseKey, jwt: token, expiresAt, tier, company, companyName, features }, null, 2)
  );

  console.log('✅ Logged in!');
  console.log(`🏢 ${companyName} (${tier})`);
  console.log(`🎯 Features: ${features.join(', ')}`);
}

export async function statusCommand() {
  const auth = JSON.parse(await fs.readFile(AUTH_FILE, 'utf-8'));
  console.log(`🏢 ${auth.companyName}`);
  console.log(`📦 ${auth.tier}`);
  console.log(`🎯 ${auth.features.join(', ')}`);
}

export async function portalCommand() {
  const auth = JSON.parse(await fs.readFile(AUTH_FILE, 'utf-8'));
  await open(`${PORTAL_URL}?token=${auth.jwt}`);
}

export async function logoutCommand() {
  await fs.unlink(AUTH_FILE);
  console.log('✅ Logged out');
}
```

**Update:** `src/cli.ts`

```typescript
import { Command } from 'commander';
import { loginCommand, statusCommand, portalCommand, logoutCommand } from './cli/enterprise.js';

const program = new Command();

program
  .command('login <license-key>')
  .action(loginCommand);

program
  .command('status')
  .action(statusCommand);

program
  .command('portal')
  .action(portalCommand);

program
  .command('logout')
  .action(logoutCommand);

program.parse();
```

---

## 5. Technical Specifications

### Database Schema

```sql
-- Licenses
CREATE TABLE licenses (
  id UUID PRIMARY KEY,
  license_key VARCHAR(255) UNIQUE NOT NULL,
  tier VARCHAR(50) NOT NULL, -- community/professional/team/enterprise
  company VARCHAR(100),
  company_name VARCHAR(255),
  expires_at TIMESTAMP,
  is_integrator BOOLEAN DEFAULT FALSE,
  theme VARCHAR(100) DEFAULT 'servicenow',
  features JSONB DEFAULT '[]'::jsonb
);

-- Integration Credentials (AES-256 encrypted)
CREATE TABLE integration_credentials (
  id UUID PRIMARY KEY,
  license_id UUID REFERENCES licenses(id),
  integration_type VARCHAR(50), -- jira/azure/confluence
  credentials_encrypted TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  UNIQUE(license_id, integration_type)
);

-- Themes
CREATE TABLE themes (
  id UUID PRIMARY KEY,
  name VARCHAR(100) UNIQUE,
  display_name VARCHAR(255),
  company VARCHAR(100),
  theme_json JSONB,
  is_public BOOLEAN DEFAULT FALSE
);

-- Usage Logs (for billing)
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY,
  license_id UUID REFERENCES licenses(id),
  tool_name VARCHAR(255),
  execution_time_ms INTEGER,
  success BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 6. Deployment Guide

### Deploy Portal

```bash
cd /Users/nielsvanderwerf/snow-flow-enterprise/portal
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_REGION=europe-west4,_SERVICE_NAME=snow-flow-portal
```

### Deploy MCP Server

```bash
cd /Users/nielsvanderwerf/snow-flow-enterprise/mcp-server
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_REGION=europe-west4,_SERVICE_NAME=snow-flow-enterprise-mcp
```

### Configure DNS

```bash
# Point custom domains to Cloud Run services
gcloud run services update snow-flow-portal \
  --region europe-west4 \
  --domain portal.snow-flow.dev

gcloud run services update snow-flow-enterprise-mcp \
  --region europe-west4 \
  --domain enterprise.snow-flow.dev
```

---

## 7. Testing Strategy

### Test 1: Portal Login

```bash
# Test portal API
curl -X POST https://portal.snow-flow.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"licenseKey": "SNOW-ENT-CAPGEMINI-20261231-XXX"}'

# Should return:
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "tier": "enterprise",
#   "company": "capgemini",
#   "features": ["jira", "azure-devops", "confluence"]
# }
```

### Test 2: CLI Login

```bash
snow-flow login SNOW-ENT-CAPGEMINI-20261231-XXX

# Should output:
# ✅ Logged in as: Capgemini (enterprise)
# 🎯 Features: jira, azure-devops, confluence
```

### Test 3: Portal Configuration

```bash
# Open portal
snow-flow portal

# In browser:
# 1. Navigate to /integrations/jira
# 2. Enter credentials
# 3. Click "Test Connection" → ✅ Success
# 4. Click "Save Configuration"
```

### Test 4: MCP Tools

```bash
# In SnowCode
snowcode

# User: "Sync Jira project PROJ to incidents"
# → Should connect to enterprise.snow-flow.dev
# → Fetch credentials from portal DB
# → Execute sync
# → Return results
```

---

## 📝 Next Steps

### Week 1 (Oct 28 - Nov 3)
1. ✅ Split portal & MCP server
2. ✅ Deploy both services
3. ✅ Test separation

### Week 2 (Nov 4 - Nov 10)
1. ✅ Build Jira/Azure/Confluence config pages
2. ✅ Remove enterprise tools from open source
3. ✅ Implement CLI commands

### Week 3 (Nov 11 - Nov 17)
1. ✅ Implement remote MCP client
2. ✅ Test end-to-end
3. ✅ Documentation

---

## 🎯 Success Criteria

- ✅ 2 separate Cloud Run services running
- ✅ Portal UI shows Jira/Azure/Confluence config pages
- ✅ CLI commands work (login, status, portal, logout)
- ✅ Open source has NO enterprise tools
- ✅ SnowCode can use enterprise tools via remote MCP
- ✅ Complete end-to-end flow tested

---

**Status:** 🚀 Ready to implement!
**Current Phase:** Phase 1 - Split Portal & MCP Server
