# Privacy Policy - Snow-Flow

**Effective Date:** December 18, 2024
**Last Updated:** December 18, 2024
**Version:** 1.0

## 1. Introduction

This Privacy Policy describes how Snow-Flow B.V. ("Snow-Flow", "we", "us", or "our") handles information in connection with the Snow-Flow open-source software ("Software"). Snow-Flow is an AI-powered ServiceNow development platform distributed under the Elastic License 2.0.

**Important Notice:** Snow-Flow is open-source software that runs locally on your machine. We do not operate a centralized service that collects your data. This policy explains what data the Software processes locally and how third-party services you connect to may handle your data.

## 2. Our Role as Data Processor

Snow-Flow is a **local development tool**. When you use Snow-Flow:

- **You are the Data Controller**: You maintain full control over all data processed by the Software
- **We do not collect your data**: Snow-Flow does not transmit data to Snow-Flow B.V.
- **Data stays local**: All credentials and configurations are stored on your local machine
- **Third-party connections are yours**: Connections to ServiceNow, LLM providers, and other services are configured and controlled by you

## 3. Data Processed by Snow-Flow

### 3.1 Credentials and Authentication Data

Snow-Flow stores authentication credentials locally to connect to your ServiceNow instance and other services:

| Data Type | Storage Location | Purpose |
|-----------|------------------|---------|
| ServiceNow OAuth credentials | `~/.local/share/snow-code/auth.json` | ServiceNow API authentication |
| OAuth access/refresh tokens | `~/.snow-flow/token-cache.json` | Cached tokens (auto-managed) |
| LLM provider API keys | `~/.config/snow-code/config.json` | AI provider authentication |
| MCP server configuration | `.mcp.json` (project directory) | Tool configuration |
| Environment variables | `.env` (project directory) | Instance-specific settings |

**Security Measures:**
- Credential files have restrictive permissions (0600)
- Token cache is automatically cleaned and refreshed
- `.env` files are excluded from git by default
- No credentials are transmitted to Snow-Flow B.V.

### 3.2 ServiceNow Instance Data

When you connect Snow-Flow to a ServiceNow instance, the Software may access:

- **Records**: Incidents, changes, users, assets, CMDB items, knowledge articles
- **Artifacts**: Widgets, business rules, script includes, workflows, UI pages
- **Metadata**: Table schemas, field definitions, relationships, ACLs
- **Configuration**: System properties, OAuth settings, update sets, application scopes
- **Logs**: Script execution logs, job history, error logs

**Important:** This data is accessed directly from your ServiceNow instance via OAuth-authenticated API calls. Snow-Flow B.V. does not have access to your ServiceNow data.

### 3.3 Local Caching

Snow-Flow may cache data locally for performance optimization:

- **Query results**: Cached in Better SQLite3 database (local only)
- **Token cache**: OAuth tokens with automatic expiration management
- **Session data**: MCP session information
- **Logs**: Execution history in `~/.snow-flow/logs/`

All cached data remains on your local machine and can be deleted at any time.

### 3.4 AI/LLM Provider Data

Snow-Flow supports 75+ LLM providers (Claude, OpenAI, etc.). When you use an LLM provider:

- **Prompts and responses** are sent directly to your chosen LLM provider
- **Snow-Flow does not intercept** or store AI conversations
- **Your LLM provider's privacy policy** governs how they handle your data
- **API keys** are stored locally and sent directly to the provider

We recommend reviewing the privacy policy of your chosen LLM provider.

## 4. Data We DO NOT Collect

Snow-Flow B.V. does **not** collect:

- ❌ Your ServiceNow credentials or data
- ❌ Your LLM API keys or conversations
- ❌ Usage telemetry or analytics
- ❌ Personal information from your development activities
- ❌ Source code you develop using Snow-Flow
- ❌ Business logic or configurations you create

## 5. Third-Party Services

### 5.1 ServiceNow

When you connect to ServiceNow:
- Data is transferred directly between your machine and your ServiceNow instance
- ServiceNow's privacy policy governs their handling of your data
- Snow-Flow uses OAuth 2.0 for secure authentication

### 5.2 LLM Providers

When you use AI features:
- Requests go directly to your configured LLM provider
- Each provider has their own privacy policy and data retention practices
- Common providers include:
  - **Anthropic (Claude)**: https://www.anthropic.com/privacy
  - **OpenAI**: https://openai.com/policies/privacy-policy
  - **Google (Gemini)**: https://policies.google.com/privacy
  - **AWS Bedrock**: https://aws.amazon.com/privacy/

### 5.3 npm Registry

When installing Snow-Flow via npm:
- npm's privacy policy applies to the download
- No usage data is sent to npm after installation

## 6. Open Source Transparency

Snow-Flow is open-source software available at https://github.com/groeimetai/snow-flow. You can:

- **Inspect the code**: Verify exactly what the Software does
- **Audit data handling**: Review how credentials and data are processed
- **Modify the Software**: Adapt it to your privacy requirements
- **Self-host entirely**: No external dependencies required

## 7. Data Security

### 7.1 Local Security Measures

- **File permissions**: Credential files use restrictive permissions (readable only by owner)
- **No plaintext passwords**: OAuth tokens are used instead of passwords
- **Token expiration**: Access tokens expire and are refreshed automatically
- **Git exclusion**: Sensitive files are excluded from version control by default

### 7.2 Your Responsibilities

As the operator of Snow-Flow, you are responsible for:

- Securing your local machine and file system
- Protecting your ServiceNow OAuth credentials
- Managing access to your LLM API keys
- Ensuring your ServiceNow instance is properly secured
- Complying with your organization's security policies

## 8. Data Retention

### 8.1 Local Data

All data stored by Snow-Flow is under your control:

| Data Type | Default Retention | How to Delete |
|-----------|-------------------|---------------|
| OAuth tokens | Until expiration/logout | `snow-flow auth logout` or delete token cache |
| Credentials | Until manually removed | Delete `auth.json` file |
| Cache data | Managed automatically | Delete `~/.snow-flow/` directory |
| Logs | Indefinite | Delete `~/.snow-flow/logs/` |
| Project config | Indefinite | Delete project `.env` and `.mcp.json` |

### 8.2 Third-Party Retention

Data sent to third-party services (ServiceNow, LLM providers) is subject to their retention policies.

## 9. Your Rights

Since Snow-Flow processes data locally and we do not collect your personal data, traditional data subject rights (access, rectification, erasure, portability) are exercised through:

- **Local control**: You have direct access to all data on your machine
- **Self-service deletion**: Delete any Snow-Flow data by removing the relevant files
- **Configuration control**: Modify or remove any third-party connections

If you believe Snow-Flow B.V. has inadvertently collected your data, contact us at privacy@snow-flow.dev.

## 10. Children's Privacy

Snow-Flow is a professional software development tool not intended for use by children under 16 years of age.

## 11. International Data Transfers

Snow-Flow operates locally on your machine. Any international data transfers occur when:

- You connect to a ServiceNow instance hosted in another region
- You use an LLM provider with servers in another region

These transfers are governed by the respective service providers' policies.

## 12. Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be indicated by:

- Updated "Last Updated" date
- Version number increment
- Changelog in the repository

Significant changes will be announced via our GitHub repository.

## 13. Contact Information

For privacy-related questions or concerns:

**Snow-Flow B.V.**
Email: privacy@snow-flow.dev
GitHub: https://github.com/groeimetai/snow-flow/issues

## 14. Jurisdiction

This Privacy Policy is governed by the laws of the Netherlands. Snow-Flow B.V. is registered in the Netherlands.

---

## Summary

| Aspect | Snow-Flow Approach |
|--------|-------------------|
| **Data Collection** | None - Software runs locally |
| **Credential Storage** | Local files only (your machine) |
| **Telemetry** | None |
| **Third-party Data Sharing** | Only what you configure (ServiceNow, LLM providers) |
| **Open Source** | Fully auditable code |
| **Your Control** | 100% - all data on your machine |

---

*This Privacy Policy applies to Snow-Flow open-source software. For Snow-Flow Enterprise (our paid SaaS offering), please refer to the Snow-Flow Enterprise Privacy Policy.*
