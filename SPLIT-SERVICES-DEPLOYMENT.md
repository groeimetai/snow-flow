# Split Services Deployment Guide

## Overview

Snow-Flow Enterprise is now split into TWO independent Cloud Run services:

| Service | Domain | Purpose | Port |
|---------|--------|---------|------|
| **Portal** | portal.snow-flow.dev | UI + REST APIs (auth, credentials, themes, SSO, monitoring) | 8080 |
| **MCP Server** | enterprise.snow-flow.dev | SSE endpoint for enterprise tools | 8081 |

## Prerequisites

1. **GCP Project**: Ensure you have access to the GCP project
2. **Artifact Registry**: Repository `snow-flow-enterprise` must exist in `europe-west4`
3. **Cloud SQL**: Database instance must be running and accessible
4. **Environment Variables**: Prepare `.env` files for both services
5. **DNS Records**: Both domains must point to Cloud Run services

## Environment Variables

### Portal Service (`portal/.env`)

```bash
# Database
DB_TYPE=postgres
DB_HOST=<cloud-sql-connection-name>
DB_PORT=5432
DB_NAME=snow_flow_enterprise
DB_USER=<db-user>
DB_PASSWORD=<db-password>

# Auth
JWT_SECRET=<your-jwt-secret-key>
SESSION_SECRET=<your-session-secret-key>

# SAML/SSO
SAML_CERT=<saml-certificate>
SAML_PRIVATE_KEY=<saml-private-key>

# Frontend
VITE_API_URL=https://portal.snow-flow.dev/api

# Environment
NODE_ENV=production
PORT=8080
```

### MCP Server Service (`mcp-server/.env`)

```bash
# Database (same as portal)
DB_TYPE=postgres
DB_HOST=<cloud-sql-connection-name>
DB_PORT=5432
DB_NAME=snow_flow_enterprise
DB_USER=<db-user>
DB_PASSWORD=<db-password>

# Auth (same JWT secret as portal!)
JWT_SECRET=<your-jwt-secret-key>

# Environment
NODE_ENV=production
PORT=8081
```

**CRITICAL**: Both services MUST use the SAME `JWT_SECRET` for authentication to work!

## Deployment Steps

### Step 1: Deploy Portal Service

```bash
# Navigate to enterprise repo
cd /Users/nielsvanderwerf/snow-flow-enterprise

# Trigger Cloud Build for portal
gcloud builds submit \
  --config=portal/cloudbuild.yaml \
  --substitutions=_REGION=europe-west4,_SERVICE_NAME=snow-flow-portal,_ARTIFACT_REGISTRY_REPO=snow-flow-enterprise

# Wait for build to complete (5-10 minutes)
# Check status:
gcloud builds list --limit=5
```

### Step 2: Configure Portal Environment

```bash
# Set environment variables
gcloud run services update snow-flow-portal \
  --region=europe-west4 \
  --update-env-vars="$(cat portal/.env | tr '\n' ',' | sed 's/,$//')" \
  --add-cloudsql-instances=<your-cloud-sql-instance>

# Configure domain mapping
gcloud run domain-mappings create \
  --service=snow-flow-portal \
  --domain=portal.snow-flow.dev \
  --region=europe-west4
```

### Step 3: Deploy MCP Server Service

```bash
# Trigger Cloud Build for MCP server
gcloud builds submit \
  --config=mcp-server/cloudbuild.yaml \
  --substitutions=_REGION=europe-west4,_SERVICE_NAME=snow-flow-enterprise-mcp,_ARTIFACT_REGISTRY_REPO=snow-flow-enterprise

# Wait for build to complete
gcloud builds list --limit=5
```

### Step 4: Configure MCP Server Environment

```bash
# Set environment variables
gcloud run services update snow-flow-enterprise-mcp \
  --region=europe-west4 \
  --update-env-vars="$(cat mcp-server/.env | tr '\n' ',' | sed 's/,$//')" \
  --add-cloudsql-instances=<your-cloud-sql-instance>

# Configure domain mapping
gcloud run domain-mappings create \
  --service=snow-flow-enterprise-mcp \
  --domain=enterprise.snow-flow.dev \
  --region=europe-west4
```

### Step 5: Configure DNS

Add these DNS records in your domain provider:

```
portal.snow-flow.dev      CNAME    ghs.googlehosted.com.
enterprise.snow-flow.dev  CNAME    ghs.googlehosted.com.
```

Google Cloud will automatically provision SSL certificates for both domains.

## Verification

### Portal Service Health Check

```bash
curl https://portal.snow-flow.dev/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "snow-flow-portal",
  "timestamp": "2025-10-27T...",
  "database": "connected"
}
```

### MCP Server Health Check

```bash
curl https://enterprise.snow-flow.dev/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "snow-flow-enterprise-mcp",
  "timestamp": "2025-10-27T...",
  "database": "connected",
  "tools": 26
}
```

### End-to-End Test

1. **Login via Portal**:
```bash
curl -X POST https://portal.snow-flow.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"licenseKey": "<your-license-key>"}'
```

Expected: JWT token in response

2. **Test MCP Server**:
```bash
curl https://enterprise.snow-flow.dev/mcp/sse \
  -H "Authorization: Bearer <jwt-token>"
```

Expected: SSE connection established, tools list returned

## Monitoring

### View Logs

**Portal logs:**
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=snow-flow-portal" \
  --limit=50 \
  --format=json
```

**MCP server logs:**
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=snow-flow-enterprise-mcp" \
  --limit=50 \
  --format=json
```

### View Metrics

```bash
# Portal metrics
gcloud monitoring dashboards create --config-from-file=portal/monitoring-dashboard.json

# MCP server metrics
gcloud monitoring dashboards create --config-from-file=mcp-server/monitoring-dashboard.json
```

## Scaling Configuration

### Portal Service (User-facing, high concurrency)

```bash
gcloud run services update snow-flow-portal \
  --region=europe-west4 \
  --min-instances=1 \
  --max-instances=10 \
  --memory=1Gi \
  --cpu=2 \
  --concurrency=100 \
  --timeout=300s
```

### MCP Server (Long-running tool execution)

```bash
gcloud run services update snow-flow-enterprise-mcp \
  --region=europe-west4 \
  --min-instances=1 \
  --max-instances=20 \
  --memory=2Gi \
  --cpu=2 \
  --concurrency=50 \
  --timeout=600s
```

## Rollback Procedure

If deployment fails or issues arise:

### Rollback Portal

```bash
# List revisions
gcloud run revisions list \
  --service=snow-flow-portal \
  --region=europe-west4

# Rollback to previous revision
gcloud run services update-traffic snow-flow-portal \
  --region=europe-west4 \
  --to-revisions=<previous-revision>=100
```

### Rollback MCP Server

```bash
# List revisions
gcloud run revisions list \
  --service=snow-flow-enterprise-mcp \
  --region=europe-west4

# Rollback to previous revision
gcloud run services update-traffic snow-flow-enterprise-mcp \
  --region=europe-west4 \
  --to-revisions=<previous-revision>=100
```

## Common Issues

### Issue 1: Database Connection Failed

**Symptom**: Health check returns `"database": "disconnected"`

**Solution**:
1. Verify Cloud SQL instance is running
2. Check environment variables are set correctly
3. Ensure Cloud Run service has Cloud SQL access:
```bash
gcloud run services update <service-name> \
  --region=europe-west4 \
  --add-cloudsql-instances=<cloud-sql-instance>
```

### Issue 2: JWT Authentication Failed

**Symptom**: MCP server returns 401 Unauthorized

**Solution**:
1. Verify BOTH services use the SAME `JWT_SECRET`
2. Check token expiration (tokens expire after 30 days)
3. Re-login via portal to get fresh token

### Issue 3: Tools Not Available

**Symptom**: MCP server returns empty tools list

**Solution**:
1. Check license tier includes enterprise features
2. Verify credentials are configured in portal
3. Check database `credentials` table has entries

### Issue 4: CORS Errors in Portal UI

**Symptom**: Frontend cannot call backend APIs

**Solution**:
1. Verify `VITE_API_URL` in portal frontend build
2. Check CORS middleware in `portal/backend/src/index.ts`
3. Rebuild portal frontend

## Cost Estimation

Based on default configuration:

| Service | Min Cost/Month | Max Cost/Month (high traffic) |
|---------|----------------|-------------------------------|
| Portal | ~$10 (1 instance always running) | ~$100 (10 instances) |
| MCP Server | ~$10 (1 instance always running) | ~$200 (20 instances) |
| Cloud SQL | ~$25 (db-f1-micro) | ~$200 (db-n1-standard-2) |
| **Total** | **~$45/month** | **~$500/month** |

## Next Steps

After successful deployment:

1. **Test all enterprise tools**: Verify Jira, Azure DevOps, Confluence integrations
2. **Configure portal UI**: Add integration configuration pages
3. **Update open source CLI**: Implement `snow-flow login`, `snow-flow portal`, etc.
4. **Remove enterprise code from open source**: Delete adapter tools
5. **Update documentation**: User guides, API docs

## Support

For deployment issues:
- Check Cloud Build logs: `gcloud builds list`
- Check Cloud Run logs: `gcloud logging read`
- Review health check endpoints
- Contact GCP support for infrastructure issues

---

**Last Updated**: 2025-10-27
**Version**: 2.0.0 (Split Services)
