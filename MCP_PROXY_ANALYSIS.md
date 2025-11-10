# Enterprise MCP Proxy - Analyse & Specificatie

## 🎯 Wat is de MCP Proxy?

De **Enterprise MCP Proxy** is een **lokale** component die fungeert als bridge tussen:
- **SnowCode CLI** (stdio MCP protocol) ← lokaal op gebruiker's machine
- **Enterprise License Server** (HTTPS REST API) ← cloud server (GCP)

## 📍 Locatie

**Verwachte locatie:** `enterprise/mcp-proxy/`
**Status:** ❌ NIET GEÏMPLEMENTEERD (alleen gedocumenteerd in architectuur)

## 🔄 Functie

### Primary Rol: Protocol Translator

```
┌─────────────┐  stdio MCP   ┌──────────────┐  HTTPS REST   ┌─────────────────┐
│  SnowCode   │─────────────▶│  MCP Proxy   │──────────────▶│ License Server  │
│  CLI        │◀─────────────│  (LOKAAL)    │◀──────────────│  (CLOUD - GCP)  │
└─────────────┘              └──────────────┘               └─────────────────┘
```

### Wat doet het?

1. **Luistert** naar MCP tool calls van SnowCode via stdio
2. **Leest** configuratie:
   - License key uit `.env`
   - Credentials uit `.env` (optioneel)
   - Enterprise server URL
3. **Vertaalt** MCP requests naar HTTPS API calls
4. **Stuurt** data naar enterprise server:
   - License key voor authenticatie
   - Tool name en arguments
   - Credentials (indien lokaal geconfigureerd)
5. **Ontvangt** response van server
6. **Stuurt terug** naar SnowCode via stdio

## 📦 Verwachte Structuur

```
enterprise/mcp-proxy/
├── enterprise-proxy.ts      # Main proxy implementation
├── package.json             # Dependencies
├── .env.example             # Configuration template
├── README.md                # Setup guide
└── tsconfig.json            # TypeScript config
```

## 🔧 Implementatie Vereisten

### 1. MCP Server Interface (stdio)

De proxy moet zich gedragen als een MCP server voor SnowCode:

```typescript
// Leest van stdin (JSON-RPC format)
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "snow_jira_create_issue",
    "arguments": {
      "project": "SNOW",
      "summary": "Bug fix needed",
      "issueType": "Bug"
    }
  }
}

// Schrijft naar stdout (JSON-RPC format)
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Created Jira issue SNOW-123"
      }
    ]
  }
}
```

### 2. HTTPS Client (naar enterprise server)

```typescript
// POST https://license-server.run.app/mcp/tools/call
{
  headers: {
    "Authorization": "Bearer SNOW-ENT-CUST-ABC123",
    "Content-Type": "application/json",
    "X-Instance-ID": "machine-fingerprint-123",
    "X-Snow-Flow-Version": "8.2.0"
  },
  body: {
    "tool": "jira_create_issue",
    "arguments": {
      "project": "SNOW",
      "summary": "Bug fix needed",
      "issueType": "Bug"
    },
    "credentials": {  // Optioneel
      "jira": {
        "host": "https://company.atlassian.net",
        "email": "user@company.com",
        "apiToken": "ATATT3xFfGF..."
      }
    }
  }
}
```

### 3. Configuratie (.env)

```bash
# Enterprise Server
SNOW_ENTERPRISE_URL=https://license-server.run.app
SNOW_LICENSE_KEY=SNOW-ENT-CUST-ABC123

# Optioneel: Lokale credentials (anders server-side)
JIRA_HOST=https://company.atlassian.net
JIRA_EMAIL=user@company.com
JIRA_API_TOKEN=ATATT3xFfGF...

AZURE_DEVOPS_ORG=mycompany
AZURE_DEVOPS_PAT=xxxxxxxxxxxxxxxx

CONFLUENCE_HOST=https://company.atlassian.net
CONFLUENCE_EMAIL=user@company.com
CONFLUENCE_API_TOKEN=ATATT3xFfGF...
```

## 🎭 Twee Deployment Modi

### Modus 1: Lokale Credentials

```typescript
// Gebruiker configureert credentials in .env
// Proxy stuurt deze mee naar server
// Server gebruikt deze voor API calls
// ⚠️ Credentials gaan over de wire (encrypted HTTPS)
```

**Voordelen:**
- ✅ Simpele setup
- ✅ Geen server-side configuratie nodig

**Nadelen:**
- ❌ Credentials in requests (zelfs encrypted)
- ❌ Geen auto-refresh van tokens
- ❌ Gebruiker moet tokens beheren

### Modus 2: Server-Side Credentials

```typescript
// Server heeft credentials encrypted in database
// Proxy stuurt GEEN credentials mee
// Server gebruikt eigen credentials
// ✅ Credentials blijven server-side
```

**Voordelen:**
- ✅ Veiligste optie
- ✅ Auto-refresh van tokens
- ✅ Centraal beheer
- ✅ Compliance-vriendelijk

**Nadelen:**
- ❌ Complexere setup (SSO login vereist)
- ❌ Admin moet credentials configureren

## 📊 Data Flow Voorbeeld: Jira Tool Call

### Stap 1: SnowCode → MCP Proxy (stdio)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "snow_jira_create_issue",
    "arguments": {
      "project": "SNOW",
      "summary": "Login button broken",
      "issueType": "Bug"
    }
  }
}
```

### Stap 2: MCP Proxy → Enterprise Server (HTTPS)

```http
POST https://license-server.run.app/mcp/tools/call
Authorization: Bearer SNOW-ENT-CUST-ABC123
Content-Type: application/json
X-Instance-ID: machine-fingerprint-123
X-Snow-Flow-Version: 8.2.0

{
  "tool": "jira_create_issue",
  "arguments": {
    "project": "SNOW",
    "summary": "Login button broken",
    "issueType": "Bug"
  },
  "credentials": {
    "jira": {
      "host": "https://company.atlassian.net",
      "email": "user@company.com",
      "apiToken": "ATATT3xFfGF..."
    }
  }
}
```

### Stap 3: Enterprise Server → Jira API (HTTPS)

```http
POST https://company.atlassian.net/rest/api/3/issue
Authorization: Basic dXNlckBjb21wYW55LmNvbTpBVEFUVDN4RmZHRi4uLg==
Content-Type: application/json

{
  "fields": {
    "project": { "key": "SNOW" },
    "summary": "Login button broken",
    "issuetype": { "name": "Bug" }
  }
}
```

### Stap 4: Jira API → Enterprise Server

```json
{
  "key": "SNOW-123",
  "self": "https://company.atlassian.net/rest/api/3/issue/10042"
}
```

### Stap 5: Enterprise Server → MCP Proxy

```json
{
  "success": true,
  "tool": "jira_create_issue",
  "result": {
    "key": "SNOW-123",
    "url": "https://company.atlassian.net/browse/SNOW-123"
  },
  "usage": {
    "duration_ms": 342,
    "timestamp": "2025-11-09T10:00:00Z"
  }
}
```

### Stap 6: MCP Proxy → SnowCode (stdio)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "✅ Created Jira issue SNOW-123\n\nView: https://company.atlassian.net/browse/SNOW-123"
      }
    ],
    "metadata": {
      "tool": "jira_create_issue",
      "duration_ms": 342
    }
  }
}
```

## 🔐 Security Overwegingen

### License Key Authenticatie

```typescript
// Proxy leest license key uit .env
const licenseKey = process.env.SNOW_LICENSE_KEY

// Stuurt mee in Authorization header
headers: {
  "Authorization": `Bearer ${licenseKey}`
}

// Server valideert:
// 1. Format correct? (SNOW-ENT-CUST-[A-Z0-9]{6})
// 2. Customer exists?
// 3. Status = active?
// 4. Not expired?
```

### Credentials Management

**Optie 1: Client-side (in request)**
```typescript
// ⚠️ Credentials gaan over de wire
// ✅ Encrypted via HTTPS
// ❌ Visible in logs (server-side redaction!)
```

**Optie 2: Server-side (in database)**
```typescript
// ✅ Credentials blijven server-side
// ✅ AES-256-GCM encrypted
// ✅ Auto-refresh
// ✅ Audit logging
```

### Rate Limiting

```typescript
// Server enforces rate limits per customer
// 100 requests / 15 minutes
// Proxy moet graceful failures afhandelen:

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 8 minutes.",
    "retry_after": 480
  }
}
```

## 🛠️ Technische Stack

### Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",  // MCP protocol
    "axios": "^1.6.0",                       // HTTPS client
    "dotenv": "^16.0.0",                     // .env parsing
    "node-machine-id": "^1.1.12"             // Instance fingerprinting
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

### Entry Point

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import axios from 'axios';
import dotenv from 'dotenv';
import { machineIdSync } from 'node-machine-id';

dotenv.config();

const ENTERPRISE_URL = process.env.SNOW_ENTERPRISE_URL;
const LICENSE_KEY = process.env.SNOW_LICENSE_KEY;
const VERSION = '8.2.0'; // Snow-Flow version
const INSTANCE_ID = machineIdSync();

// MCP Server setup
const server = new Server(
  {
    name: 'snow-flow-enterprise-proxy',
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register enterprise tools
server.setRequestHandler('tools/list', async () => {
  const response = await axios.get(`${ENTERPRISE_URL}/mcp/tools/list`, {
    headers: {
      'Authorization': `Bearer ${LICENSE_KEY}`,
      'X-Instance-ID': INSTANCE_ID,
      'X-Snow-Flow-Version': VERSION,
    }
  });
  
  return response.data;
});

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  // Gather credentials from .env
  const credentials = gatherCredentials(name);
  
  // Forward to enterprise server
  const response = await axios.post(`${ENTERPRISE_URL}/mcp/tools/call`, {
    tool: name,
    arguments: args,
    credentials,
  }, {
    headers: {
      'Authorization': `Bearer ${LICENSE_KEY}`,
      'Content-Type': 'application/json',
      'X-Instance-ID': INSTANCE_ID,
      'X-Snow-Flow-Version': VERSION,
    },
    timeout: 120000, // 2 minutes
  });
  
  return response.data;
});

// Start stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

## 📝 SnowCode Configuratie

In `.snowcode/config.json`:

```json
{
  "mcpServers": {
    "servicenow-unified": {
      "command": "node",
      "args": ["dist/mcp/servicenow-mcp-unified/index.js"],
      "env": {
        "SNOW_INSTANCE": "dev123456.service-now.com",
        "SNOW_CLIENT_ID": "...",
        "SNOW_CLIENT_SECRET": "..."
      }
    },
    "snow-flow-enterprise": {
      "command": "node",
      "args": ["enterprise/mcp-proxy/enterprise-proxy.js"],
      "env": {
        "SNOW_ENTERPRISE_URL": "https://license-server.run.app",
        "SNOW_LICENSE_KEY": "SNOW-ENT-CUST-ABC123",
        "JIRA_HOST": "https://company.atlassian.net",
        "JIRA_EMAIL": "user@company.com",
        "JIRA_API_TOKEN": "..."
      }
    }
  }
}
```

## 🎯 Waarom is dit nodig?

### Probleem: Protocol Mismatch

- **SnowCode CLI** spreekt alleen **stdio MCP protocol**
- **Enterprise Server** spreekt alleen **HTTPS REST API**
- Deze twee kunnen niet direct met elkaar praten!

### Oplossing: MCP Proxy als Bridge

```
┌─────────────────────────────────────────────────────────┐
│  SnowCode CLI kan ALLEEN stdio MCP                     │
│  ↓                                                       │
│  MCP Proxy vertaalt stdio → HTTPS                      │
│  ↓                                                       │
│  Enterprise Server krijgt HTTPS REST calls             │
└─────────────────────────────────────────────────────────┘
```

### Alternatief (zonder proxy):

❌ **Niet mogelijk!** SnowCode CLI heeft GEEN ingebouwde HTTPS client voor enterprise tools.

## ✅ Conclusie

### Huidige Status

- ❌ MCP Proxy is **NIET** geïmplementeerd
- ✅ Architectuur is **WEL** volledig gedocumenteerd
- ✅ Data flows zijn **WEL** gespecificeerd
- ✅ Enterprise server implementatie bestaat waarschijnlijk WEL (license-server)

### Volgende Stappen

1. **Implementeer** `enterprise/mcp-proxy/enterprise-proxy.ts`
2. **Test** met mock enterprise server
3. **Integreer** met SnowCode configuratie
4. **Documenteer** setup guide voor gebruikers

### Prioriteit

**MEDIUM** - Nodig voor enterprise features (Jira/Azure/Confluence), maar:
- Open source features werken zonder proxy
- ServiceNow tools werken zonder proxy
- Alleen enterprise integrations hebben dit nodig
