# Snow-Flow Enterprise

**Version:** 2.0.0 | **License:** Commercial | **Status:** Production Ready

Enterprise-grade ServiceNow development platform with AI-powered integrations, autonomous agents, and advanced security.

---

## 🎯 What is Snow-Flow Enterprise?

Snow-Flow Enterprise is a **B2B2C SaaS platform** providing:

- ✅ **40+ MCP Tools** for Jira, Azure DevOps, Confluence, and ML/Analytics
- ✅ **Remote Execution** - integration code stays on our secure server
- ✅ **Autonomous Agents** - AI agents manage backlogs 24/7
- ✅ **Enterprise Security** - Google Cloud KMS encryption, SOC 2/ISO 27001 ready
- ✅ **White-Label Portal** - branded customer experience for service integrators
- ✅ **Zero Maintenance** - updates deploy without customer reinstalls

---

## 📋 Quick Links

| Documentation | Description |
|---------------|-------------|
| **[INTEGRATIONS.md](INTEGRATIONS.md)** | Complete guide for Jira, Azure DevOps, Confluence integrations |
| **[MCP-REFERENCE.md](MCP-REFERENCE.md)** | MCP architecture, toolset, and API reference |
| **[GCP-DEPLOYMENT-GUIDE.md](GCP-DEPLOYMENT-GUIDE.md)** | Production deployment on Google Cloud Platform |
| **[LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md)** | Commercial licensing terms |
| **[portal/README.md](portal/README.md)** | Portal documentation (web dashboard) |
| **[portal/backend/KMS-SETUP.md](portal/backend/KMS-SETUP.md)** | Google Cloud KMS encryption setup |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CUSTOMERS                                │
│  Claude Code + MCP Proxy (local)                            │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS (license key auth)
                         ↓
┌─────────────────────────────────────────────────────────────┐
│            SNOW-FLOW ENTERPRISE (GCP Cloud Run)             │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────┐│
│  │   MCP Server    │  │      Portal      │  │  License   ││
│  │  (40+ tools)    │  │  (Web Dashboard) │  │  Database  ││
│  │                 │  │                  │  │  (MySQL)   ││
│  │ • Jira (8)      │  │ • Credentials    │  │            ││
│  │ • Azure (10)    │  │ • Analytics      │  │ • Licenses ││
│  │ • Confluence(8) │  │ • White-label    │  │ • Usage    ││
│  │ • ML (15+)      │  │ • Admin          │  │ • Audit    ││
│  └─────────────────┘  └──────────────────┘  └────────────┘│
│                              │                              │
│              ┌───────────────┴───────────────┐              │
│              ↓                               ↓              │
│     ┌─────────────────┐           ┌──────────────────┐     │
│     │  Google Cloud   │           │  External APIs   │     │
│     │      KMS        │           │ • Jira           │     │
│     │  (Encryption)   │           │ • Azure DevOps   │     │
│     └─────────────────┘           │ • Confluence     │     │
│                                   └──────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**Key Features:**
- 🔒 **Credentials** encrypted with Google Cloud KMS (HSM-backed)
- 📊 **Usage tracking** for every API call
- 🔄 **Automatic updates** without customer reinstalls
- 🌍 **Multi-region** (currently: europe-west4, expandable)
- ⚡ **Serverless** Cloud Run (auto-scales 0 → 1000+)

---

## 🚀 Quick Start

### For Customers

**1. Get License Key**
- Contact: sales@snow-flow.dev
- Or purchase: https://snow-flow.dev/pricing

**2. Install MCP Proxy**

Add to Claude Desktop config (`~/.config/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "snow-flow-enterprise": {
      "command": "npx",
      "args": [
        "-y",
        "@snow-flow/mcp-proxy",
        "--license-key",
        "SNOW-TEAM-XXXX-XXXX-XXXX-XXXX"
      ]
    }
  }
}
```

**3. Add Credentials**

Login to portal and add service credentials:
```
https://portal.snow-flow.dev
```

**4. Use Tools**
```typescript
// Sync Jira backlog
await snow_jira_sync_backlog({
  projectKey: "PROJ",
  status: ["To Do", "In Progress"],
  syncToTable: "incident"
});

// Create Azure DevOps work item
await snow_azdo_create_work_item({
  organization: "myorg",
  project: "MyProject",
  workItemType: "Bug",
  title: "Fix authentication issue"
});

// Sync Confluence to KB
await snow_confluence_sync_space({
  spaceKey: "DOCS",
  syncToKB: "IT"
});
```

### For Service Integrators

**1. Get Master License**
- Contact: sales@snow-flow.dev
- Receive: `SNOW-SI-XXXX-XXXX-XXXX-XXXX`

**2. Configure White-Label Portal**
- Custom domain
- Logo upload
- Theme customization

**3. Create Customer Licenses**

Via Admin API:
```bash
curl https://portal.snow-flow.dev/api/admin/licenses \
  -H "X-Admin-Key: YOUR-ADMIN-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceIntegratorId": 1,
    "tier": "pro",
    "customerName": "Acme Corp",
    "contactEmail": "admin@acme.com"
  }'
```

---

## 📦 Repository Structure

```
snow-flow-enterprise/
├── mcp-proxy/              # Local MCP proxy (npm package)
│   ├── src/index.ts        # stdio ↔ HTTPS bridge
│   └── package.json        # Published to npm
│
├── mcp-server/             # Remote MCP server (Cloud Run)
│   ├── src/
│   │   ├── index.ts        # Express server
│   │   ├── mcp-handler.ts  # MCP protocol
│   │   ├── integrations/   # Jira, Azure, Confluence
│   │   └── ml/             # ML models & analytics
│   └── Dockerfile
│
├── portal/                 # Web portal (Cloud Run)
│   ├── backend/            # Express API
│   │   ├── src/
│   │   │   ├── database/   # MySQL schema
│   │   │   ├── routes/     # API endpoints
│   │   │   ├── services/   # KMS encryption
│   │   │   └── migrations/ # DB migrations
│   │   └── Dockerfile
│   └── frontend/           # React dashboard
│       ├── src/
│       │   ├── pages/      # Customer, SI, Admin views
│       │   └── components/ # Reusable UI
│       └── package.json
│
├── INTEGRATIONS.md         # ⭐ Integration guide (Jira/Azure/Confluence)
├── MCP-REFERENCE.md        # ⭐ MCP architecture & toolset
├── GCP-DEPLOYMENT-GUIDE.md # ⭐ Production deployment
└── README.md               # This file
```

---

## 🔐 Security & Compliance

### Encryption

- ✅ **Google Cloud KMS** envelope encryption for credentials
- ✅ **HSM-backed keys** (Hardware Security Modules)
- ✅ **Automatic key rotation** (90 days)
- ✅ **Audit logging** for all key access
- ✅ **TLS 1.3** for all communication

### Compliance Certifications

- ✅ **SOC 2 Type II** ready
- ✅ **ISO 27001** ready
- ✅ **GDPR** compliant
- ✅ **HIPAA** compatible (with BAA)
- ✅ **PCI-DSS Level 1** ready

See [portal/backend/KMS-SETUP.md](portal/backend/KMS-SETUP.md) for detailed security setup.

---

## 🤖 Autonomous Agents

Snow-Flow Enterprise enables **AI agents to work autonomously 24/7**:

**Example: Backlog Agent**
```typescript
// Agent runs every 15 minutes
while (true) {
  // Get high-priority work
  const issues = await snow_jira_search_issues({
    jql: "status = 'To Do' AND priority = 'High'",
    maxResults: 10
  });

  // Process each issue
  for (const issue of issues) {
    await snow_jira_transition_issue({
      issueKey: issue.key,
      transition: "In Progress",
      comment: "🤖 Agent processing"
    });

    // Do the work...

    await snow_jira_transition_issue({
      issueKey: issue.key,
      transition: "Done",
      comment: "🤖 Agent completed"
    });
  }

  await sleep(15 * 60 * 1000);
}
```

See [INTEGRATIONS.md#autonomous-agent-workflows](INTEGRATIONS.md#autonomous-agent-workflows) for complete examples.

---

## 💼 Licensing

Snow-Flow is available in two versions:

### 🌟 Enterprise Edition (This Repository)
- ✅ **Fully managed SaaS** - hosted on Google Cloud Platform
- ✅ **40+ MCP Tools** - Jira (8), Azure DevOps (10), Confluence (8), ML/Analytics (15+)
- ✅ **Unlimited integrations** - no service limits
- ✅ **Enterprise security** - Google Cloud KMS encryption, SOC 2/ISO 27001 ready
- ✅ **White-label portal** - branded customer experience for service integrators
- ✅ **Autonomous agents** - AI agents manage backlogs 24/7
- ✅ **Zero maintenance** - automatic updates without customer reinstalls
- ✅ **24/7 priority support** - dedicated support team

**Pricing:** Custom enterprise pricing. Contact sales@snow-flow.dev

### 🆓 Open Source Edition
- ✅ **Self-hosted** - run on your own infrastructure
- ✅ **Core MCP tools** - essential ServiceNow development tools
- ✅ **Community support** - GitHub issues and community forums
- ✅ **MIT License** - free for personal and commercial use

**Get started:** https://github.com/your-org/snow-flow-open-source

---

## 🚀 Deployment

### Production (Google Cloud Platform)

```bash
# 1. Setup GCP project
gcloud projects create snow-flow-enterprise
gcloud config set project snow-flow-enterprise

# 2. Enable APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  cloudkms.googleapis.com

# 3. Deploy (automatic via Cloud Build trigger)
git push origin main
```

See [GCP-DEPLOYMENT-GUIDE.md](GCP-DEPLOYMENT-GUIDE.md) for complete instructions.

### Local Development

```bash
# 1. Clone repository
git clone https://github.com/your-org/snow-flow-enterprise
cd snow-flow-enterprise

# 2. Start local MySQL
docker run -d \
  --name snow-flow-mysql \
  -e MYSQL_ROOT_PASSWORD=dev-password \
  -e MYSQL_DATABASE=licenses \
  -p 3306:3306 \
  mysql:8.4

# 3. Start MCP server
cd mcp-server
npm install
cp .env.example .env
npm run dev  # http://localhost:3000

# 4. Start portal
cd ../portal/backend
npm install
cp .env.example .env
npm run dev  # http://localhost:8080
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[INTEGRATIONS.md](INTEGRATIONS.md)** | Jira, Azure DevOps, Confluence setup & workflows |
| **[MCP-REFERENCE.md](MCP-REFERENCE.md)** | MCP architecture, toolset (40+ tools), API reference |
| **[GCP-DEPLOYMENT-GUIDE.md](GCP-DEPLOYMENT-GUIDE.md)** | Production deployment, Cloud Run, Cloud SQL, KMS |
| **[portal/README.md](portal/README.md)** | Portal architecture, customer/SI/admin features |
| **[portal/backend/KMS-SETUP.md](portal/backend/KMS-SETUP.md)** | Google Cloud KMS encryption setup |
| **[portal/backend/DEPRECATED.md](portal/backend/DEPRECATED.md)** | Migration tracking, deprecated components |

---

## 🆘 Support

- **Documentation**: https://docs.snow-flow.dev
- **Customer Portal**: https://portal.snow-flow.dev
- **Email**: support@snow-flow.dev
- **Sales**: sales@snow-flow.dev
- **Enterprise Support**: Available 24/7 for Enterprise tier

---

## 📄 License

**Commercial License** - See [LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md)

This is proprietary software. Unauthorized copying, distribution, or use is strictly prohibited.

---

## 🙏 Credits

Built with:
- [Express.js](https://expressjs.com/) - Web framework
- [React](https://react.dev/) - UI framework
- [Google Cloud Platform](https://cloud.google.com/) - Infrastructure
- [MySQL 8.4](https://www.mysql.com/) - Database
- [Model Context Protocol](https://modelcontextprotocol.io/) - AI integration protocol

---

**Version:** 2.0.0
**Last Updated:** 2025-10-28
**Status:** ✅ Production Ready
