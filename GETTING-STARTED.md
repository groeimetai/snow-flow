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
snow-flow test-llm
```

You should see:
```
✓ LLM connection successful
✓ Model: claude-sonnet-4
✓ Max tokens: 8192
✓ Ready to use
```

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
snow-flow oauth setup
```

Follow the interactive prompts:

```
? ServiceNow Instance URL: https://dev123456.service-now.com
? OAuth Client ID: [paste from step 4.1]
? OAuth Client Secret: [paste from step 4.1]
? Scopes: useraccount,offline_access

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
snow-flow test-servicenow
```

You should see:
```
✓ ServiceNow connection successful
✓ Instance: dev123456.service-now.com
✓ User: admin
✓ API access: enabled
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
snow-flow enterprise login
```

Follow the interactive prompts:

```
? Enterprise License Key: SNOW-ENT-GLOB-ABC123
? Create account password: ********

✓ License validated
✓ Account created
✓ Customer ID: 1
✓ Login token saved
```

### 5.3 Configure Service Credentials

**Option A: Via Portal (Recommended)**

1. Open: https://portal.snow-flow.dev
2. Login with your license key
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

**Option B: Via CLI**

```bash
# Add Jira credentials
snow-flow enterprise add-credential \
  --service jira \
  --url https://company.atlassian.net \
  --email user@company.com \
  --token YOUR_JIRA_TOKEN

# Add Azure DevOps credentials
snow-flow enterprise add-credential \
  --service azdo \
  --org https://dev.azure.com/org \
  --token YOUR_AZURE_PAT

# Add Confluence credentials
snow-flow enterprise add-credential \
  --service confluence \
  --url https://company.atlassian.net/wiki \
  --email user@company.com \
  --token YOUR_CONFLUENCE_TOKEN
```

### 5.4 Verify Enterprise Tools

```bash
snow-flow enterprise test
```

You should see:
```
✓ License server connection: OK
✓ License key valid: SNOW-ENT-GLOB-ABC123
✓ Customer ID: 1

Available Enterprise Tools:
✓ Jira (8 tools)
  - snow_jira_create_issue
  - snow_jira_update_issue
  - snow_jira_query_issues
  - snow_jira_get_issue
  - snow_jira_add_comment
  - snow_jira_transition_issue
  - snow_jira_create_sprint
  - snow_jira_assign_issue

✓ Azure DevOps (10 tools)
  - snow_azdo_create_work_item
  - snow_azdo_update_work_item
  - snow_azdo_query_work_items
  - ... (7 more)

✓ Confluence (8 tools)
  - snow_confluence_create_page
  - snow_confluence_update_page
  - ... (6 more)

✓ ML & Analytics (15+ tools)
  - snow_ml_predict_priority
  - snow_ml_forecast_incidents
  - ... (13+ more)

Total: 390+ MCP tools available!
```

---

## Verification

Test the complete setup with a simple workflow:

### Test ServiceNow Tools (Open Source)

```bash
snow-flow
```

In the Snow-Flow prompt:

```
You: "Create a test incident in ServiceNow"

Snow-Flow: [Uses snow_create_record]
           "Created incident INC0000123: Test incident
            Short description: Test incident created by Snow-Flow
            State: New
            Priority: 3 - Moderate"
```

### Test Enterprise Tools (If Activated)

```
You: "Create a Jira ticket for this incident"

Snow-Flow: [Uses snow_jira_create_issue]
           "Created Jira ticket SNOW-456: Test incident
            URL: https://company.atlassian.net/browse/SNOW-456
            Linked to ServiceNow INC0000123"
```

### Test Autonomous Agents

```
You: "Setup an agent to sync high-priority incidents from ServiceNow to Jira"

Snow-Flow: [Creates autonomous agent]
           "Agent configured:
            - Monitors ServiceNow incidents (priority 1-2)
            - Auto-creates Jira tickets
            - Syncs status updates bi-directionally
            - Runs every 15 minutes

            Agent is now active!"
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
1. Verify enterprise license is activated: `snow-flow enterprise status`
2. Check credentials are configured in portal
3. Restart Snow-Flow: `snow-flow restart`
4. Check license server is accessible: `curl https://snow-flow-enterprise-*.run.app/health`

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
