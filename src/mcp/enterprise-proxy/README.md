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

## Available Enterprise Tools

### 🎯 Jira Agent Intelligence (22 Tools)

The enterprise proxy includes comprehensive Jira integration with AI-powered workflow intelligence.

#### Phase 1: Foundation Tools (4)
1. **jira_get_active_sprint** - Get current sprint context and progress
2. **jira_get_epic_hierarchy** - View complete epic breakdown and story structure
3. **jira_get_board** - Board workflow, columns, and WIP limits
4. **jira_get_issue_comments** - Team discussions and collaboration context

#### Phase 2: Intelligence Tools (4)
5. **jira_create_user_story** - AI-generated user stories with acceptance criteria
6. **jira_analyze_issue_dependencies** - Automatic blocker and dependency detection
7. **jira_estimate_story_points** - AI-powered story point estimation
8. **jira_decompose_epic** - Automated epic breakdown into user stories

#### Phase 3: Optimization Tools (6)
9. **jira_suggest_next_task** - Smart task suggestions based on context
10. **jira_get_sprint_velocity** - Team velocity tracking and forecasting
11. **jira_find_similar_issues** - Duplicate detection and historical insights
12. **jira_bulk_update_issues** - Efficient bulk operations
13. **jira_get_team_capacity** - Team capacity analysis and planning
14. **jira_create_sprint_report** - Comprehensive sprint reporting

#### Original Jira Tools (8)
15. **jira_create_issue** - Create Jira issues
16. **jira_update_issue** - Update existing issues
17. **jira_get_issue** - Get issue details
18. **jira_search_issues** - JQL search
19. **jira_add_comment** - Add comments to issues
20. **jira_assign_issue** - Assign issues to users
21. **jira_transition_issue** - Workflow transitions
22. **jira_get_transitions** - Get available transitions

**Example Usage:**
```javascript
// AI suggests next task based on sprint, dependencies, and your skills
await jira_suggest_next_task({
  board_id: 123,
  user_id: "john.doe"
});
// Returns: "PROJ-102 (OAuth integration) - Blocks 3 stories, matches your skills"

// AI decomposes epic into stories
await jira_decompose_epic({
  epic_key: "PROJ-50"
});
// Creates 4 user stories with acceptance criteria and estimates
```

### Azure DevOps Integration (Coming Soon)
- Work item management
- Pipeline automation
- Repository operations

### Confluence Integration (Coming Soon)
- Page creation and updates
- Space management
- Content search

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
