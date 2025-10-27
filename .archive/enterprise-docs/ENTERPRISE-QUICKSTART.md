# Enterprise Features Quick Start Guide

**Version:** 1.0
**Date:** October 27, 2025

---

## 🚀 Quick Start: Testing Enterprise Features

### Prerequisites

1. **Two Repositories:**
   - `snow-flow` (open source, you have this)
   - `snow-flow-enterprise` (private, needs to be created)

2. **Node.js Environment:**
   - Node.js ≥18
   - npm ≥8

---

## Step 1: Create Enterprise Repository

```bash
# Create private repository
cd ~/projects
git clone https://github.com/groeimetai/snow-flow-enterprise.git
cd snow-flow-enterprise

# Initialize project
npm init -y

# Install dependencies
npm install express axios jsonwebtoken @modelcontextprotocol/sdk
npm install -D typescript @types/express @types/node @types/jsonwebtoken

# Setup TypeScript
npx tsc --init
```

**package.json:**
```json
{
  "name": "@snow-flow/enterprise",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsc && node dist/index.js",
    "start": "node dist/index.js"
  }
}
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Step 2: Implement Basic Enterprise Server

**Create file structure:**
```bash
mkdir -p src/{auth,server,tools/jira,tools/azure,tools/confluence}
touch src/index.ts
touch src/auth/enterprise-validator.ts
touch src/auth/jwt-manager.ts
touch src/server/enterprise-mcp-server.ts
touch src/server/auth-routes.ts
```

**Copy implementations from ENTERPRISE-INTEGRATION-PLAN.md into respective files**

**src/index.ts:**
```typescript
import express from 'express';
import { EnterpriseMCPServer } from './server/enterprise-mcp-server.js';
import { authRouter } from './server/auth-routes.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000');

// Setup auth routes
app.use('/auth', authRouter);

// Initialize MCP server
const mcpServer = new EnterpriseMCPServer();
mcpServer.start(PORT);

console.log(`
╔══════════════════════════════════════════════════════════╗
║  Snow-Flow Enterprise Server                             ║
║  Version: 1.0.0                                          ║
║                                                          ║
║  🌐 Server: http://localhost:${PORT}                     ║
║  🔐 Auth:   http://localhost:${PORT}/auth/login          ║
║  🔌 MCP:    http://localhost:${PORT}/mcp/sse             ║
║  ❤️  Health: http://localhost:${PORT}/health             ║
╚══════════════════════════════════════════════════════════╝
`);
```

**.env:**
```bash
NODE_ENV=development
PORT=3000
JWT_SECRET=dev-secret-change-in-production

# Optional: Pre-configure integration credentials
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_AUTH_TOKEN=your-token-here

AZURE_DEVOPS_ORG=your-org
AZURE_DEVOPS_PAT=your-pat-here

CONFLUENCE_BASE_URL=https://yourcompany.atlassian.net/wiki
CONFLUENCE_AUTH_TOKEN=your-token-here
```

---

## Step 3: Generate Test License Keys

**Create helper script: `scripts/generate-licenses.ts`**

```typescript
import { generateSampleLicenseKey } from '../src/auth/enterprise-validator.js';

// Service Integrator Licenses (Master Keys)
const capgeminiLicense = generateSampleLicenseKey('ENT', 'CAPGEMINI', 365);
const eyLicense = generateSampleLicenseKey('ENT', 'EY', 365);
const deloitteLicense = generateSampleLicenseKey('ENT', 'DELOITTE', 365);

// Customer Licenses (Delegated from Capgemini)
const customerLicense = generateSampleLicenseKey('ENT', 'CAPGEMINI-CLIENT123', 180);

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  Snow-Flow Enterprise License Keys (TEST)                ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');
console.log('🏢 SERVICE INTEGRATOR LICENSES (Master Keys):');
console.log('');
console.log('Capgemini:');
console.log(`  ${capgeminiLicense}`);
console.log('  Role: integrator');
console.log('  Access: ALL instances');
console.log('  Features: jira, azure-devops, confluence, sso, audit-logs');
console.log('');
console.log('EY:');
console.log(`  ${eyLicense}`);
console.log('');
console.log('Deloitte:');
console.log(`  ${deloitteLicense}`);
console.log('');
console.log('─────────────────────────────────────────────────────────');
console.log('');
console.log('👤 CUSTOMER LICENSES (Delegated):');
console.log('');
console.log('Client123 (via Capgemini):');
console.log(`  ${customerLicense}`);
console.log('  Role: customer');
console.log('  Access: client123.service-now.com ONLY');
console.log('  Features: jira, azure-devops, confluence (no SSO/audit)');
console.log('');
console.log('─────────────────────────────────────────────────────────');
console.log('');
console.log('💡 USAGE:');
console.log('');
console.log('# Set in snow-flow/.env:');
console.log(`export SNOW_FLOW_LICENSE_KEY="${capgeminiLicense}"`);
console.log('');
console.log('# Or for customer:');
console.log(`export SNOW_FLOW_LICENSE_KEY="${customerLicense}"`);
console.log('export SERVICENOW_INSTANCE_URL="https://client123.service-now.com"');
console.log('');
```

**Run it:**
```bash
npm run build
node dist/scripts/generate-licenses.js
```

---

## Step 4: Test Enterprise Server Locally

### Terminal 1: Start Enterprise Server

```bash
cd snow-flow-enterprise
npm run dev
```

You should see:
```
╔══════════════════════════════════════════════════════════╗
║  Snow-Flow Enterprise Server                             ║
║  Version: 1.0.0                                          ║
║                                                          ║
║  🌐 Server: http://localhost:3000                       ║
║  🔐 Auth:   http://localhost:3000/auth/login            ║
║  🔌 MCP:    http://localhost:3000/mcp/sse               ║
║  ❤️  Health: http://localhost:3000/health               ║
╚══════════════════════════════════════════════════════════╝
```

### Terminal 2: Test Authentication

**Test as Service Integrator (Capgemini):**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "SNOW-ENT-CAPGEMINI-20261027-A3F2E9C1",
    "role": "integrator"
  }'
```

**Expected Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tier": "enterprise",
  "company": "capgemini",
  "companyName": "Capgemini",
  "features": ["jira", "azure-devops", "confluence", "sso", "audit-logs"],
  "expiresAt": "2026-10-27T12:00:00Z",
  "allowedInstances": ["*"]
}
```

**Test as Customer:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "SNOW-ENT-CAPGEMINI-CLIENT123-20251027-B4E1F3D2",
    "role": "customer",
    "instanceUrl": "https://client123.service-now.com"
  }'
```

**Expected Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tier": "enterprise",
  "company": "capgemini",
  "companyName": "Capgemini",
  "features": ["jira", "azure-devops", "confluence"],
  "expiresAt": "2026-04-25T12:00:00Z",
  "allowedInstances": ["https://client123.service-now.com"]
}
```

### Terminal 3: Test MCP Connection

**Create test script: `test-mcp-connection.js`**

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import axios from 'axios';

async function testEnterpriseMCP() {
  // Step 1: Login and get token
  console.log('🔐 Authenticating...');
  const authResponse = await axios.post('http://localhost:3000/auth/login', {
    licenseKey: 'SNOW-ENT-CAPGEMINI-20261027-A3F2E9C1',
    role: 'integrator'
  });

  const token = authResponse.data.token;
  console.log('✅ Authenticated as:', authResponse.data.companyName);
  console.log('📦 Features:', authResponse.data.features.join(', '));
  console.log('');

  // Step 2: Connect to MCP server
  console.log('🔌 Connecting to MCP server...');
  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  const transport = new SSEClientTransport(
    new URL('http://localhost:3000/mcp/sse'),
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  await client.connect(transport);
  console.log('✅ Connected to enterprise MCP server');
  console.log('');

  // Step 3: List available tools
  console.log('🛠️  Listing available enterprise tools...');
  const toolsResponse = await client.listTools();
  console.log('Available tools:', toolsResponse.tools.length);
  console.log('');

  toolsResponse.tools.forEach(tool => {
    console.log(`  • ${tool.name}`);
    console.log(`    ${tool.description}`);
  });

  await client.close();
  console.log('');
  console.log('✅ Test completed successfully!');
}

testEnterpriseMCP().catch(console.error);
```

**Run it:**
```bash
cd snow-flow-enterprise
node test-mcp-connection.js
```

**Expected Output:**
```
🔐 Authenticating...
✅ Authenticated as: Capgemini
📦 Features: jira, azure-devops, confluence, sso, audit-logs

🔌 Connecting to MCP server...
✅ Connected to enterprise MCP server

🛠️  Listing available enterprise tools...
Available tools: 3

  • jira_sync_backlog
    Sync Jira backlog to ServiceNow
  • azure_sync_work_items
    Sync Azure DevOps work items to ServiceNow
  • confluence_sync_docs
    Sync Confluence documentation to ServiceNow knowledge

✅ Test completed successfully!
```

---

## Step 5: Integrate with SnowCode

### Configure SnowCode to use enterprise server

**In snow-flow/.env:**
```bash
# Your ServiceNow instance
SERVICENOW_INSTANCE_URL=https://yourinstance.service-now.com
SERVICENOW_CLIENT_ID=your-client-id
SERVICENOW_CLIENT_SECRET=your-client-secret

# Enterprise license (Capgemini integrator)
SNOW_FLOW_LICENSE_KEY=SNOW-ENT-CAPGEMINI-20261027-A3F2E9C1

# Enterprise server URL (local for testing)
ENTERPRISE_SERVER_URL=http://localhost:3000
```

**Update .mcp.json:**
```json
{
  "servers": {
    "servicenow-unified": {
      "command": "node",
      "args": ["/Users/nielsvanderwerf/snow-flow/dist/mcp/servicenow-mcp-unified/index.js"],
      "env": {
        "SERVICENOW_INSTANCE_URL": "https://yourinstance.service-now.com",
        "SERVICENOW_CLIENT_ID": "your-client-id",
        "SERVICENOW_CLIENT_SECRET": "your-client-secret"
      }
    },
    "snow-flow-enterprise": {
      "command": "node",
      "args": ["/Users/nielsvanderwerf/snow-flow/dist/mcp/clients/enterprise-remote-client.js"],
      "env": {
        "SNOW_FLOW_LICENSE_KEY": "SNOW-ENT-CAPGEMINI-20261027-A3F2E9C1",
        "ENTERPRISE_SERVER_URL": "http://localhost:3000",
        "ROLE": "integrator"
      }
    }
  }
}
```

**Test in SnowCode:**
```bash
# Start SnowCode
cd snow-flow
snowcode

# In SnowCode prompt:
> Use the jira_sync_backlog tool to sync PROJECT-123 to incident table

# SnowCode will:
# 1. Detect enterprise license
# 2. Connect to http://localhost:3000
# 3. Authenticate as Capgemini integrator
# 4. Call jira_sync_backlog tool
# 5. Return results
```

---

## Step 6: Test Customer vs Integrator Access

### Test 1: Integrator Access (Unlimited)

```bash
# Set integrator license
export SNOW_FLOW_LICENSE_KEY="SNOW-ENT-CAPGEMINI-20261027-A3F2E9C1"

# Test access to instance 1
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "'"$SNOW_FLOW_LICENSE_KEY"'",
    "role": "integrator",
    "instanceUrl": "https://instance1.service-now.com"
  }'
# ✅ Should succeed

# Test access to instance 2
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "'"$SNOW_FLOW_LICENSE_KEY"'",
    "role": "integrator",
    "instanceUrl": "https://instance2.service-now.com"
  }'
# ✅ Should succeed (integrators can access ANY instance)
```

### Test 2: Customer Access (Restricted)

```bash
# Set customer license
export SNOW_FLOW_LICENSE_KEY="SNOW-ENT-CAPGEMINI-CLIENT123-20251027-B4E1F3D2"

# Test access to authorized instance
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "'"$SNOW_FLOW_LICENSE_KEY"'",
    "role": "customer",
    "instanceUrl": "https://client123.service-now.com"
  }'
# ✅ Should succeed

# Test access to different instance
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "'"$SNOW_FLOW_LICENSE_KEY"'",
    "role": "customer",
    "instanceUrl": "https://other-client.service-now.com"
  }'
# ❌ Should fail with 401 Unauthorized
```

---

## Step 7: Test Enterprise Features

### Test Jira Integration

```bash
# Assuming you have Jira credentials in .env
curl -X POST http://localhost:3000/mcp/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "jira_sync_backlog",
      "arguments": {
        "jiraProjectKey": "PROJECT",
        "targetTable": "incident",
        "jiraBaseUrl": "https://yourcompany.atlassian.net",
        "jiraAuthToken": "your-token"
      }
    }
  }'
```

**Expected Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "success": true,
    "synced": 25,
    "issues": [
      {
        "key": "PROJECT-123",
        "summary": "Implement feature X",
        "status": "In Progress"
      },
      // ... more issues
    ]
  }
}
```

---

## Troubleshooting

### Issue: "Cannot connect to enterprise server"

**Solution:**
```bash
# Check if server is running
curl http://localhost:3000/health

# Check logs
cd snow-flow-enterprise
npm run dev  # Look for errors
```

### Issue: "Invalid or expired token"

**Solution:**
```bash
# Generate fresh token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "SNOW-ENT-CAPGEMINI-20261027-A3F2E9C1",
    "role": "integrator"
  }' | jq -r '.token'

# Use this token in Authorization header
```

### Issue: "License validation failed"

**Solution:**
```bash
# Regenerate license key
cd snow-flow-enterprise
node dist/scripts/generate-licenses.js

# Use new license key
```

---

## Next Steps

1. ✅ **You've tested locally** - Enterprise server works!
2. ⏳ **Deploy to production** - Railway, Heroku, or AWS
3. ⏳ **Implement Jira tools** - Full backlog sync functionality
4. ⏳ **Implement Azure DevOps tools** - Work item sync
5. ⏳ **Implement Confluence tools** - Documentation sync
6. ⏳ **Add SSO/SAML** - Enterprise authentication
7. ⏳ **Build customer portal** - Self-service license management

---

## Support

**Questions?**
- Enterprise docs: [ENTERPRISE-INTEGRATION-PLAN.md](./ENTERPRISE-INTEGRATION-PLAN.md)
- GitHub Issues: https://github.com/groeimetai/snow-flow/issues
- Email: support@snow-flow.dev

**Need a demo?**
Contact Niels van der Werf at niels@snow-flow.dev

---

**Version:** 1.0
**Last Updated:** October 27, 2025
**Status:** ✅ Ready for testing!
