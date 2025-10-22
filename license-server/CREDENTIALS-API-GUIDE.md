# Self-Service Credentials API - Complete Guide

## 📋 Overview

The Credentials API allows Service Integrator customers to securely manage their OAuth2 credentials and API tokens for enterprise integrations (Jira, Azure DevOps, Confluence, ServiceNow).

**Key Features:**
- ✅ OAuth2 authorization flows for all services
- ✅ Secure credential storage with AES-256-GCM encryption
- ✅ Automatic token refresh (runs every 5 minutes)
- ✅ Connection testing
- ✅ SSO authentication required
- ✅ Per-customer credential management

**Base URL:** `https://your-license-server.run.app/api/credentials`

**Authentication:** All endpoints require SSO authentication (JWT token in `Authorization: Bearer <token>` header)

---

## 🔐 Authentication

All Credentials API endpoints require SSO authentication. You must first authenticate via SSO and obtain a JWT token.

### Step 1: Authenticate via SSO

```bash
# Login via SSO
curl -X GET "https://your-license-server.run.app/sso/login/{customerId}"
# Follow the redirect to your IdP, complete authentication

# After callback, you'll receive a JWT token
```

### Step 2: Use JWT Token

```bash
# Use JWT token in Authorization header
curl -H "Authorization: Bearer <your-jwt-token>" \
  https://your-license-server.run.app/api/credentials
```

---

## 📚 API Endpoints

### 1. List All Configured Services

**GET** `/api/credentials`

List all service integrations configured for your customer account.

**Response:**
```json
{
  "credentials": [
    {
      "service": "jira",
      "credentialType": "oauth2",
      "baseUrl": "https://company.atlassian.net",
      "email": "user@company.com",
      "enabled": true,
      "expiresAt": 1735689600000,
      "lastUsed": 1735603200000,
      "createdAt": 1735516800000,
      "updatedAt": 1735603200000
    }
  ]
}
```

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  https://your-license-server.run.app/api/credentials
```

---

### 2. Get Specific Service Configuration

**GET** `/api/credentials/:service`

Get configuration for a specific service (without secrets).

**Parameters:**
- `service` - Service name: `jira`, `azure`, `confluence`, or `servicenow`

**Response:**
```json
{
  "service": "jira",
  "credentialType": "oauth2",
  "baseUrl": "https://company.atlassian.net",
  "email": "user@company.com",
  "enabled": true,
  "expiresAt": 1735689600000,
  "lastUsed": 1735603200000,
  "createdAt": 1735516800000,
  "updatedAt": 1735603200000
}
```

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  https://your-license-server.run.app/api/credentials/jira
```

---

### 3. Initiate OAuth2 Authorization Flow

**POST** `/api/credentials/:service/oauth-init`

Start OAuth2 authorization flow for a service.

**Parameters:**
- `service` - Service name: `jira`, `azure`, `confluence`, or `servicenow`

**Request Body:**
```json
{
  "baseUrl": "https://company.atlassian.net",
  "email": "user@company.com"
}
```

**Response:**
```json
{
  "authorizationUrl": "https://auth.atlassian.com/authorize?client_id=...&redirect_uri=...&state=...",
  "instructions": "Visit this URL to authorize jira integration. You will be redirected back after authorization."
}
```

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "baseUrl": "https://company.atlassian.net",
    "email": "user@company.com"
  }' \
  https://your-license-server.run.app/api/credentials/jira/oauth-init
```

**Next Steps:**
1. Open the `authorizationUrl` in a browser
2. Complete OAuth2 authorization on the provider's site
3. You'll be redirected back to the license server
4. The server will automatically exchange the code for tokens

---

### 4. OAuth2 Callback Handler

**GET** `/api/credentials/:service/oauth-callback`

Handles OAuth2 callback and exchanges authorization code for access tokens.

**Note:** This endpoint is called automatically by the OAuth2 provider after authorization. You don't need to call it manually.

**Query Parameters:**
- `code` - Authorization code from provider
- `state` - State parameter containing customer info

**Response:**
```json
{
  "success": true,
  "service": "jira",
  "message": "jira integration configured successfully",
  "expiresAt": 1735689600000
}
```

---

### 5. Store API Token or Basic Auth Credentials

**POST** `/api/credentials/:service`

Store API token or basic authentication credentials for a service.

**Parameters:**
- `service` - Service name: `jira`, `azure`, `confluence`, or `servicenow`

**Request Body (API Token):**
```json
{
  "credentialType": "api_token",
  "baseUrl": "https://company.atlassian.net",
  "email": "user@company.com",
  "apiToken": "ATATT3xFfGF..."
}
```

**Request Body (Basic Auth):**
```json
{
  "credentialType": "basic",
  "baseUrl": "https://dev123456.service-now.com",
  "username": "admin",
  "password": "password123",
  "email": "admin@company.com"
}
```

**Response:**
```json
{
  "success": true,
  "service": "jira",
  "message": "jira credentials stored successfully"
}
```

**Example (Jira API Token):**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "credentialType": "api_token",
    "baseUrl": "https://company.atlassian.net",
    "email": "user@company.com",
    "apiToken": "ATATT3xFfGF..."
  }' \
  https://your-license-server.run.app/api/credentials/jira
```

**Example (Azure DevOps PAT):**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "credentialType": "api_token",
    "baseUrl": "https://dev.azure.com/organization",
    "apiToken": "your-pat-token"
  }' \
  https://your-license-server.run.app/api/credentials/azure
```

---

### 6. Update Existing Credentials

**PUT** `/api/credentials/:service`

Update existing service credentials.

**Parameters:**
- `service` - Service name: `jira`, `azure`, `confluence`, or `servicenow`

**Request Body:**
```json
{
  "enabled": true,
  "apiToken": "new-token-if-updating",
  "email": "newemail@company.com"
}
```

**Response:**
```json
{
  "success": true,
  "service": "jira",
  "message": "jira credentials updated successfully"
}
```

**Example:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}' \
  https://your-license-server.run.app/api/credentials/jira
```

---

### 7. Delete Service Credentials

**DELETE** `/api/credentials/:service`

Delete credentials for a service.

**Parameters:**
- `service` - Service name: `jira`, `azure`, `confluence`, or `servicenow`

**Response:**
```json
{
  "success": true,
  "service": "jira",
  "message": "jira credentials deleted successfully"
}
```

**Example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  https://your-license-server.run.app/api/credentials/jira
```

---

### 8. Test Service Connection

**POST** `/api/credentials/:service/test`

Test connection to a service using stored credentials.

**Parameters:**
- `service` - Service name: `jira`, `azure`, `confluence`, or `servicenow`

**Response (Success):**
```json
{
  "success": true,
  "service": "jira",
  "message": "Connected as John Doe"
}
```

**Response (Failure):**
```json
{
  "success": false,
  "service": "jira",
  "message": "Connection failed: Invalid credentials"
}
```

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  https://your-license-server.run.app/api/credentials/jira/test
```

---

### 9. Manually Refresh OAuth2 Token

**POST** `/api/credentials/:service/refresh`

Manually trigger OAuth2 token refresh.

**Note:** Tokens are automatically refreshed every 5 minutes when they're expiring within 1 hour. This endpoint allows manual refresh if needed.

**Parameters:**
- `service` - Service name: `jira`, `azure`, `confluence`, or `servicenow`

**Response:**
```json
{
  "success": true,
  "service": "jira",
  "message": "Token refreshed successfully",
  "expiresAt": 1735689600000
}
```

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  https://your-license-server.run.app/api/credentials/jira/refresh
```

---

## 🔄 Complete OAuth2 Flow Examples

### Jira OAuth2 Setup

```bash
# Step 1: Initiate OAuth2 flow
curl -X POST \
  -H "Authorization: Bearer <sso-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "baseUrl": "https://company.atlassian.net",
    "email": "user@company.com"
  }' \
  https://your-license-server.run.app/api/credentials/jira/oauth-init

# Response:
# {
#   "authorizationUrl": "https://auth.atlassian.com/authorize?...",
#   "instructions": "Visit this URL to authorize..."
# }

# Step 2: Open authorizationUrl in browser
# Complete Atlassian OAuth2 authorization

# Step 3: After redirect, credentials are automatically stored

# Step 4: Test connection
curl -X POST \
  -H "Authorization: Bearer <sso-token>" \
  https://your-license-server.run.app/api/credentials/jira/test

# Response:
# {
#   "success": true,
#   "service": "jira",
#   "message": "Connected as John Doe"
# }
```

### Azure DevOps OAuth2 Setup

```bash
# Step 1: Initiate OAuth2 flow
curl -X POST \
  -H "Authorization: Bearer <sso-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "baseUrl": "https://dev.azure.com/organization"
  }' \
  https://your-license-server.run.app/api/credentials/azure/oauth-init

# Step 2: Open authorizationUrl and authorize

# Step 3: Test connection
curl -X POST \
  -H "Authorization: Bearer <sso-token>" \
  https://your-license-server.run.app/api/credentials/azure/test
```

---

## 🔑 API Token Setup Examples

### Jira API Token

```bash
# Create Jira API token at: https://id.atlassian.com/manage-profile/security/api-tokens

# Store token
curl -X POST \
  -H "Authorization: Bearer <sso-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "credentialType": "api_token",
    "baseUrl": "https://company.atlassian.net",
    "email": "user@company.com",
    "apiToken": "ATATT3xFfGF..."
  }' \
  https://your-license-server.run.app/api/credentials/jira

# Test connection
curl -X POST \
  -H "Authorization: Bearer <sso-token>" \
  https://your-license-server.run.app/api/credentials/jira/test
```

### Azure DevOps PAT

```bash
# Create PAT at: https://dev.azure.com/{org}/_usersSettings/tokens

# Store PAT
curl -X POST \
  -H "Authorization: Bearer <sso-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "credentialType": "api_token",
    "baseUrl": "https://dev.azure.com/organization",
    "apiToken": "your-pat-token-here"
  }' \
  https://your-license-server.run.app/api/credentials/azure
```

### ServiceNow Basic Auth

```bash
# Store ServiceNow credentials
curl -X POST \
  -H "Authorization: Bearer <sso-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "credentialType": "basic",
    "baseUrl": "https://dev123456.service-now.com",
    "username": "admin",
    "password": "password123"
  }' \
  https://your-license-server.run.app/api/credentials/servicenow
```

---

## ⚙️ Automatic Token Refresh

The license server includes a **Token Refresh Worker** that runs every 5 minutes and automatically refreshes OAuth2 tokens expiring within 1 hour.

**How it works:**
1. Worker runs every 5 minutes
2. Finds all OAuth2 credentials expiring within 1 hour
3. Uses refresh tokens to get new access tokens
4. Updates credentials in database
5. Logs success/failure for each refresh

**Monitoring:**
- All refresh operations are logged to `token-refresh.log`
- Failed refreshes are logged with error details
- Credentials are automatically disabled if refresh fails with 401/403

**Manual Refresh:**
If you need to refresh a token immediately:
```bash
curl -X POST \
  -H "Authorization: Bearer <sso-token>" \
  https://your-license-server.run.app/api/credentials/jira/refresh
```

---

## 🔒 Security

### Encryption at Rest

All sensitive credentials are encrypted at rest using **AES-256-GCM** encryption:

- **Access tokens** - Encrypted
- **Refresh tokens** - Encrypted
- **API tokens** - Encrypted
- **Passwords** - Encrypted (if using basic auth)

**Non-encrypted fields:**
- Base URLs (public info)
- Email addresses (used for user identification)
- Service names
- Metadata (creation dates, last used, etc.)

### Encryption Key

Set the encryption key via environment variable:

```bash
# .env
CREDENTIALS_ENCRYPTION_KEY=your-32-byte-encryption-key-here
```

**⚠️ CRITICAL:** Use a strong, unique 32-byte key in production!

### Access Control

- All endpoints require SSO authentication (JWT token)
- Customers can only access their own credentials
- Service Integrator admin can view all customer credentials
- Credentials never exposed in API responses (marked as `[ENCRYPTED]`)

---

## 📊 Usage Tracking

All credential operations are logged for audit purposes:

- Credential creation
- OAuth2 authorization
- Token refresh operations
- Connection tests
- Credential updates/deletions

View audit logs via Admin API:
```bash
curl -H "X-Admin-Key: <admin-key>" \
  https://your-license-server.run.app/api/admin/customers/{customerId}/credentials
```

---

## 🐛 Troubleshooting

### OAuth2 Authorization Fails

**Problem:** Authorization URL doesn't work or returns error

**Solutions:**
1. Check that OAuth app is configured for this service:
   ```bash
   # Service Integrator Admin must configure OAuth app
   curl -X POST \
     -H "X-Admin-Key: <admin-key>" \
     -H "Content-Type: application/json" \
     -d '{
       "service": "jira",
       "clientId": "your-oauth-client-id",
       "clientSecret": "your-oauth-client-secret",
       "redirectUri": "https://your-license-server.run.app/api/credentials/jira/oauth-callback",
       "scopes": ["read:jira-work", "write:jira-work", "offline_access"],
       "enabled": true
     }' \
     https://your-license-server.run.app/api/admin/oauth-apps
   ```

2. Verify redirect URI matches exactly in OAuth app configuration
3. Check that service base URL is correct

### Token Refresh Fails

**Problem:** OAuth2 tokens not refreshing automatically

**Solutions:**
1. Check token refresh worker is running:
   ```bash
   # Check logs
   tail -f token-refresh.log
   ```

2. Verify refresh token is available:
   ```bash
   curl -H "Authorization: Bearer <token>" \
     https://your-license-server.run.app/api/credentials/jira
   ```

3. Manually trigger refresh:
   ```bash
   curl -X POST \
     -H "Authorization: Bearer <token>" \
     https://your-license-server.run.app/api/credentials/jira/refresh
   ```

### Connection Test Fails

**Problem:** Test connection returns error

**Solutions:**
1. Verify credentials are correct:
   - For API tokens: Check token is valid and has correct permissions
   - For OAuth2: Try manual refresh first
   - For basic auth: Verify username/password

2. Check service base URL is correct and accessible
3. Verify network connectivity to service
4. Check service status (may be down or rate-limited)

### Credentials Not Found

**Problem:** GET /api/credentials/:service returns 404

**Solutions:**
1. Verify service name is correct: `jira`, `azure`, `confluence`, or `servicenow`
2. Check credentials were actually created:
   ```bash
   curl -H "Authorization: Bearer <token>" \
     https://your-license-server.run.app/api/credentials
   ```
3. Ensure you're authenticated as correct customer

---

## 🎯 Best Practices

### 1. Use OAuth2 When Available
OAuth2 is more secure than API tokens and supports automatic refresh:
- **Jira**: OAuth2 preferred
- **Confluence**: OAuth2 preferred
- **Azure DevOps**: OAuth2 preferred (PAT as fallback)
- **ServiceNow**: OAuth2 preferred (basic auth as fallback)

### 2. Test Connections After Setup
Always test connections after configuring credentials:
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  https://your-license-server.run.app/api/credentials/jira/test
```

### 3. Monitor Token Expiration
Check token expiration times:
```bash
curl -H "Authorization: Bearer <token>" \
  https://your-license-server.run.app/api/credentials/jira
```

### 4. Rotate Credentials Regularly
Best practice security rotation schedule:
- **OAuth2 tokens**: Auto-refresh, no manual rotation needed
- **API tokens**: Rotate every 90 days
- **Basic auth passwords**: Rotate every 90 days
- **Encryption key**: Rotate on security incidents only

### 5. Use Minimum Required Scopes
When configuring OAuth2 apps, use minimum required scopes:
- **Jira**: `read:jira-work`, `write:jira-work`, `offline_access`
- **Confluence**: `read:confluence-content.all`, `write:confluence-content`, `offline_access`
- **Azure DevOps**: `vso.code`, `vso.work`, `vso.project`

---

## 📝 API Response Codes

| Status Code | Meaning | Common Causes |
|-------------|---------|---------------|
| 200 OK | Success | Request completed successfully |
| 400 Bad Request | Invalid input | Missing required fields, invalid service name |
| 401 Unauthorized | Authentication required | Missing or invalid JWT token |
| 404 Not Found | Resource not found | Service not configured, endpoint doesn't exist |
| 500 Internal Server Error | Server error | Database error, OAuth2 provider error |

---

## 🔗 Related Documentation

- [SSO Integration Guide](SSO-INTEGRATION-GUIDE.md) - How to authenticate via SSO
- [Enterprise Integration Guide](ENTERPRISE-INTEGRATION-GUIDE.md) - Overall architecture
- [Jira Integration Guide](JIRA-INTEGRATION-GUIDE.md) - Jira-specific setup
- [Azure DevOps Integration Guide](AZURE-DEVOPS-INTEGRATION-GUIDE.md) - Azure DevOps setup
- [Confluence Integration Guide](CONFLUENCE-INTEGRATION-GUIDE.md) - Confluence setup

---

## 📊 Database Schema

### oauth_credentials Table

```sql
CREATE TABLE oauth_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  service TEXT NOT NULL CHECK(service IN ('jira', 'azure', 'confluence', 'servicenow')),
  credential_type TEXT NOT NULL CHECK(credential_type IN ('oauth2', 'api_token', 'basic')),

  -- OAuth2 tokens (encrypted)
  access_token TEXT,
  refresh_token TEXT,
  token_type TEXT,
  expires_at INTEGER,
  scope TEXT,

  -- API Token (encrypted)
  api_token TEXT,

  -- Service config
  base_url TEXT NOT NULL,
  email TEXT,
  username TEXT,

  -- OAuth2 app config
  client_id TEXT,

  -- Metadata
  enabled INTEGER NOT NULL DEFAULT 1,
  last_used INTEGER,
  last_refreshed INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  UNIQUE(customer_id, service)
);
```

### oauth_apps Table

```sql
CREATE TABLE oauth_apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service TEXT NOT NULL UNIQUE CHECK(service IN ('jira', 'azure', 'confluence', 'servicenow')),
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  scopes TEXT NOT NULL,
  authorization_url TEXT NOT NULL,
  token_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

---

**Status:** ✅ COMPLETE
**Version:** 1.0.0
**Last Updated:** 2025-10-22
**Authentication:** SSO Required (JWT)
**Encryption:** AES-256-GCM
**Auto-Refresh:** Every 5 minutes
