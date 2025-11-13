# Snow-Flow Enterprise MCP Proxy

## Overview

The Enterprise MCP Proxy bridges **SnowCode CLI** (stdio MCP protocol) with the **Snow-Flow Enterprise License Server** (HTTPS REST API), enabling enterprise features like Jira, Azure DevOps, and Confluence integrations.

## Architecture

```
┌─────────────┐  stdio MCP   ┌──────────────┐  HTTPS REST   ┌─────────────────┐
│  SnowCode   │─────────────▶│  MCP Proxy   │──────────────▶│ License Server  │
│  CLI        │◀─────────────│  (LOKAAL)    │◀──────────────│  (CLOUD - GCP)  │
└─────────────┘              └──────────────┘               └─────────────────┘
```

## Configuration

The proxy is automatically configured when running `snow-flow auth login` with an enterprise license key.

### Environment Variables

```bash
# Required
SNOW_LICENSE_KEY=SNOW-ENT-CUST-ABC123
SNOW_ENTERPRISE_URL=https://license-server.run.app

# Optional: Local credentials (otherwise server-side)
JIRA_HOST=https://company.atlassian.net
JIRA_EMAIL=user@company.com
JIRA_API_TOKEN=ATATT3xFfGF...

AZURE_DEVOPS_ORG=mycompany
AZURE_DEVOPS_PAT=xxxxxxxxxxxxxxxx

CONFLUENCE_HOST=https://company.atlassian.net
CONFLUENCE_EMAIL=user@company.com
CONFLUENCE_API_TOKEN=ATATT3xFfGF...
```

### SnowCode Configuration

Automatically added to `~/.snow-code/config.json`:

```json
{
  "mcpServers": {
    "snow-flow-enterprise": {
      "command": "node",
      "args": ["node_modules/snow-flow/dist/mcp/enterprise-proxy/index.js"],
      "env": {
        "SNOW_LICENSE_KEY": "SNOW-ENT-CUST-ABC123",
        "SNOW_ENTERPRISE_URL": "https://license-server.run.app",
        "JIRA_HOST": "...",
        "JIRA_EMAIL": "...",
        "JIRA_API_TOKEN": "..."
      }
    }
  }
}
```

## Files

- **index.ts** - MCP Server entry point (stdio transport)
- **proxy.ts** - HTTPS client for enterprise server communication
- **credentials.ts** - Environment variable credential gathering
- **types.ts** - TypeScript type definitions

## Usage

### Automatic (Recommended)

```bash
# During snow-flow auth login
$ snow-flow auth login

? Do you have a Snow-Flow Enterprise license? Yes
? Enterprise License Key: SNOW-ENT-CUST-ABC123

✓ Enterprise MCP Proxy configured
✓ .snow-code/config.json updated
```

### Manual Testing

```bash
# Set environment variables
export SNOW_LICENSE_KEY=SNOW-ENT-CUST-ABC123
export SNOW_ENTERPRISE_URL=https://license-server.run.app

# Run proxy directly (for debugging)
node dist/mcp/enterprise-proxy/index.js
```

## Security

### License Key Authentication

- License key sent in `Authorization: Bearer` header
- Server validates format, customer status, and expiration
- Rate limiting: 100 requests / 15 minutes per customer

### Credentials

**Option 1: Local (in environment)**
- Credentials read from environment variables
- Sent to server in HTTPS request body (encrypted in transit)
- Simple setup, no server-side configuration needed

**Option 2: Server-side (encrypted)**
- Credentials stored encrypted in enterprise server database
- Not sent in requests, server uses own credentials
- Requires SSO configuration, most secure option

### Machine Fingerprinting

- Unique machine ID generated via `node-machine-id`
- Sent in `X-Instance-ID` header for seat tracking
- Privacy-preserving (hashed, not actual MAC addresses)

## Error Handling

The proxy handles common errors gracefully:

- **401 Unauthorized**: Invalid or expired license key
- **403 Forbidden**: Access denied, check license status
- **404 Not Found**: Tool not found in enterprise catalog
- **429 Too Many Requests**: Rate limit exceeded
- **ECONNREFUSED**: Cannot connect to enterprise server
- **ETIMEDOUT**: Request timeout (2 minutes)

## Development

### Building

```bash
npm run build
```

### Testing

```bash
# Unit tests
npm test

# Integration test with mock server
npm run test:integration
```

## License

Open Source (Elastic License v2)
Part of the Snow-Flow platform
