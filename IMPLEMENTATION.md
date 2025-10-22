# Enterprise Implementation Summary

This document provides a technical overview of the Snow-Flow Enterprise implementation.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Snow-Flow Core (OSS)                      │
│                    Elastic License 2.0                        │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ Optional Dependency
                       ↓
┌──────────────────────────────────────────────────────────────┐
│                 Snow-Flow Enterprise                          │
│                 Commercial License                            │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────┐│
│  │ License Module  │  │ Jira Integration │  │  MCP Tools   ││
│  │                 │  │                  │  │              ││
│  │ • Validator     │  │ • API Client     │  │ • 8 Tools    ││
│  │ • Cache         │  │ • Sync Engine    │  │ • Handlers   ││
│  │ • Phone-home    │  │ • Field Mapping  │  │ • Schemas    ││
│  └────────┬────────┘  └──────────────────┘  └──────────────┘│
│           │                                                   │
└───────────┼───────────────────────────────────────────────────┘
            │
            │ HTTPS (License Validation)
            ↓
┌──────────────────────────────────────────────────────────────┐
│                     License Server                            │
│                  (Separate Deployment)                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Express API  │  │ SQLite Database │  │ Validation      │ │
│  │              │  │                 │  │ Service         │ │
│  │ • /validate  │  │ • licenses      │  │                 │ │
│  │ • /stats     │  │ • instances     │  │ • HMAC Verify   │ │
│  │ • /health    │  │ • logs          │  │ • Instance Check│ │
│  └──────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. License Module (`enterprise/src/license/`)

**Purpose**: Validate enterprise licenses with phone-home mechanism

**Files**:
- `types.ts` - TypeScript interfaces and types
- `validator.ts` - Core validation logic with caching
- `index.ts` - Module exports

**Key Features**:
- HMAC signature verification for request authenticity
- Disk-based caching at `~/.snow-flow/license.cache`
- 7-day grace period for offline scenarios
- Instance ID generation and persistence
- Exponential backoff retry logic (3 attempts)
- Feature-specific validation

**Flow**:
1. Check cache validity (24h check interval)
2. If cache valid and within check interval → return cached result
3. Build validation request with HMAC signature
4. POST to license server `/validate` endpoint
5. Verify response and update cache
6. Return validation result

### 2. Jira Integration (`enterprise/src/integrations/jira/`)

**Purpose**: Connect Jira and ServiceNow with bidirectional sync

**Files**:
- `types.ts` - Jira API types and interfaces
- `api-client.ts` - Jira REST API client
- `sync-engine.ts` - Synchronization orchestration
- `index.ts` - Module exports

**API Client Methods**:
- `getIssue(issueKey)` - Fetch single issue
- `searchIssues(jql, maxResults, startAt)` - JQL search
- `updateIssue(issueKey, fields)` - Update fields
- `addComment(issueKey, comment)` - Add comment
- `getBacklog(projectKey, sprint)` - Get backlog issues
- `getTransitions(issueKey)` - Get available transitions
- `transitionIssue(issueKey, transitionId)` - Change status
- `getComments(issueKey)` - Fetch comments

**Sync Engine Features**:
- JQL query builder from options
- Dry-run mode (preview without syncing)
- Per-issue error collection
- Comprehensive result reporting
- TODO: ServiceNow integration (placeholder for core integration)

### 3. MCP Tools (`enterprise/src/tools/`)

**Purpose**: Expose enterprise features through MCP protocol

**Tools Implemented**:
1. `snow_jira_sync_backlog` - Sync project backlog to ServiceNow
2. `snow_jira_get_issue` - Get issue details
3. `snow_jira_search_issues` - JQL search
4. `snow_jira_add_comment` - Add comment
5. `snow_jira_update_issue` - Update fields
6. `snow_jira_transition_issue` - Change status
7. `snow_jira_get_transitions` - Get available transitions
8. `snow_jira_get_comments` - Fetch comments

**Tool Structure**:
- Input schema (JSON Schema)
- Handler function (async)
- License validation (per-call)
- Error handling
- Result formatting

### 4. License Server (`enterprise/license-server/`)

**Purpose**: Centralized license validation API

**Stack**:
- Express.js - REST API
- better-sqlite3 - Database
- Winston - Logging
- Helmet - Security
- express-rate-limit - Rate limiting

**Endpoints**:

**POST /validate**
- Validates license keys
- Checks HMAC signatures
- Enforces instance limits
- Returns feature lists
- Logs validation attempts

**GET /stats/:key**
- Returns license statistics
- Requires admin authentication
- Shows instance count
- Validation metrics (30-day)

**GET /health**
- Health check endpoint
- Returns uptime
- No authentication required

**Database Schema**:

**licenses table**:
- License keys and metadata
- Tier and status
- Expiration dates
- Feature lists (JSON)
- Instance limits

**license_instances table**:
- Active installations
- Instance IDs
- Last seen timestamps
- Version tracking
- IP addresses

**validation_logs table**:
- All validation attempts
- Success/failure status
- Error codes
- Timestamps
- IP addresses

**Security Features**:
- HMAC request signing
- Timestamp validation (5-min window)
- Rate limiting (100/15min)
- Helmet.js security headers
- Admin key authentication
- Replay attack prevention

## Deployment Architecture

### Client-Side (Snow-Flow Enterprise)

**Installation**:
```bash
npm install -g @snow-flow/enterprise
```

**Configuration**:
- Environment variable: `SNOW_LICENSE_KEY`
- Config file: `~/.snow-flow/enterprise.config.json`
- Instance ID: `~/.snow-flow/instance.id`
- Cache file: `~/.snow-flow/license.cache`

**Runtime Behavior**:
- On startup: Validate license (or use cache)
- Every feature call: Check license includes feature
- Every 24h: Revalidate with server
- On offline: Use cached license (7-day grace period)

### Server-Side (License Server)

**Deployment Options**:

1. **Docker**:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
```

2. **PM2**:
```bash
pm2 start dist/index.js --name license-server
pm2 startup
pm2 save
```

3. **Systemd**:
```ini
[Unit]
Description=Snow-Flow License Server
After=network.target

[Service]
Type=simple
User=snow-flow
WorkingDirectory=/opt/snow-flow-license-server
ExecStart=/usr/bin/node dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

**Environment Variables**:
```env
NODE_ENV=production
PORT=3000
DB_PATH=./data/licenses.db
ADMIN_KEY=<secure-random-key>
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info
```

**Backup Strategy**:
- Daily database backups
- 30-day retention
- Offsite replication
- Point-in-time recovery

## Testing Strategy

### Unit Tests (TODO)

**License Module**:
- `validator.test.ts` - Test validation logic
- Mock license server responses
- Test cache behavior
- Test grace period
- Test error handling

**Jira Integration**:
- `api-client.test.ts` - Test API calls
- `sync-engine.test.ts` - Test sync logic
- Mock Jira API responses
- Test JQL query builder
- Test error scenarios

**MCP Tools**:
- `mcp-tools.test.ts` - Test tool handlers
- Mock license validation
- Mock Jira client
- Test input validation
- Test error responses

### Integration Tests (TODO)

**End-to-End License Flow**:
1. Initialize enterprise with license key
2. Validate license with server
3. Call feature requiring license
4. Verify feature works
5. Test offline scenario (grace period)

**End-to-End Jira Sync**:
1. Configure Jira credentials
2. Search for issues via MCP tool
3. Sync issues to ServiceNow
4. Verify ServiceNow records created
5. Update Jira issue
6. Verify sync updates

### Manual Testing Checklist

- [ ] Install enterprise package
- [ ] Set license key
- [ ] Verify license status command
- [ ] Test license validation (online)
- [ ] Test grace period (offline)
- [ ] Test Jira connection
- [ ] Test JQL search
- [ ] Test issue sync (dry run)
- [ ] Test issue sync (real)
- [ ] Test comment sync
- [ ] Test status transitions
- [ ] Test instance limit enforcement
- [ ] Test license expiration
- [ ] Test invalid license key
- [ ] Test MCP tool integration

## Security Considerations

### Client-Side

**License Key Storage**:
- Never commit to version control
- Use environment variables
- Secure file permissions on config files
- Rotate keys periodically

**HMAC Signing**:
- All requests signed with license key
- Prevents request tampering
- Server verifies signatures

**Instance ID**:
- Persistent machine identifier
- Based on hardware characteristics
- Prevents license sharing

### Server-Side

**Authentication**:
- HMAC verification required
- Timestamp validation (prevents replays)
- Admin key for stats endpoint

**Rate Limiting**:
- 100 requests per 15 minutes per IP
- Prevents brute force attacks
- DDoS protection

**Database Security**:
- SQLite with WAL mode
- File permissions restricted
- Regular backups
- Encrypted at rest (optional)

**Logging**:
- All validation attempts logged
- IP addresses recorded
- Error details captured
- Log rotation configured

## Performance Optimization

### Client-Side

**Caching**:
- 24-hour check interval (configurable)
- Disk-based cache persistence
- Grace period for offline use
- Concurrent validation prevention

**Retry Logic**:
- Exponential backoff (1s, 2s, 4s)
- Maximum 3 retry attempts
- Only retry recoverable errors

### Server-Side

**Database**:
- SQLite WAL mode (concurrent reads)
- Indexes on frequently queried fields
- Prepared statements (SQL injection prevention)
- Connection pooling (future: migrate to PostgreSQL)

**API**:
- Compression middleware
- Response caching headers
- Minimal response payloads
- Async validation operations

## Monitoring & Observability

### Metrics to Track

**Client-Side**:
- Validation success rate
- Cache hit rate
- Grace period usage
- Feature usage by license tier

**Server-Side**:
- Request rate (per endpoint)
- Response time (p50, p95, p99)
- Error rate (by error code)
- Active instance count
- Database query performance

### Logging

**Client-Side** (winston):
- License validation attempts
- Feature access attempts
- Cache operations
- Error details

**Server-Side** (winston):
- All API requests
- Validation results
- Database operations
- Error stack traces

### Alerting

**Critical Alerts**:
- License server downtime
- Database corruption
- Validation failure spike
- Instance limit violations

**Warning Alerts**:
- High error rate (>5%)
- Slow response time (>1s)
- Low disk space
- Expiring licenses (30 days)

## Future Enhancements

### Phase 2: Additional Integrations
- Azure DevOps integration
- GitHub integration
- GitLab integration
- Confluence integration

### Phase 3: Advanced Features
- Multi-tenant license management
- Usage-based billing
- Feature toggles (per-license)
- License transfer API
- Self-service license portal

### Phase 4: Scalability
- Migrate to PostgreSQL
- Redis caching layer
- Load balancer
- Multi-region deployment
- CDN for license validation

## Support & Maintenance

### Regular Maintenance

**Weekly**:
- Review validation logs
- Check error rates
- Monitor instance counts

**Monthly**:
- Database optimization
- Log rotation
- Security updates
- Performance review

**Quarterly**:
- License renewals
- Feature usage analysis
- Customer feedback review
- Roadmap updates

### Support Tiers

**Team**: 48h response, community support
**Professional**: 24h response, priority support
**Enterprise**: 4h response, dedicated account manager

## Conclusion

The Snow-Flow Enterprise implementation provides a robust, secure, and scalable foundation for monetizing advanced features while maintaining the open-core model. The architecture supports:

- ✅ Secure license validation with phone-home
- ✅ Offline operation with grace period
- ✅ Instance limit enforcement
- ✅ Feature-based licensing
- ✅ Comprehensive error handling
- ✅ Production-ready security
- ✅ Scalable architecture

Next steps: Complete integration testing and deploy license server to production.
