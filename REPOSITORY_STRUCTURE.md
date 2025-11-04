# Snow-Flow Repository Structure - Open Core Architecture

**Design for Core (MIT) + Enterprise (Proprietary) Split**

This document outlines the repository structure for Snow-Flow's Open Core business model, separating the open source core from proprietary enterprise features.

---

## Overview

```
Snow-Flow Organization
├── @snow-flow/core (GitHub: groeimetai/snow-flow) [PUBLIC - MIT]
├── @snow-flow/enterprise (GitHub: snow-flow-bv/snow-flow-enterprise) [PRIVATE - Proprietary]
└── @snow-flow/docs (GitHub: snow-flow-bv/docs) [PUBLIC - CC BY 4.0]
```

---

## 1. Core Repository (@snow-flow/core)

**GitHub:** `groeimetai/snow-flow` (current repository)
**License:** MIT
**Access:** Public
**NPM:** `@snow-flow/core` (published publicly)

### Directory Structure

```
snow-flow/
├── src/
│   ├── cli/                    # CLI commands (auth, init, status)
│   ├── mcp/                    # MCP servers
│   │   ├── servicenow-mcp-unified/   # ServiceNow Unified Server (235+ tools)
│   │   │   ├── tools/
│   │   │   │   ├── deployment/          # Widget/artifact deployment
│   │   │   │   ├── operations/          # CRUD operations
│   │   │   │   ├── automation/          # Background scripts
│   │   │   │   ├── platform-development/# Business rules, client scripts
│   │   │   │   ├── integration/         # REST/SOAP integrations
│   │   │   │   ├── system-properties/   # System property management
│   │   │   │   ├── update-set/          # Update set lifecycle
│   │   │   │   ├── development-assistant/ # Artifact search/edit
│   │   │   │   ├── security-compliance/ # Security & compliance
│   │   │   │   ├── reporting-analytics/ # Reporting & dashboards
│   │   │   │   ├── machine-learning/    # Native ServiceNow PI + local TensorFlow.js
│   │   │   │   ├── predictive-intelligence/ # Native PI solution builder
│   │   │   │   ├── knowledge-catalog/   # Knowledge & service catalog
│   │   │   │   ├── change-va-pa/        # Change, Virtual Agent, PA
│   │   │   │   ├── flow-workspace-mobile-uib/ # Flow, Workspace, Mobile, UI Builder
│   │   │   │   ├── cmdb-event-hr-csm-devops/ # CMDB, Events, HR, CSM, DevOps
│   │   │   │   ├── advanced-features/   # Batch API, analytics, optimization
│   │   │   │   └── local-development/   # Artifact sync to local files
│   │   │   └── server.ts
│   │   │
│   │   └── orchestration/       # Snow-Flow Orchestration Server (176+ tools)
│   │       ├── tools/
│   │       │   ├── swarm/              # Multi-agent coordination
│   │       │   ├── agents/             # Agent spawning & management
│   │       │   ├── tasks/              # Task orchestration
│   │       │   ├── memory/             # Persistent memory
│   │       │   ├── neural/             # TensorFlow.js local ML training
│   │       │   └── performance/        # Performance tracking
│   │       └── server.ts
│   │
│   ├── utils/                   # Shared utilities
│   │   ├── servicenow-client.ts     # ServiceNow API client
│   │   ├── snow-oauth.ts            # OAuth authentication
│   │   ├── logger.ts                # Logging utilities
│   │   └── validators.ts            # Input validation
│   │
│   ├── templates/               # Project templates
│   │   ├── claude-md-template.ts    # CLAUDE.md template
│   │   ├── opencode-agents-template.ts # AGENTS.md template
│   │   └── mcp-config-template.ts   # .mcp.json template
│   │
│   ├── types/                   # TypeScript types
│   └── index.ts                 # Main entry point
│
├── scripts/
│   ├── postinstall.js           # Post-install setup
│   └── setup-opencode.js        # OpenCode configuration
│
├── bin/
│   └── snow-flow                # CLI entry point
│
├── docs/                        # Documentation
│   ├── getting-started.md
│   ├── authentication.md
│   ├── mcp-servers.md
│   └── tools-reference.md
│
├── .env.example                 # Environment variables template
├── .mcp.json.template           # MCP configuration template
├── opencode-config.example.json # OpenCode configuration template
├── package.json
├── tsconfig.json
├── LICENSE                      # MIT License
├── TRADEMARK.md                 # Trademark protection notice
├── README.md                    # Main documentation
└── CLAUDE.md                    # AI agent instructions
```

### What Stays in Core (Open Source)

**Features:**
- ✅ All 411 ServiceNow tools (2 MCP servers)
- ✅ Multi-LLM provider support (75+ providers via OpenCode)
- ✅ Authentication (OAuth, Claude Pro/Max via OpenCode)
- ✅ Widget deployment & validation
- ✅ UI Builder integration (complete Now Experience Framework)
- ✅ Business rules, client scripts, UI policies
- ✅ Flow Designer execution (read/execute existing flows)
- ✅ Native ServiceNow Predictive Intelligence (create/train/activate/predict)
- ✅ Local ML training (TensorFlow.js - experimental)
- ✅ Update set management (with auto-sync current update set)
- ✅ Background script execution (with auto-confirm mode)
- ✅ Local development bridge (pull/push artifacts)
- ✅ Multi-agent orchestration (SPARC methodology)
- ✅ Memory management (persistent storage)
- ✅ Performance tracking

**Distribution:**
- NPM: `npm install -g @snow-flow/core`
- GitHub Releases: Tagged releases (v7.x.x, v8.x.x, etc.)
- Docker: `docker pull snowflow/core:latest` (optional)

---

## 2. Enterprise Repository (@snow-flow/enterprise)

**GitHub:** `snow-flow-bv/snow-flow-enterprise` (NEW - to be created)
**License:** Proprietary (see LICENSE-ENTERPRISE)
**Access:** Private (licensed customers only)
**NPM:** `@snow-flow/enterprise` (private registry or scoped access)

### Directory Structure

```
snow-flow-enterprise/
├── src/
│   ├── integrations/
│   │   ├── jira/
│   │   │   ├── sync-engine.ts         # Bi-directional sync engine
│   │   │   ├── backlog-importer.ts    # Import stories/epics/tasks
│   │   │   ├── webhook-handler.ts     # Real-time webhook updates
│   │   │   ├── ai-parser.ts           # AI requirement parsing
│   │   │   ├── jira-client.ts         # Jira REST API client
│   │   │   └── tools/                 # MCP tools for Jira
│   │   │       ├── snow_jira_sync_backlog.ts
│   │   │       ├── snow_jira_create_task_from_story.ts
│   │   │       ├── snow_jira_sync_status.ts
│   │   │       └── snow_jira_webhook_setup.ts
│   │   │
│   │   ├── azure-devops/
│   │   │   ├── sync-engine.ts         # Work item synchronization
│   │   │   ├── workitem-mapper.ts     # User Story/Task/Bug mapping
│   │   │   ├── pr-tracker.ts          # Pull request tracking
│   │   │   ├── pipeline-integrator.ts # Build pipeline integration
│   │   │   ├── azure-client.ts        # Azure DevOps REST API client
│   │   │   └── tools/                 # MCP tools for Azure DevOps
│   │   │       ├── snow_azure_sync_workitems.ts
│   │   │       ├── snow_azure_track_pr.ts
│   │   │       ├── snow_azure_pipeline_status.ts
│   │   │       └── snow_azure_test_results.ts
│   │   │
│   │   └── confluence/
│   │       ├── doc-syncer.ts          # Documentation synchronization
│   │       ├── page-importer.ts       # Confluence page → Knowledge article
│   │       ├── attachment-handler.ts  # Architecture diagram sync
│   │       ├── confluence-client.ts   # Confluence REST API client
│   │       └── tools/                 # MCP tools for Confluence
│   │           ├── snow_confluence_sync_docs.ts
│   │           ├── snow_confluence_import_page.ts
│   │           └── snow_confluence_sync_attachments.ts
│   │
│   ├── security/
│   │   ├── sso/
│   │   │   ├── saml-provider.ts       # SAML 2.0 integration
│   │   │   ├── oauth-provider.ts      # OAuth 2.0 / OIDC
│   │   │   ├── ldap-connector.ts      # Active Directory/LDAP
│   │   │   └── rbac-manager.ts        # Role-based access control
│   │   │
│   │   └── audit/
│   │       ├── audit-logger.ts        # Comprehensive activity tracking
│   │       ├── compliance-reporter.ts # SOX, GDPR, HIPAA reports
│   │       ├── tamper-proof-storage.ts # Immutable log storage
│   │       └── real-time-alerts.ts    # Security alerting
│   │
│   ├── ml-advanced/
│   │   ├── auto-retrain.ts            # Scheduled model retraining
│   │   ├── ab-testing.ts              # A/B testing for ML models
│   │   ├── ensemble.ts                # Multi-model ensembles
│   │   ├── feature-engineering.ts     # Custom feature engineering
│   │   └── tools/                     # Advanced ML MCP tools
│   │       ├── snow_ml_schedule_retrain.ts
│   │       ├── snow_ml_ab_test.ts
│   │       └── snow_ml_ensemble_predict.ts
│   │
│   ├── license/
│   │   ├── validator.ts               # License key validation
│   │   ├── activation.ts              # License activation/deactivation
│   │   ├── telemetry.ts               # Usage telemetry (opt-in)
│   │   └── enforcement.ts             # Feature gating
│   │
│   ├── mcp/
│   │   └── enterprise-server.ts       # Enterprise MCP server
│   │       # Registers all enterprise tools as additional MCP server
│   │
│   └── index.ts                       # Enterprise entry point
│
├── config/
│   ├── license-key.json.template      # License key configuration template
│   └── enterprise-features.json       # Feature flags configuration
│
├── docs/
│   ├── jira-integration.md
│   ├── azure-devops-integration.md
│   ├── confluence-integration.md
│   ├── sso-setup.md
│   ├── audit-logging.md
│   └── license-management.md
│
├── LICENSE-ENTERPRISE                 # Proprietary license
├── package.json
├── tsconfig.json
└── README.md                          # Enterprise features documentation
```

### Enterprise Features

**Jira Integration:**
- Bi-directional backlog sync (Jira ↔ ServiceNow)
- AI-powered requirement parsing
- Real-time webhook updates
- Story/Epic/Task mapping
- Developer workflow: `snow-flow dev start SNOW-456` loads Jira context

**Azure DevOps Integration:**
- Work item synchronization (User Stories, Tasks, Bugs)
- Pull request tracking to ServiceNow
- Build pipeline status integration
- Test results auto-documented

**Confluence Integration:**
- Documentation synchronization
- Technical specs → Implementation guides
- Architecture diagrams → Attachment sync

**Enterprise SSO/SAML:**
- SAML 2.0, OAuth 2.0, OIDC
- Active Directory/LDAP integration
- Role-based access control (RBAC)

**Advanced Audit Logging:**
- Comprehensive activity tracking
- Compliance reporting (SOX, GDPR, HIPAA)
- Tamper-proof log storage
- Real-time alerting

**Advanced ML Features:**
- Scheduled auto-retrain
- A/B testing for ML models
- Multi-model ensembles
- Custom feature engineering

**Distribution:**
- NPM: `npm install @snow-flow/enterprise` (requires license key)
- Private registry: `npm config set @snow-flow:registry https://registry.snow-flow.dev`
- Docker: `docker pull snowflow/enterprise:latest` (private registry)

---

## 3. Integration Between Core and Enterprise

### Modular Architecture

Enterprise features extend the core without modifying it:

```typescript
// Core package (@snow-flow/core)
export class ServiceNowClient {
  // Core functionality
  async query(table: string, query: string) { ... }
  async create(table: string, data: object) { ... }
}

// Enterprise package (@snow-flow/enterprise)
import { ServiceNowClient } from '@snow-flow/core';

export class JiraSyncEngine {
  constructor(private snow: ServiceNowClient, private jira: JiraClient) {}

  async syncBacklog(projectKey: string) {
    // Uses core ServiceNowClient to create tasks
    // Adds enterprise Jira integration logic
  }
}
```

### MCP Server Registration

**Core servers** (always available):
```json
{
  "mcpServers": {
    "servicenow": {
      "command": "node",
      "args": ["./dist/mcp/servicenow-mcp-unified/server.js"],
      "env": { "SNOW_INSTANCE": "...", "SNOW_CLIENT_ID": "..." }
    },
    "orchestration": {
      "command": "node",
      "args": ["./dist/mcp/orchestration/server.js"]
    }
  }
}
```

**Enterprise server** (requires license):
```json
{
  "mcpServers": {
    "servicenow": { ... },
    "orchestration": { ... },
    "snow-flow-enterprise": {
      "command": "node",
      "args": ["./node_modules/@snow-flow/enterprise/dist/mcp/enterprise-server.js"],
      "env": {
        "SNOW_FLOW_LICENSE_KEY": "SNOW-ENT-ACME-20261231-ABC123DEF",
        "JIRA_URL": "https://your-company.atlassian.net",
        "JIRA_API_TOKEN": "...",
        "AZURE_DEVOPS_ORG": "...",
        "AZURE_DEVOPS_PAT": "..."
      }
    }
  }
}
```

### License Validation

Enterprise features check license on startup:

```typescript
// @snow-flow/enterprise/src/license/validator.ts
export class LicenseValidator {
  async validate(licenseKey: string): Promise<LicenseInfo> {
    // 1. Parse license key format
    const [prefix, tier, orgId, expiry, checksum] = licenseKey.split('-');

    // 2. Validate checksum (offline validation)
    if (!this.verifyChecksum(licenseKey)) {
      throw new Error('Invalid license key');
    }

    // 3. Check expiry date
    if (new Date(expiry) < new Date()) {
      throw new Error('License expired');
    }

    // 4. Online validation (phone home)
    const response = await fetch('https://license.snow-flow.dev/validate', {
      method: 'POST',
      body: JSON.stringify({ licenseKey, orgId })
    });

    // 5. Return license info
    return {
      tier, // 'PRO', 'TEAM', 'ENT'
      maxDevelopers: this.getMaxDevelopers(tier),
      features: this.getEnabledFeatures(tier),
      expiresAt: new Date(expiry),
      support: this.getSupportLevel(tier)
    };
  }
}
```

---

## 4. Package Dependencies

### Core Package Dependencies

```json
{
  "name": "@snow-flow/core",
  "version": "7.5.0",
  "dependencies": {
    "axios": "^1.7.9",
    "chalk": "^5.4.1",
    "commander": "^13.0.0",
    "dotenv": "^16.4.7",
    "express": "^5.0.2",
    "inquirer": "^13.0.2",
    "winston": "^4.0.0"
  },
  "peerDependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4"
  }
}
```

### Enterprise Package Dependencies

```json
{
  "name": "@snow-flow/enterprise",
  "version": "1.0.0",
  "dependencies": {
    "@snow-flow/core": "^7.5.0",  // Core as dependency
    "jsonwebtoken": "^9.0.2",     // JWT for license validation
    "jira-client": "^8.2.2",      // Jira integration
    "azure-devops-node-api": "^12.5.0", // Azure DevOps
    "saml2-js": "^4.0.2",         // SAML SSO
    "ldapjs": "^3.0.7"            // LDAP/AD integration
  },
  "peerDependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4"
  }
}
```

---

## 5. Developer Workflow

### Using Core Only (Free)

```bash
# Install core
npm install -g @snow-flow/core

# Initialize project
snow-flow init

# Authenticate
snow-flow auth login

# Start developing
snow-flow swarm "create incident dashboard"
```

### Using Core + Enterprise

```bash
# Install both packages
npm install -g @snow-flow/core @snow-flow/enterprise

# Initialize with enterprise features
snow-flow init --enterprise

# Provide license key
export SNOW_FLOW_LICENSE_KEY="SNOW-ENT-ACME-20261231-ABC123DEF"

# Configure integrations (interactive prompts)
snow-flow enterprise configure

# Sync Jira backlog
snow-flow enterprise jira sync --project SNOW

# Start developing with full context
snow-flow dev start SNOW-456  # Loads Jira story, requirements, acceptance criteria
```

---

## 6. Deployment & Distribution

### NPM Packages

**Public Registry (Core):**
```bash
npm publish @snow-flow/core --access public
```

**Private Registry (Enterprise):**

**Option A: NPM Private Registry**
```bash
npm config set @snow-flow:registry https://registry.npmjs.org/
npm publish @snow-flow/enterprise --access restricted
# Requires paid NPM organization ($7/user/month)
```

**Option B: Verdaccio (Self-Hosted)**
```bash
# Setup Verdaccio on AWS/Azure
docker run -d -p 4873:4873 verdaccio/verdaccio

# Configure NPM
npm config set @snow-flow:registry https://registry.snow-flow.dev/

# Publish
npm publish @snow-flow/enterprise
```

**Option C: GitHub Packages**
```bash
npm config set @snow-flow:registry https://npm.pkg.github.com
npm publish @snow-flow/enterprise
# Free for private packages
```

### Docker Images

**Core (Public):**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install -g @snow-flow/core
CMD ["snow-flow", "start"]
```

```bash
docker build -t snowflow/core:7.5.0 .
docker push snowflow/core:7.5.0
```

**Enterprise (Private):**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install -g @snow-flow/enterprise
CMD ["snow-flow", "enterprise", "start"]
```

```bash
docker build -t snowflow/enterprise:1.0.0 .
docker push registry.snow-flow.dev/enterprise:1.0.0
```

---

## 7. Version Management

### Semantic Versioning

**Core:** `MAJOR.MINOR.PATCH` (follows semver)
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes

**Enterprise:** `MAJOR.MINOR.PATCH` (independent versioning)
- MAJOR: Matches core major version (e.g., both 7.x.x)
- MINOR: New enterprise features
- PATCH: Bug fixes

**Compatibility Matrix:**
```
Core 7.5.x ↔ Enterprise 1.0.x ✅
Core 8.0.x ↔ Enterprise 2.0.x ✅
Core 7.5.x ↔ Enterprise 2.0.x ❌ (incompatible)
```

### Release Strategy

**Core Releases:**
- Weekly patch releases (bug fixes)
- Monthly minor releases (new features)
- Quarterly major releases (breaking changes)

**Enterprise Releases:**
- Monthly releases (synced with core minors)
- Hotfix releases as needed (security, critical bugs)

---

## 8. CI/CD Pipeline

### Core (GitHub Actions)

```yaml
# .github/workflows/core-release.yml
name: Core Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-and-publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm publish --access public
```

### Enterprise (GitHub Actions - Private)

```yaml
# .github/workflows/enterprise-release.yml
name: Enterprise Release

on:
  push:
    tags:
      - 'enterprise-v*'

jobs:
  build-and-publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
      - run: npm test
      - name: Publish to private registry
        run: npm publish --registry https://registry.snow-flow.dev
        env:
          NPM_TOKEN: ${{ secrets.NPM_PRIVATE_TOKEN }}
```

---

## 9. Security Considerations

### Code Signing

**Core:**
- All releases signed with GPG key
- npm packages include `npm-signature.json`
- Verifiable via: `npm verify @snow-flow/core@7.5.0`

**Enterprise:**
- Additional code signing for license validation
- Binary obfuscation for proprietary algorithms
- Encrypted license key verification

### Secret Management

**Core:**
- No secrets in repository
- `.env.example` for template
- GitHub Secrets for CI/CD

**Enterprise:**
- Private keys for license validation (HSM-stored)
- Integration credentials (Jira/Azure DevOps) user-provided
- Encryption keys for audit logs (AWS KMS/Azure Key Vault)

---

## 10. Migration Path for Users

### Current Users (Open Source)

**No breaking changes:**
```bash
# Existing users continue as-is
npm update -g snow-flow  # Updates to @snow-flow/core automatically
```

**Opt-in to Enterprise:**
```bash
npm install -g @snow-flow/enterprise
snow-flow enterprise configure
# Provide license key via prompt or env variable
```

### New Users

**Free Tier:**
```bash
npm install -g @snow-flow/core
snow-flow init
```

**Enterprise Tier:**
```bash
npm install -g @snow-flow/enterprise  # Includes core as dependency
snow-flow init --enterprise
```

---

## 11. Future Enhancements

### Planned Features (Core)

**Q2 2025:**
- Improved UI Builder tooling
- Enhanced ML transparency
- Performance optimizations

**Q3 2025:**
- Plugin system for community extensions
- Additional LLM provider integrations
- Advanced testing frameworks

### Planned Features (Enterprise)

**Q2 2025:**
- GitHub integration (PR tracking, Issues sync)
- Linear integration (product management)
- GitLab integration (CI/CD + Issues)

**Q3-Q4 2025:**
- Asana integration (project management)
- Slack integration (notifications, ChatOps)
- Multi-tenant architecture (SaaS offering)
- White-label options (ISVs, consulting firms)

---

## 12. Partner/Reseller Distribution

### Capgemini Partnership Model

**Option A: Bundled Distribution**
```bash
# Capgemini provides internal npm registry
npm install -g @capgemini/snow-flow
# Includes: Core + Enterprise + Capgemini-specific customizations
```

**Option B: License Key Distribution**
```bash
# Capgemini provides license keys to consultants
export SNOW_FLOW_LICENSE_KEY="SNOW-ENT-ACME-20261231-ABC123DEF"
npm install -g @snow-flow/enterprise
```

**Option C: White-Label**
```bash
# Capgemini fully white-labeled version
npm install -g @capgemini/servicenow-accelerator
# Powered by Snow-Flow (attribution required per license)
```

---

## Summary

This repository structure enables:

1. **Open Core Model** - MIT core + Proprietary enterprise
2. **Clear Separation** - Core and enterprise in separate repos
3. **Modular Architecture** - Enterprise extends core without modification
4. **License Validation** - Secure license key system
5. **Partner Support** - Reseller and white-label options
6. **Scalability** - Independent versioning and release cycles

**Next Steps:**
1. Create `snow-flow-bv/snow-flow-enterprise` private repository
2. Implement license validation system
3. Build Jira integration as first enterprise feature
4. Setup private npm registry (GitHub Packages recommended)
5. Update `@snow-flow/core` package.json to reference optional enterprise package

**Questions?** See [MONETIZATION_STRATEGY.md](./MONETIZATION_STRATEGY.md) for business model details.
