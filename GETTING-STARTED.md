# Getting Started with Snow-Flow

Complete setup guide from installation to Enterprise license activation.

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Install Snow-Flow (Open Source)](#step-1-install-snow-flow-open-source)
4. [Step 2: Install SnowCode Editor](#step-2-install-snowcode-editor)
5. [Step 3: Configure Your LLM (BYOLLM)](#step-3-configure-your-llm-byollm)
6. [Step 4: Setup ServiceNow OAuth](#step-4-setup-servicenow-oauth)
7. [Step 5: Activate Enterprise License (Optional)](#step-5-activate-enterprise-license-optional)
8. [Verification](#verification)
9. [Troubleshooting](#troubleshooting)

---

## System Overview

Snow-Flow consists of three components:

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Snow-Flow (Open Source)                                     │
│     - 350+ ServiceNow MCP Tools                                 │
│     - ServiceNow development automation                         │
│     - Autonomous agents                                         │
│     - GitHub: github.com/groeimetai/Snow-flow                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. SnowCode (Code Editor/CLI)                                  │
│     - Dedicated ServiceNow code agent                           │
│     - OAuth connection management                               │
│     - BYOLLM (Bring Your Own LLM)                              │
│     - GitHub: github.com/groeimetai/snowcode                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (Optional)
┌─────────────────────────────────────────────────────────────────┐
│  3. Snow-Flow Enterprise (Add-on)                               │
│     - Unlocks 40+ MCP tools via license key:                   │
│       • Jira (8 tools)                                          │
│       • Azure DevOps (10 tools)                                 │
│       • Confluence (8 tools)                                    │
│       • ML & Analytics (15+ tools)                              │
│     - Agents can fetch tasks from external platforms            │
│     - GitHub: github.com/groeimetai/snow-flow-enterprise        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **ServiceNow Instance** - Developer instance or PDI
- **LLM API Key** - Claude, GPT-4, or any compatible LLM
- **Enterprise License Key** (optional) - For Jira/Azure/Confluence tools

---

## Step 1: Install Snow-Flow (Open Source)

### 1.1 Clone the Repository

```bash
git clone https://github.com/groeimetai/Snow-flow.git
cd Snow-flow
```

### 1.2 Install Dependencies

```bash
npm install
```

### 1.3 Build the Project

```bash
npm run build
```

### 1.4 Verify Installation

```bash
npm test
```

You should see:
```
✓ All 350+ ServiceNow MCP tools loaded
✓ Core modules initialized
✓ Ready for configuration
```

---

## Step 2: Install SnowCode Editor

### 2.1 Clone SnowCode

```bash
git clone https://github.com/groeimetai/snowcode.git
cd snowcode
```

### 2.2 Install SnowCode

```bash
npm install -g .
```

### 2.3 Verify Installation

```bash
snow-flow --version
```

You should see:
```
Snow-Flow v1.0.0
ServiceNow Development Agent
```

---

## Step 3: Configure Your LLM (BYOLLM)

Snow-Flow supports any LLM provider through the MCP protocol.

### 3.1 Choose Your LLM Provider

**Option A: Claude (Anthropic)**
```bash
# Set your API key
export ANTHROPIC_API_KEY="sk-ant-..."
```

**Option B: OpenAI (GPT-4)**
```bash
# Set your API key
export OPENAI_API_KEY="sk-..."
```

**Option C: Other LLM Providers**
- Ollama (local)
- Azure OpenAI
- Google Gemini
- Any OpenAI-compatible API

### 3.2 Configure SnowCode

Create or edit `~/.snow-flow/config.json`:

```json
{
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4",
    "apiKey": "${ANTHROPIC_API_KEY}",
    "maxTokens": 8192
  }
}
```

**For OpenAI:**
```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4",
    "apiKey": "${OPENAI_API_KEY}",
    "maxTokens": 8192
  }
}
```

### 3.3 Test LLM Connection

```bash
snow-flow auth status
```

You should see:
```
✓ LLM connection successful
✓ Model: claude-sonnet-4
✓ Max tokens: 8192
✓ ServiceNow connection: Not yet configured
✓ Ready to use
```

**Note:** This command tests both LLM and ServiceNow connectivity. ServiceNow will show "Not configured" until you complete Step 4.

---

## Step 4: Setup ServiceNow OAuth

### 4.1 Create OAuth Application in ServiceNow

1. Navigate to **System OAuth → Application Registry**
2. Click **New** → **Create an OAuth API endpoint for external clients**
3. Fill in:
   - **Name**: Snow-Flow Development
   - **Client ID**: (auto-generated, copy this!)
   - **Client Secret**: (auto-generated, copy this!)
   - **Redirect URL**: `http://localhost:3000/oauth/callback`
4. Click **Submit**

### 4.2 Configure OAuth in SnowCode

```bash
snow-flow auth login
```

Follow the interactive prompts:

```
? Choose authentication method: OAuth 2.0 (recommended)
? ServiceNow instance: dev123456.service-now.com
? OAuth Client ID: [paste from step 4.1]
? OAuth Client Secret: [paste from step 4.1]

✓ OAuth configuration saved
✓ Opening browser for authentication...
```

### 4.3 Complete OAuth Flow

Your browser will open to ServiceNow login:
1. Log in with your ServiceNow credentials
2. Click **Allow** to grant permissions
3. You'll be redirected to `http://localhost:3000/oauth/callback`

```
✓ OAuth authentication successful
✓ Access token received
✓ Refresh token received
✓ Token expires in 3600 seconds

You can now use Snow-Flow with your ServiceNow instance!
```

### 4.4 Verify OAuth Connection

```bash
snow-flow auth status
```

You should see:
```
✓ ServiceNow Authentication Status
✓ Status: Authenticated
✓ Instance: dev123456.service-now.com
✓ Method: OAuth 2.0
✓ Connection test successful
✓ Logged in as: System Administrator (admin)
✓ 350+ MCP tools ready
```

---

## Step 5: Activate Enterprise License (Optional)

**Skip this step if you only need ServiceNow tools (350+).**

Activate Enterprise to unlock Jira, Azure DevOps, and Confluence tools.

### 5.1 Get Your License Key

Purchase or request a trial license:
- **Website**: https://portal.snow-flow.dev
- **Email**: sales@snow-flow.dev

You'll receive a license key like: `SNOW-ENT-GLOB-ABC123`

### 5.2 Login to Enterprise Portal

```bash
snow-flow login SNOW-ENT-GLOB-ABC123
```

The system will authenticate with the portal:

```
🔑 Authenticating with Snow-Flow Enterprise...

✅ Successfully authenticated!

Customer: Your Company Name
License Tier: ENTERPRISE
Features: Jira, Azure DevOps, Confluence, ML & Analytics

Your credentials have been saved to: ~/.snow-flow/auth.json

💡 Enterprise tools are now available!
   Run snow-flow swarm "<task>" to use them.
   Run snow-flow portal to configure integrations.
```

### 5.3 Configure Service Credentials

**Via Web Portal (Required)**

1. Open the portal:
   ```bash
   snow-flow portal
   ```

   Or visit directly: https://portal.snow-flow.dev

2. Login with your license key credentials

3. Navigate to **Credentials → Add Service**

4. Configure each service:

**Jira:**
- Instance URL: `https://company.atlassian.net`
- Email: `user@company.com`
- API Token: [Generate from Atlassian](https://id.atlassian.com/manage-profile/security/api-tokens)

**Azure DevOps:**
- Organization: `https://dev.azure.com/org`
- Personal Access Token: [Generate from Azure](https://dev.azure.com/org/_usersSettings/tokens)

**Confluence:**
- Instance URL: `https://company.atlassian.net/wiki`
- Email: `user@company.com`
- API Token: (same as Jira)

**Note:** All credentials are encrypted with Google Cloud KMS and stored securely on the enterprise server. They are never stored locally.

### 5.4 Verify Enterprise Tools

```bash
snow-flow status
```

You should see:
```
✅ Authenticated with Snow-Flow Enterprise

Customer: Your Company Name
Customer ID: 1
License Tier: ENTERPRISE

Available Features:
  • Jira Integration
  • Azure DevOps Integration
  • Confluence Integration
  • ML & Analytics

Token Expires: 2025-12-31 23:59:59

Configuration stored in: ~/.snow-flow/auth.json
```

To see available MCP tools, start a swarm task:
```bash
snow-flow swarm "list all available enterprise tools"
```

---

## Verification

Test the complete setup with a simple workflow:

### Test ServiceNow Tools (Open Source)

Start a swarm task:

```bash
snow-flow swarm "Create a test incident in ServiceNow"
```

You should see:

```
🤖 Snow-Flow Multi-Agent Orchestrator

Spawning widget-builder agent...
Analyzing task...
Executing snow_create_record...

✅ Created incident INC0000123: Test incident
   Short description: Test incident created by Snow-Flow
   State: New
   Priority: 3 - Moderate

Task completed successfully!
```

### Test Enterprise Tools (If Activated)

```bash
snow-flow swarm "Create a Jira ticket for incident INC0000123"
```

You should see:

```
🤖 Snow-Flow Multi-Agent Orchestrator (Enterprise Mode)

Spawning integration agent...
Connecting to Jira...
Executing snow_jira_create_issue...

✅ Created Jira ticket SNOW-456: Test incident
   URL: https://company.atlassian.net/browse/SNOW-456
   Linked to ServiceNow INC0000123

Task completed successfully!
```

### Test Autonomous Agents

```bash
snow-flow swarm "Setup an agent to sync high-priority incidents from ServiceNow to Jira every 15 minutes"
```

You should see:

```
🤖 Snow-Flow Multi-Agent Orchestrator (Enterprise Mode)

Creating autonomous agent...
Configuring sync workflow...
- Source: ServiceNow (priority 1-2 incidents)
- Destination: Jira project SNOW
- Sync interval: 15 minutes
- Bi-directional status updates: enabled

✅ Agent configured and activated!
   Agent ID: agent-sync-001
   Status: Active
   Next run: 2025-10-28 22:00:00

Monitor with: snow-flow monitor
```

---

## Troubleshooting

### LLM Connection Fails

**Error:** `Failed to connect to LLM`

**Solutions:**
1. Check API key is set correctly: `echo $ANTHROPIC_API_KEY`
2. Verify API key is valid (test at provider website)
3. Check internet connection
4. Verify LLM provider is supported

### ServiceNow OAuth Fails

**Error:** `OAuth authentication failed`

**Solutions:**
1. Verify Client ID and Secret are correct
2. Check Redirect URL matches: `http://localhost:3000/oauth/callback`
3. Ensure ServiceNow instance is accessible
4. Try re-creating OAuth app in ServiceNow

### Enterprise License Invalid

**Error:** `Invalid license key`

**Solutions:**
1. Verify license key format: `SNOW-ENT-GLOB-ABC123`
2. Check license hasn't expired
3. Contact support: sales@snow-flow.dev
4. Try portal login: https://portal.snow-flow.dev

### Enterprise Tools Not Showing

**Error:** MCP tools list doesn't include Jira/Azure/Confluence

**Solutions:**
1. Verify enterprise license is activated: `snow-flow status`
2. Check credentials are configured in portal: `snow-flow portal`
3. Re-authenticate if token expired: `snow-flow login <license-key>`
4. Check license server is accessible: `curl https://portal.snow-flow.dev/health`

---

## Next Steps

**You're all set!** Here's what you can do next:

### 📚 Learn More
- [350+ ServiceNow MCP Tools Reference](https://github.com/groeimetai/Snow-flow/blob/main/MCP-TOOLS.md)
- [Enterprise Integration Guide](./INTEGRATIONS.md)
- [Autonomous Agent Workflows](./INTEGRATIONS.md#autonomous-agent-workflows)

### 🚀 Advanced Features
- [Custom LLM Configuration](https://github.com/groeimetai/snowcode/blob/main/BYOLLM.md)
- [Multi-Instance Setup](https://github.com/groeimetai/Snow-flow/blob/main/MULTI-INSTANCE.md)
- [White-Label Portal (Service Integrators)](./portal/README.md)

### 🆘 Get Help
- **GitHub Issues**:
  - Snow-Flow: https://github.com/groeimetai/Snow-flow/issues
  - SnowCode: https://github.com/groeimetai/snowcode/issues
  - Enterprise: https://github.com/groeimetai/snow-flow-enterprise/issues
- **Email**: support@snow-flow.dev
- **Portal**: https://portal.snow-flow.dev

---

**Status:** ✅ Complete Setup Guide
**Version:** 1.0.0
**Last Updated:** 2025-10-28
