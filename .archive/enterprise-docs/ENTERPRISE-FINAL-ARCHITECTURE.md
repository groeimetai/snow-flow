# Snow-Flow Enterprise - Final Architecture

**Version:** 3.0 (Final - Portal-First Design)
**Date:** October 27, 2025
**Status:** ✅ Correct Architecture

---

## 🎯 Core Principle

**ALL enterprise configuration happens in the web portal, NOT in the CLI.**

- ❌ No Jira/Azure/Confluence credentials in open source
- ❌ No adapter tools in open source
- ❌ No credentials stored locally
- ✅ Everything configured via https://portal.snow-flow.dev
- ✅ Credentials stored securely in enterprise database
- ✅ MCP tools auto-fetch credentials from database

---

## 🏗️ Complete Architecture

```
┌────────────────────────────────────────────────────────────────┐
│ LOCAL: snow-flow (Open Source)                                │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ CLI Commands:                                            │ │
│  │ • snow-flow login <license-key>                          │ │
│  │ • snow-flow status                                       │ │
│  │ • snow-flow logout                                       │ │
│  │ • snow-flow portal (opens browser)                       │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Local MCP Servers:                                       │ │
│  │ • servicenow-unified (235+ ServiceNow tools)             │ │
│  │ • snow-flow-orchestration (agent swarms)                 │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Remote MCP Client:                                       │ │
│  │ • Connects to enterprise.snow-flow.dev                   │ │
│  │ • Sends JWT token with each request                      │ │
│  │ • NO credentials stored locally                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ~/.snow-flow/auth.json:                                       │
│  {                                                             │
│    "licenseKey": "SNOW-ENT-CAPGEMINI-20261231-XXX",           │
│    "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",           │
│    "expiresAt": "2025-10-28T12:00:00Z",                       │
│    "portalUrl": "https://portal.snow-flow.dev"                │
│  }                                                             │
└────────────────────────────────────────────────────────────────┘
                             │
                             │ HTTPS/SSE + JWT
                             ↓
┌────────────────────────────────────────────────────────────────┐
│ REMOTE: enterprise.snow-flow.dev & portal.snow-flow.dev       │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 🌐 Enterprise Portal (React/Next.js)                     │ │
│  │ https://portal.snow-flow.dev                             │ │
│  │                                                          │ │
│  │ Pages:                                                   │ │
│  │ • /login       - Login with license key                 │ │
│  │ • /dashboard   - Overview & analytics                   │ │
│  │ • /integrations                                         │ │
│  │   ├─ /jira     - Configure Jira                         │ │
│  │   ├─ /azure    - Configure Azure DevOps                 │ │
│  │   └─ /confluence - Configure Confluence                 │ │
│  │ • /themes      - Choose/upload SnowCode theme           │ │
│  │ • /licenses    - Manage licenses (integrators only)     │ │
│  │ • /usage       - Usage analytics & billing              │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 🔐 Authentication API                                    │ │
│  │ POST /api/auth/login                                     │ │
│  │ POST /api/auth/refresh                                   │ │
│  │ GET  /api/auth/me                                        │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 🔌 Enterprise MCP Server (SSE)                           │ │
│  │ GET  /mcp/sse                                            │ │
│  │ POST /mcp/messages                                       │ │
│  │                                                          │ │
│  │ Enterprise Tools:                                        │ │
│  │ • jira_sync_backlog_advanced                             │ │
│  │ • jira_webhook_handler                                   │ │
│  │ • jira_ai_parser                                         │ │
│  │ • azure_sync_work_items                                  │ │
│  │ • azure_pipeline_tracker                                 │ │
│  │ • azure_pr_integration                                   │ │
│  │ • confluence_sync_documentation                          │ │
│  │ • confluence_spec_parser                                 │ │
│  │                                                          │ │
│  │ 🔑 Each tool fetches credentials from database!          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 💾 PostgreSQL Database                                   │ │
│  │                                                          │ │
│  │ Tables:                                                  │ │
│  │ • licenses                                               │ │
│  │ • users                                                  │ │
│  │ • integration_credentials (encrypted)                    │ │
│  │ • themes                                                 │ │
│  │ • usage_logs                                             │ │
│  │ • audit_logs                                             │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

---

## 📊 Database Schema

### Table: `licenses`

```sql
CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key VARCHAR(255) UNIQUE NOT NULL,
  tier VARCHAR(50) NOT NULL, -- 'community', 'professional', 'team', 'enterprise'
  company VARCHAR(100),
  company_name VARCHAR(255),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Service integrator fields
  is_integrator BOOLEAN DEFAULT FALSE,
  parent_license_id UUID REFERENCES licenses(id), -- For customer licenses

  -- Settings
  theme VARCHAR(100) DEFAULT 'servicenow',
  custom_theme_url TEXT,

  -- Features (JSON array)
  features JSONB DEFAULT '[]'::jsonb
);

-- Example rows:
-- Capgemini Master License (Integrator)
INSERT INTO licenses VALUES (
  'uuid-1',
  'SNOW-ENT-CAPGEMINI-20261231-A3F2E9C1',
  'enterprise',
  'capgemini',
  'Capgemini',
  '2026-12-31',
  NOW(),
  NOW(),
  TRUE, -- is_integrator
  NULL, -- no parent
  'capgemini', -- theme
  NULL,
  '["jira", "azure-devops", "confluence", "sso", "audit-logs"]'::jsonb
);

-- Customer License (via Capgemini)
INSERT INTO licenses VALUES (
  'uuid-2',
  'SNOW-ENT-CAPGEMINI-CLIENT123-20251231-B4E1F3D2',
  'enterprise',
  'capgemini',
  'Capgemini',
  '2025-12-31',
  NOW(),
  NOW(),
  FALSE, -- NOT integrator
  'uuid-1', -- parent is Capgemini master license
  'capgemini',
  NULL,
  '["jira", "azure-devops", "confluence"]'::jsonb -- No SSO/audit
);
```

### Table: `integration_credentials`

```sql
CREATE TABLE integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES licenses(id) ON DELETE CASCADE,
  integration_type VARCHAR(50) NOT NULL, -- 'jira', 'azure', 'confluence'

  -- Encrypted credentials (AES-256)
  credentials_encrypted TEXT NOT NULL,

  -- Configuration
  config JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,

  UNIQUE(license_id, integration_type)
);

-- Example encryption:
-- credentials_encrypted stores:
-- {
--   "url": "https://capgemini.atlassian.net",
--   "username": "api@capgemini.com",
--   "apiToken": "encrypted-with-aes256",
--   "defaultProject": "PROJ"
-- }

-- Example config for Jira:
-- {
--   "syncDirection": "bidirectional",
--   "syncInterval": 15,
--   "aiParsing": true,
--   "webhookUrl": "https://enterprise.snow-flow.dev/webhooks/jira/uuid-1"
-- }
```

### Table: `themes`

```sql
CREATE TABLE themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  company VARCHAR(100),

  -- Theme definition (SnowCode theme JSON)
  theme_json JSONB NOT NULL,

  -- Metadata
  is_public BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES licenses(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Example themes:
INSERT INTO themes VALUES (
  'uuid-theme-1',
  'capgemini',
  'Capgemini Blue',
  'capgemini',
  '{
    "colors": {
      "primary": "#0070AD",
      "secondary": "#00A3E0",
      "accent": "#005587"
    },
    "logo": "https://cdn.snow-flow.dev/themes/capgemini-logo.png"
  }'::jsonb,
  FALSE, -- Not public (only for Capgemini licenses)
  'uuid-1',
  NOW()
);
```

### Table: `usage_logs`

```sql
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES licenses(id),
  tool_name VARCHAR(255) NOT NULL,
  execution_time_ms INTEGER,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- For billing & analytics
CREATE INDEX idx_usage_logs_license_created ON usage_logs(license_id, created_at);
```

---

## 🌐 Enterprise Portal UI

### Tech Stack

- **Frontend:** Next.js 14 (App Router) + React 18
- **Styling:** Tailwind CSS + shadcn/ui components
- **Authentication:** NextAuth.js with JWT strategy
- **State Management:** React Query + Zustand
- **Forms:** React Hook Form + Zod validation

### File Structure

```
enterprise/portal/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx          ← Login with license key
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   │   └── page.tsx          ← Main dashboard
│   │   ├── integrations/
│   │   │   ├── page.tsx          ← Integration overview
│   │   │   ├── jira/
│   │   │   │   └── page.tsx      ← Jira configuration
│   │   │   ├── azure/
│   │   │   │   └── page.tsx      ← Azure DevOps config
│   │   │   └── confluence/
│   │   │       └── page.tsx      ← Confluence config
│   │   ├── themes/
│   │   │   └── page.tsx          ← Theme selection
│   │   ├── licenses/
│   │   │   └── page.tsx          ← License management (integrators)
│   │   ├── usage/
│   │   │   └── page.tsx          ← Usage analytics
│   │   └── layout.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   ├── refresh/route.ts
│   │   │   └── me/route.ts
│   │   ├── integrations/
│   │   │   ├── jira/route.ts
│   │   │   ├── azure/route.ts
│   │   │   └── confluence/route.ts
│   │   └── themes/route.ts
│   └── layout.tsx
├── components/
│   ├── ui/                        ← shadcn/ui components
│   ├── forms/
│   │   ├── JiraConfigForm.tsx
│   │   ├── AzureConfigForm.tsx
│   │   └── ConfluenceConfigForm.tsx
│   ├── ThemeSelector.tsx
│   └── LicenseManager.tsx
├── lib/
│   ├── api-client.ts
│   ├── auth.ts
│   └── crypto.ts                  ← AES-256 encryption
└── package.json
```

### Key Pages

#### 1. Login Page (`app/(auth)/login/page.tsx`)

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Login failed');
      }

      const data = await response.json();

      // Store JWT token
      localStorage.setItem('jwt', data.token);

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-3xl font-bold text-center">Snow-Flow Enterprise</h2>
          <p className="mt-2 text-center text-gray-600">
            Login with your license key
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              License Key
            </label>
            <Input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="SNOW-ENT-COMPANY-20261231-XXXXX"
              className="mt-1"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>

        <p className="text-sm text-center text-gray-600">
          Don't have a license?{' '}
          <a href="mailto:sales@snow-flow.dev" className="text-blue-600 hover:underline">
            Contact Sales
          </a>
        </p>
      </div>
    </div>
  );
}
```

#### 2. Jira Configuration (`app/(dashboard)/integrations/jira/page.tsx`)

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export default function JiraConfigPage() {
  const [config, setConfig] = useState({
    jiraUrl: '',
    apiToken: '',
    defaultProject: '',
    syncDirection: 'bidirectional',
    syncInterval: 15,
    aiParsing: true
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load existing config
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const response = await fetch('/api/integrations/jira', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('jwt')}`
      }
    });
    if (response.ok) {
      const data = await response.json();
      setConfig(data);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSaved(false);

    try {
      const response = await fetch('/api/integrations/jira', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('jwt')}`
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) throw new Error('Failed to save');

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    // Test Jira connection
    const response = await fetch('/api/integrations/jira/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('jwt')}`
      },
      body: JSON.stringify({ jiraUrl: config.jiraUrl, apiToken: config.apiToken })
    });

    const data = await response.json();
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
          <select
            className="w-full border rounded p-2"
            value={config.syncDirection}
            onChange={(e) => setConfig({ ...config, syncDirection: e.target.value })}
          >
            <option value="jira-to-snow">Jira → ServiceNow</option>
            <option value="snow-to-jira">ServiceNow → Jira</option>
            <option value="bidirectional">Bidirectional</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Sync Interval (minutes)</label>
          <Input
            type="number"
            value={config.syncInterval}
            onChange={(e) => setConfig({ ...config, syncInterval: parseInt(e.target.value) })}
            min="0"
          />
          <p className="text-xs text-gray-500 mt-1">
            Set to 0 for manual sync only
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium">AI-Powered Requirement Parsing</label>
            <p className="text-xs text-gray-500">
              Use AI to extract structured requirements from descriptions
            </p>
          </div>
          <Switch
            checked={config.aiParsing}
            onCheckedChange={(checked) => setConfig({ ...config, aiParsing: checked })}
          />
        </div>

        <div className="flex gap-3">
          <Button onClick={handleTest} variant="outline">
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={loading} className="flex-1">
            {loading ? 'Saving...' : saved ? '✅ Saved!' : 'Save Configuration'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

#### 3. Theme Selector (`app/(dashboard)/themes/page.tsx`)

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

const THEMES = [
  {
    id: 'servicenow',
    name: 'ServiceNow (Default)',
    company: null,
    colors: { primary: '#81b5a1', secondary: '#fff' },
    preview: '/themes/servicenow-preview.png'
  },
  {
    id: 'capgemini',
    name: 'Capgemini Blue',
    company: 'capgemini',
    colors: { primary: '#0070AD', secondary: '#00A3E0' },
    preview: '/themes/capgemini-preview.png'
  },
  {
    id: 'ey',
    name: 'EY Yellow',
    company: 'ey',
    colors: { primary: '#FFE600', secondary: '#2E2E38' },
    preview: '/themes/ey-preview.png'
  }
];

export default function ThemesPage() {
  const [selectedTheme, setSelectedTheme] = useState('servicenow');
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    setLoading(true);

    await fetch('/api/themes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('jwt')}`
      },
      body: JSON.stringify({ themeId: selectedTheme })
    });

    setLoading(false);
    alert('✅ Theme applied! Restart SnowCode to see changes.');
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">SnowCode Theme</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {THEMES.map((theme) => (
          <div
            key={theme.id}
            className={`border rounded-lg p-4 cursor-pointer transition ${
              selectedTheme === theme.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
            }`}
            onClick={() => setSelectedTheme(theme.id)}
          >
            <div className="aspect-video bg-gray-100 rounded mb-3 overflow-hidden">
              <div
                className="w-full h-full"
                style={{ backgroundColor: theme.colors.primary }}
              />
            </div>
            <h3 className="font-semibold">{theme.name}</h3>
            <div className="flex gap-2 mt-2">
              <div
                className="w-8 h-8 rounded border"
                style={{ backgroundColor: theme.colors.primary }}
                title={theme.colors.primary}
              />
              <div
                className="w-8 h-8 rounded border"
                style={{ backgroundColor: theme.colors.secondary }}
                title={theme.colors.secondary}
              />
            </div>
          </div>
        ))}
      </div>

      <Button onClick={handleApply} disabled={loading} className="w-full">
        {loading ? 'Applying...' : 'Apply Theme'}
      </Button>
    </div>
  );
}
```

---

## 🔧 CLI Implementation

### `src/cli/login.ts`

```typescript
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const AUTH_FILE = path.join(os.homedir(), '.snow-flow', 'auth.json');
const ENTERPRISE_SERVER = process.env.ENTERPRISE_SERVER_URL || 'https://enterprise.snow-flow.dev';
const PORTAL_URL = process.env.PORTAL_URL || 'https://portal.snow-flow.dev';

export async function loginCommand(licenseKey: string) {
  console.log('🔐 Authenticating with Snow-Flow Enterprise...');

  try {
    // Step 1: Authenticate with enterprise server
    const response = await axios.post(`${ENTERPRISE_SERVER}/api/auth/login`, {
      licenseKey,
      role: 'auto' // Auto-detect from license key
    });

    const { token, tier, company, companyName, features, expiresAt } = response.data;

    // Step 2: Save auth to disk
    await fs.mkdir(path.dirname(AUTH_FILE), { recursive: true });
    await fs.writeFile(
      AUTH_FILE,
      JSON.stringify({
        licenseKey,
        jwt: token,
        expiresAt,
        portalUrl: PORTAL_URL,
        tier,
        company,
        companyName,
        features
      }, null, 2)
    );

    // Step 3: Success message
    console.log('');
    console.log('✅ Logged in successfully!');
    console.log('');
    console.log(`🏢 Company: ${companyName}`);
    console.log(`📦 Tier: ${tier}`);
    console.log(`🎯 Features: ${features.join(', ')}`);
    console.log(`📅 Expires: ${new Date(expiresAt).toLocaleDateString()}`);
    console.log('');
    console.log(`🌐 Configure integrations at: ${PORTAL_URL}`);
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Run: snow-flow portal (opens configuration UI)');
    console.log('   2. Configure Jira, Azure DevOps, Confluence');
    console.log('   3. Select your SnowCode theme');
    console.log('   4. Start using enterprise features in SnowCode!');
    console.log('');
  } catch (error: any) {
    console.error('❌ Login failed:', error.response?.data?.error || error.message);
    process.exit(1);
  }
}

export async function statusCommand() {
  try {
    const authData = JSON.parse(await fs.readFile(AUTH_FILE, 'utf-8'));

    console.log('📊 Snow-Flow Enterprise Status');
    console.log('');
    console.log(`🏢 Company: ${authData.companyName}`);
    console.log(`📦 Tier: ${authData.tier}`);
    console.log(`🎯 Features: ${authData.features.join(', ')}`);
    console.log(`📅 Expires: ${new Date(authData.expiresAt).toLocaleDateString()}`);
    console.log(`🌐 Portal: ${authData.portalUrl}`);
    console.log('');

    // Check token expiry
    const expiresAt = new Date(authData.expiresAt);
    const now = new Date();
    if (expiresAt < now) {
      console.log('⚠️  Your license has expired. Please contact sales@snow-flow.dev');
    } else {
      const daysLeft = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`✅ License valid (${daysLeft} days remaining)`);
    }
  } catch (error) {
    console.log('❌ Not logged in. Run: snow-flow login <license-key>');
  }
}

export async function portalCommand() {
  try {
    const authData = JSON.parse(await fs.readFile(AUTH_FILE, 'utf-8'));

    console.log(`🌐 Opening portal: ${authData.portalUrl}`);

    // Open browser
    const open = require('open');
    await open(`${authData.portalUrl}?token=${authData.jwt}`);
  } catch (error) {
    console.log('❌ Not logged in. Run: snow-flow login <license-key>');
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
```

### Update `src/cli.ts`

```typescript
import { Command } from 'commander';
import { loginCommand, statusCommand, portalCommand, logoutCommand } from './cli/login.js';

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
  .description('Logout from enterprise server')
  .action(logoutCommand);

// ... existing commands

program.parse();
```

---

## 🔄 Complete User Flow

### 1. Installation & Login

```bash
# Install open source
npm install -g snow-flow

# Login with license key
snow-flow login SNOW-ENT-CAPGEMINI-20261231-A3F2E9C1

# Output:
# ✅ Logged in successfully!
# 🏢 Company: Capgemini
# 📦 Tier: enterprise
# 🎯 Features: jira, azure-devops, confluence, sso, audit-logs
# 📅 Expires: Dec 31, 2026
#
# 🌐 Configure integrations at: https://portal.snow-flow.dev
#
# 💡 Next steps:
#    1. Run: snow-flow portal (opens configuration UI)
#    2. Configure Jira, Azure DevOps, Confluence
#    3. Select your SnowCode theme
#    4. Start using enterprise features in SnowCode!
```

### 2. Configure Integrations in Portal

```bash
# Open portal
snow-flow portal

# Browser opens → https://portal.snow-flow.dev
# User logs in (auto with JWT from CLI)
# User navigates to /integrations/jira
# User enters:
#   - Jira URL: https://capgemini.atlassian.net
#   - API Token: [secure token]
#   - Default Project: PROJ
#   - Sync: Bidirectional, every 15 min
#   - AI Parsing: ON
# User clicks "Save Configuration"
# ✅ Saved to enterprise database (encrypted)
```

### 3. Use Enterprise Tools in SnowCode

```bash
# Start SnowCode
snowcode

# SnowCode loads:
# 1. Local MCP servers (235+ ServiceNow tools)
# 2. Remote MCP client (connects to enterprise server)
# 3. JWT from ~/.snow-flow/auth.json
# 4. Enterprise tools now available!

# User prompt:
> Sync Jira project PROJ to ServiceNow incidents table

# Behind the scenes:
# 1. SnowCode calls: jira_sync_backlog_advanced({ project: 'PROJ', table: 'incident' })
# 2. Request sent to enterprise.snow-flow.dev/mcp/sse with JWT
# 3. Enterprise server:
#    a. Validates JWT
#    b. Looks up Jira credentials from database (license_id → integration_credentials)
#    c. Executes sync using stored credentials
#    d. Returns results
# 4. SnowCode shows results to user

# User NEVER had to provide Jira credentials in CLI!
```

### 4. Theme Applied Automatically

```bash
# When SnowCode starts:
# 1. Reads ~/.snow-flow/auth.json
# 2. Sees company: 'capgemini'
# 3. Applies Capgemini blue theme automatically
# 4. User sees SnowCode in Capgemini colors!
```

---

## 🚀 Implementation Timeline

### Week 1: CLI & Authentication
- ✅ Implement `snow-flow login` command
- ✅ Implement `snow-flow status` command
- ✅ Implement `snow-flow portal` command
- ✅ Remove adapter tools from open source
- ✅ Setup auth.json storage

### Week 2: Enterprise Server Core
- ✅ Setup PostgreSQL database
- ✅ Implement authentication API
- ✅ Implement license validation
- ✅ Implement credentials encryption (AES-256)
- ✅ Setup SSE MCP server

### Week 3: Enterprise Portal (Frontend)
- ✅ Setup Next.js project
- ✅ Build login page
- ✅ Build dashboard
- ✅ Build Jira configuration page
- ✅ Build Azure DevOps configuration page
- ✅ Build Confluence configuration page
- ✅ Build theme selector

### Week 4: Enterprise Tools (MCP)
- ✅ Implement credential lookup in tools
- ✅ Build jira_sync_backlog_advanced
- ✅ Build azure_sync_work_items
- ✅ Build confluence_sync_documentation
- ✅ Test end-to-end flow

### Week 5: Deploy & Test
- ✅ Deploy portal to Vercel
- ✅ Deploy enterprise server to Railway/AWS
- ✅ Setup PostgreSQL (Supabase/Neon)
- ✅ Configure DNS (enterprise.snow-flow.dev, portal.snow-flow.dev)
- ✅ Test with Capgemini license
- ✅ Performance testing

---

## 💰 Pricing & Revenue

### Direct Sales
| Tier | Users | Price/Month | Revenue Goal |
|------|-------|-------------|--------------|
| Professional | 5 | €499 | 20 customers = €9,980/month |
| Team | 20 | €999 | 15 customers = €14,985/month |
| Enterprise | Unlimited | €1,999 | 10 customers = €19,990/month |

**Total Direct: ~€45,000/month**

### Service Integrator Partnerships
| Partner | Master License | Customer Licenses | Our Revenue |
|---------|----------------|-------------------|-------------|
| Capgemini | €5,000/month | 20+ (they charge) | €5,000/month |
| EY | €5,000/month | 15+ (they charge) | €5,000/month |
| Deloitte | €5,000/month | 10+ (they charge) | €5,000/month |

**Total Partnerships: €15,000/month**

**TOTAL REVENUE: €60,000/month (€720,000/year)**

---

## ✅ Success Metrics

### Technical KPIs
- Portal uptime: 99.9%
- API response time: <200ms (p95)
- MCP connection success: >99%
- Database encryption: AES-256
- JWT token refresh: automatic

### Business KPIs
- Month 1: 5 beta customers (free)
- Month 3: 20 paying customers
- Month 6: 2 service integrator partnerships
- Month 12: €50k MRR

---

**Status:** 🚀 Final Architecture - Ready to Implement!
**Next Step:** Implement snow-flow login CLI command
