# Snow-Flow Enterprise

**Commercial License - Private Repository**

Enterprise-grade features for Snow-Flow, providing advanced integrations, security, and compliance capabilities for large-scale ServiceNow deployments.

## 🎯 Features

### Integrations
- **Jira Deep Integration** - Bi-directional sync, backlog management, automated workflows
- **Azure DevOps Integration** - Work item sync, pipeline integration, release management
- **Confluence Integration** - Knowledge base sync, automated documentation

### Security & Compliance
- **SSO/SAML Authentication** - Enterprise identity provider integration
- **Advanced Audit Logging** - Comprehensive activity tracking and compliance reporting
- **Role-Based Access Control** - Granular permission management

### License Management
- **Automated Validation** - Phone-home license verification
- **Usage Monitoring** - Track instances and user activity
- **Grace Period Support** - Continue working during temporary connectivity issues

## 📦 Installation

**Requirements:**
- Valid Snow-Flow Enterprise license key
- Snow-Flow Core >= 8.5.1 (npm install -g snow-flow@8.5.1)
- Node.js >= 18.0.0

```bash
npm install @snow-flow/enterprise
```

## 🔑 License Key Setup

### Environment Variable (Recommended)
```bash
export SNOW_LICENSE_KEY="SNOW-ENT-YOUR-KEY"
```

### Programmatic Configuration
```typescript
import { LicenseValidator } from '@snow-flow/enterprise';

// Set license key at startup
LicenseValidator.getInstance().setLicenseKey('SNOW-ENT-YOUR-KEY');
```

### Configuration File
```json
// .snow-flow-enterprise.json
{
  "license": {
    "key": "SNOW-ENT-YOUR-KEY",
    "server": "https://license.snow-flow.dev"
  }
}
```

## 🚀 Quick Start

### Jira Integration Example
```typescript
import { JiraApiClient, JiraSyncEngine } from '@snow-flow/enterprise';

// Initialize Jira client
const jiraClient = new JiraApiClient({
  host: 'your-domain.atlassian.net',
  username: 'your-email@company.com',
  password: 'your-api-token', // Or API token
  protocol: 'https',
  apiVersion: '2',
  strictSSL: true
});

// Sync backlog to ServiceNow
const syncEngine = new JiraSyncEngine(jiraClient);
const result = await syncEngine.syncBacklog({
  projectKey: 'SNOW',
  sprint: 'Sprint 23'
});

console.log(`✅ Synced ${result.synced} issues`);
```

### Using MCP Tools (OpenCode/Claude Code)
```javascript
// Available MCP tools are automatically registered
await snow_jira_sync_backlog({
  projectKey: 'SNOW',
  sprint: 'Sprint 23'
});

await snow_jira_get_issue({
  issueKey: 'SNOW-123'
});
```

## 📚 Documentation

Full documentation available at: https://docs.snow-flow.dev/enterprise

- [Getting Started](https://docs.snow-flow.dev/enterprise/getting-started)
- [Jira Integration Guide](https://docs.snow-flow.dev/enterprise/jira)
- [Azure DevOps Integration](https://docs.snow-flow.dev/enterprise/azure-devops)
- [SSO Configuration](https://docs.snow-flow.dev/enterprise/sso)
- [License Management](https://docs.snow-flow.dev/enterprise/license)

## 🔧 Configuration

### Environment Variables
```bash
# License configuration
SNOW_LICENSE_KEY=<your-license-key>
SNOW_LICENSE_SERVER=https://license.snow-flow.dev

# Jira configuration
JIRA_HOST=your-domain.atlassian.net
JIRA_USERNAME=your-email@company.com
JIRA_API_TOKEN=your-api-token

# Azure DevOps configuration
AZURE_DEVOPS_ORG=your-org
AZURE_DEVOPS_PAT=your-personal-access-token

# Confluence configuration
CONFLUENCE_HOST=your-domain.atlassian.net
CONFLUENCE_USERNAME=your-email@company.com
CONFLUENCE_API_TOKEN=your-api-token
```

## 🏢 Enterprise Support

### Support Channels
- **Email**: support@snow-flow.dev
- **Phone**: Available to Enterprise tier customers
- **Slack**: Private enterprise Slack channel
- **Portal**: https://support.snow-flow.dev

### SLA
- **Enterprise Tier**: 24/7 support, 4-hour response time
- **Professional Tier**: Business hours, 24-hour response time
- **Team Tier**: Email support, 48-hour response time

## 📊 License Tiers

| Feature | Team | Professional | Enterprise |
|---------|------|--------------|------------|
| Max Instances | 5 | 25 | 100+ |
| Jira Integration | ✅ | ✅ | ✅ |
| Azure DevOps | ❌ | ✅ | ✅ |
| Confluence | ❌ | ✅ | ✅ |
| SSO/SAML | ❌ | ❌ | ✅ |
| Audit Logging | ❌ | ✅ | ✅ |
| Priority Support | ❌ | ✅ | ✅ |
| Phone Support | ❌ | ❌ | ✅ |
| Dedicated Account Manager | ❌ | ❌ | ✅ |

## 🔒 Security

- **Data Encryption**: All data encrypted in transit (TLS 1.3) and at rest (AES-256)
- **License Validation**: Secure phone-home with JWT tokens
- **No Data Collection**: Only license validation data transmitted to Snow-Flow servers
- **SOC 2 Compliant**: Annual security audits available upon request

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Build for production (includes obfuscation)
npm run build:prod
```

## 📝 License

Commercial License - See [LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md)

**This software is proprietary and confidential.** Unauthorized use, reproduction, or distribution is strictly prohibited.

## 💼 Sales & Licensing

**Start a trial:**
https://snow-flow.dev/enterprise/trial

**Request a quote:**
Email: sales@snow-flow.dev

**Contact sales:**
Phone: +31 (0)20 123 4567 (Netherlands)
Phone: +1 (555) 123-4567 (United States)

---

Copyright © 2025 Snow-Flow B.V. All rights reserved.
