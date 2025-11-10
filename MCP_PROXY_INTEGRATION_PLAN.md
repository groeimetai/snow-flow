# MCP Proxy Integration Plan

## 🎯 Architectuur Beslissing

**Vraag:** Waar moet de MCP Proxy gebouwd worden?
**Antwoord:** ✅ **In Snow-Flow repository (open source)**

**Locatie:** `snow-flow/src/mcp/enterprise-proxy/`

## 🔄 Activatie Flow

### Scenario 1: Gebruiker zonder Enterprise License

```bash
$ snow-flow auth login

? ServiceNow Instance: dev123456.service-now.com
? Authentication Method: OAuth2
✓ Authenticated with ServiceNow

? Do you have a Snow-Flow Enterprise license? (y/N) N
✓ Setup complete! ServiceNow tools available.

# .snowcode/config.json wordt NIET aangepast met enterprise proxy
```

### Scenario 2: Gebruiker met Enterprise License

```bash
$ snow-flow auth login

? ServiceNow Instance: dev123456.service-now.com
? Authentication Method: OAuth2
✓ Authenticated with ServiceNow

? Do you have a Snow-Flow Enterprise license? (y/N) y
? Enterprise License Key: SNOW-ENT-CUST-ABC123

🔄 Validating license key...
✓ License key valid
✓ Enterprise features enabled: Jira, Azure DevOps, Confluence

? Configure credentials (local or server-side)? local
? Jira Host: https://company.atlassian.net
? Jira Email: user@company.com
? Jira API Token: ••••••••••••••••

✓ Enterprise MCP Proxy configured
✓ .snowcode/config.json updated

Available enterprise tools:
  - snow_jira_create_issue
  - snow_jira_update_issue
  - snow_azure_create_work_item
  - snow_confluence_create_page
  ... (and 23 more)
```

## 📝 .snowcode/config.json Update

### Voor Enterprise (automatisch toegevoegd):

```json
{
  "mcpServers": {
    "servicenow-unified": {
      "command": "node",
      "args": ["node_modules/snow-flow/dist/mcp/servicenow-mcp-unified/index.js"],
      "env": {
        "SNOW_INSTANCE": "dev123456.service-now.com",
        "SNOW_CLIENT_ID": "...",
        "SNOW_CLIENT_SECRET": "..."
      }
    },
    "snow-flow-enterprise": {
      "command": "node",
      "args": ["node_modules/snow-flow/dist/mcp/enterprise-proxy/index.js"],
      "env": {
        "SNOW_ENTERPRISE_URL": "https://license-server.run.app",
        "SNOW_LICENSE_KEY": "SNOW-ENT-CUST-ABC123",
        "JIRA_HOST": "https://company.atlassian.net",
        "JIRA_EMAIL": "user@company.com",
        "JIRA_API_TOKEN": "ATATT3xFfGF...",
        "AZURE_DEVOPS_ORG": "mycompany",
        "AZURE_DEVOPS_PAT": "...",
        "CONFLUENCE_HOST": "https://company.atlassian.net",
        "CONFLUENCE_EMAIL": "user@company.com",
        "CONFLUENCE_API_TOKEN": "..."
      }
    }
  }
}
```

## 🛠️ Implementatie Plan

### 1. Directory Structuur

```
snow-flow/
├── src/
│   ├── cli/
│   │   └── auth.ts                    ← Update: enterprise license flow
│   ├── mcp/
│   │   ├── servicenow-mcp-unified/    ← Bestaand (open source)
│   │   │   └── index.ts
│   │   └── enterprise-proxy/          ← NIEUW (open source)
│   │       ├── index.ts               ← MCP Server entry point
│   │       ├── proxy.ts               ← stdio → HTTPS translator
│   │       ├── credentials.ts         ← .env credential gathering
│   │       ├── types.ts               ← TypeScript types
│   │       └── README.md              ← Setup guide
│   └── config/
│       └── snowcode-config.ts         ← Update: enterprise MCP toevoegen
└── package.json
```

### 2. Code Changes

#### A. `src/cli/auth.ts` - Enterprise License Flow

```typescript
// src/cli/auth.ts

export async function login() {
  // Existing ServiceNow auth...
  await authenticateServiceNow();
  
  // NEW: Enterprise license prompt
  const hasEnterprise = await confirm({
    message: 'Do you have a Snow-Flow Enterprise license?',
    default: false
  });
  
  if (!hasEnterprise) {
    console.log('✓ Setup complete! ServiceNow tools available.');
    return;
  }
  
  // Prompt for license key
  const licenseKey = await input({
    message: 'Enterprise License Key:',
    validate: (value) => {
      if (!/^SNOW-ENT-CUST-[A-Z0-9]{6}$/.test(value)) {
        return 'Invalid license key format';
      }
      return true;
    }
  });
  
  // Validate license key with enterprise server
  console.log('🔄 Validating license key...');
  const validation = await validateLicenseKey(licenseKey);
  
  if (!validation.valid) {
    throw new Error(`License validation failed: ${validation.error}`);
  }
  
  console.log('✓ License key valid');
  console.log(`✓ Enterprise features enabled: ${validation.features.join(', ')}`);
  
  // Prompt for credentials
  const credentialMode = await select({
    message: 'Configure credentials (local or server-side)?',
    choices: [
      { name: 'Local (.env file)', value: 'local' },
      { name: 'Server-side (encrypted, requires SSO)', value: 'server' }
    ]
  });
  
  let credentials = {};
  if (credentialMode === 'local') {
    credentials = await promptForCredentials(validation.features);
  } else {
    console.log('⚠️  Server-side credentials require SSO configuration.');
    console.log(`   Visit: ${process.env.SNOW_ENTERPRISE_URL}/sso/login`);
  }
  
  // Update .snowcode/config.json
  await addEnterpriseMcpServer({
    licenseKey,
    credentials,
    enterpriseUrl: validation.serverUrl
  });
  
  console.log('✓ Enterprise MCP Proxy configured');
  console.log('✓ .snowcode/config.json updated');
  
  // List available tools
  const tools = await fetchEnterpriseTool(licenseKey);
  console.log('\nAvailable enterprise tools:');
  tools.slice(0, 5).forEach(tool => {
    console.log(`  - ${tool.name}`);
  });
  console.log(`  ... (and ${tools.length - 5} more)`);
}

async function validateLicenseKey(licenseKey: string) {
  const response = await fetch(`${ENTERPRISE_URL}/api/license/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${licenseKey}`
    }
  });
  
  return await response.json();
}

async function promptForCredentials(features: string[]) {
  const credentials: any = {};
  
  if (features.includes('Jira')) {
    credentials.jira = {
      host: await input({ message: 'Jira Host:' }),
      email: await input({ message: 'Jira Email:' }),
      apiToken: await password({ message: 'Jira API Token:' })
    };
  }
  
  if (features.includes('Azure DevOps')) {
    credentials.azure = {
      org: await input({ message: 'Azure DevOps Organization:' }),
      pat: await password({ message: 'Azure DevOps PAT:' })
    };
  }
  
  if (features.includes('Confluence')) {
    credentials.confluence = {
      host: await input({ message: 'Confluence Host:' }),
      email: await input({ message: 'Confluence Email:' }),
      apiToken: await password({ message: 'Confluence API Token:' })
    };
  }
  
  return credentials;
}
```

#### B. `src/config/snowcode-config.ts` - Config Update

```typescript
// src/config/snowcode-config.ts

import fs from 'fs';
import path from 'path';
import os from 'os';

const SNOWCODE_CONFIG_PATH = path.join(os.homedir(), '.snowcode', 'config.json');

export async function addEnterpriseMcpServer(options: {
  licenseKey: string;
  credentials: any;
  enterpriseUrl: string;
}) {
  // Read existing config
  let config: any = { mcpServers: {} };
  if (fs.existsSync(SNOWCODE_CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(SNOWCODE_CONFIG_PATH, 'utf8'));
  }
  
  // Ensure mcpServers exists
  if (!config.mcpServers) {
    config.mcpServers = {};
  }
  
  // Get path to enterprise proxy (relative to snow-flow installation)
  const snowFlowPath = path.dirname(require.resolve('snow-flow/package.json'));
  const proxyPath = path.join(snowFlowPath, 'dist/mcp/enterprise-proxy/index.js');
  
  // Build environment variables
  const env: Record<string, string> = {
    SNOW_ENTERPRISE_URL: options.enterpriseUrl,
    SNOW_LICENSE_KEY: options.licenseKey
  };
  
  // Add credentials if provided
  if (options.credentials.jira) {
    env.JIRA_HOST = options.credentials.jira.host;
    env.JIRA_EMAIL = options.credentials.jira.email;
    env.JIRA_API_TOKEN = options.credentials.jira.apiToken;
  }
  
  if (options.credentials.azure) {
    env.AZURE_DEVOPS_ORG = options.credentials.azure.org;
    env.AZURE_DEVOPS_PAT = options.credentials.azure.pat;
  }
  
  if (options.credentials.confluence) {
    env.CONFLUENCE_HOST = options.credentials.confluence.host;
    env.CONFLUENCE_EMAIL = options.credentials.confluence.email;
    env.CONFLUENCE_API_TOKEN = options.credentials.confluence.apiToken;
  }
  
  // Add enterprise MCP server
  config.mcpServers['snow-flow-enterprise'] = {
    command: 'node',
    args: [proxyPath],
    env
  };
  
  // Write config
  fs.mkdirSync(path.dirname(SNOWCODE_CONFIG_PATH), { recursive: true });
  fs.writeFileSync(SNOWCODE_CONFIG_PATH, JSON.stringify(config, null, 2));
}

export async function removeEnterpriseMcpServer() {
  if (!fs.existsSync(SNOWCODE_CONFIG_PATH)) return;
  
  const config = JSON.parse(fs.readFileSync(SNOWCODE_CONFIG_PATH, 'utf8'));
  
  if (config.mcpServers?.['snow-flow-enterprise']) {
    delete config.mcpServers['snow-flow-enterprise'];
    fs.writeFileSync(SNOWCODE_CONFIG_PATH, JSON.stringify(config, null, 2));
  }
}
```

#### C. `src/mcp/enterprise-proxy/index.ts` - MCP Server

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { proxyToolCall, listEnterpriseTools } from './proxy.js';

// Create MCP server
const server = new Server(
  {
    name: 'snow-flow-enterprise-proxy',
    version: '8.30.31',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = await listEnterpriseTools();
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    const result = await proxyToolCall(name, args);
    
    return {
      content: [
        {
          type: 'text',
          text: result.text || JSON.stringify(result, null, 2)
        }
      ],
      isError: false
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
});

// Start server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('Snow-Flow Enterprise MCP Proxy started');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

#### D. `src/mcp/enterprise-proxy/proxy.ts` - HTTPS Client

```typescript
import axios from 'axios';
import { machineIdSync } from 'node-machine-id';
import { gatherCredentials } from './credentials.js';

const ENTERPRISE_URL = process.env.SNOW_ENTERPRISE_URL || 'https://license-server.run.app';
const LICENSE_KEY = process.env.SNOW_LICENSE_KEY;
const VERSION = '8.30.31';
const INSTANCE_ID = machineIdSync();

export async function listEnterpriseTools() {
  if (!LICENSE_KEY) {
    throw new Error('SNOW_LICENSE_KEY not configured');
  }
  
  const response = await axios.get(`${ENTERPRISE_URL}/mcp/tools/list`, {
    headers: {
      'Authorization': `Bearer ${LICENSE_KEY}`,
      'X-Instance-ID': INSTANCE_ID,
      'X-Snow-Flow-Version': VERSION,
    }
  });
  
  return response.data.tools || [];
}

export async function proxyToolCall(toolName: string, args: any) {
  if (!LICENSE_KEY) {
    throw new Error('SNOW_LICENSE_KEY not configured');
  }
  
  // Gather credentials from environment
  const credentials = gatherCredentials(toolName);
  
  // Forward to enterprise server
  const response = await axios.post(
    `${ENTERPRISE_URL}/mcp/tools/call`,
    {
      tool: toolName,
      arguments: args,
      credentials
    },
    {
      headers: {
        'Authorization': `Bearer ${LICENSE_KEY}`,
        'Content-Type': 'application/json',
        'X-Instance-ID': INSTANCE_ID,
        'X-Snow-Flow-Version': VERSION,
      },
      timeout: 120000, // 2 minutes
    }
  );
  
  if (!response.data.success) {
    throw new Error(response.data.error || 'Tool execution failed');
  }
  
  return response.data.result;
}
```

#### E. `src/mcp/enterprise-proxy/credentials.ts` - Credential Gathering

```typescript
export function gatherCredentials(toolName: string): Record<string, any> {
  const credentials: Record<string, any> = {};
  
  // Jira tools
  if (toolName.startsWith('snow_jira_')) {
    if (process.env.JIRA_HOST) {
      credentials.jira = {
        host: process.env.JIRA_HOST,
        email: process.env.JIRA_EMAIL,
        apiToken: process.env.JIRA_API_TOKEN
      };
    }
  }
  
  // Azure DevOps tools
  if (toolName.startsWith('snow_azure_')) {
    if (process.env.AZURE_DEVOPS_ORG) {
      credentials.azure = {
        organization: process.env.AZURE_DEVOPS_ORG,
        pat: process.env.AZURE_DEVOPS_PAT
      };
    }
  }
  
  // Confluence tools
  if (toolName.startsWith('snow_confluence_')) {
    if (process.env.CONFLUENCE_HOST) {
      credentials.confluence = {
        host: process.env.CONFLUENCE_HOST,
        email: process.env.CONFLUENCE_EMAIL,
        apiToken: process.env.CONFLUENCE_API_TOKEN
      };
    }
  }
  
  return credentials;
}
```

## 🔄 User Journey

### Complete Flow

```
1. User: npm install -g snow-flow
   ↓
2. User: snow-flow auth login
   ↓
3. Snow-Flow prompts:
   - ServiceNow credentials ✓
   - Enterprise license? → YES
   - License key: SNOW-ENT-CUST-ABC123
   - Credentials mode: Local
   - Jira credentials...
   - Azure credentials...
   ↓
4. Snow-Flow:
   - Validates license with server
   - Writes .snowcode/config.json
   - Adds enterprise MCP server entry
   ↓
5. User: snowcode (launches SnowCode CLI)
   ↓
6. SnowCode:
   - Reads .snowcode/config.json
   - Starts servicenow-unified MCP server
   - Starts snow-flow-enterprise MCP server ← NEW!
   ↓
7. User in SnowCode: "Create Jira ticket for this bug"
   ↓
8. Claude calls: snow_jira_create_issue via MCP
   ↓
9. Enterprise MCP Proxy:
   - Receives stdio request
   - Reads license key + credentials from env
   - Makes HTTPS call to enterprise server
   - Returns response via stdio
   ↓
10. SnowCode shows: "Created Jira issue SNOW-123"
```

## 📦 Package Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "axios": "^1.6.0",
    "node-machine-id": "^1.1.12",
    "@inquirer/prompts": "^3.0.0"
  }
}
```

## 🎯 Summary

**Waar?** 
- ✅ `snow-flow` repository (open source)
- ✅ Locatie: `src/mcp/enterprise-proxy/`

**Wanneer geactiveerd?**
- ✅ Tijdens `snow-flow auth login`
- ✅ Wanneer gebruiker enterprise license key opgeeft
- ✅ Automatisch toegevoegd aan `.snowcode/config.json`

**Wat gebeurt er?**
- ✅ Gebruiker wordt gevraagd om license key
- ✅ License key wordt gevalideerd met enterprise server
- ✅ Credentials worden opgevraagd (lokaal of server-side)
- ✅ MCP proxy wordt toegevoegd aan SnowCode config
- ✅ Bij volgende SnowCode start: enterprise tools beschikbaar!

**Voordelen:**
- ✅ Seamless integration (één keer configureren)
- ✅ Automatische activatie
- ✅ Geen handmatige config edits nodig
- ✅ Backwards compatible (werkt zonder enterprise license)
