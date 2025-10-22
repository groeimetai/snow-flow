# Snow-Flow Enterprise License Server - GCP Deployment Guide

Complete guide for deploying the Snow-Flow Enterprise License Server to Google Cloud Platform (Cloud Run).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Deployment](#deployment)
4. [Configuration](#configuration)
5. [Testing](#testing)
6. [Monitoring](#monitoring)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

```bash
# Install Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL  # Restart shell

# Authenticate
gcloud auth login
gcloud auth application-default login

# Install jq (for JSON parsing in scripts)
# macOS:
brew install jq
# Linux:
sudo apt-get install jq
```

### GCP Project Setup

1. **Create GCP Project** (or use existing)
   ```bash
   gcloud projects create snow-flow-enterprise --name="Snow-Flow Enterprise"
   gcloud config set project snow-flow-enterprise
   ```

2. **Enable Billing**
   - Go to: https://console.cloud.google.com/billing
   - Link billing account to project

3. **Enable Required APIs**
   ```bash
   gcloud services enable \
     cloudbuild.googleapis.com \
     run.googleapis.com \
     artifactregistry.googleapis.com \
     secretmanager.googleapis.com
   ```

## Initial Setup

### Step 1: Configure Secrets

Run the automated secrets setup:

```bash
./setup-secrets.sh your-project-id
```

This creates three secrets in Secret Manager:
- **ADMIN_KEY**: Admin API authentication (save this value!)
- **SESSION_SECRET**: Session encryption (auto-generated)
- **JWT_SECRET**: JWT token signing (auto-generated)

**⚠️ IMPORTANT:** Save the `ADMIN_KEY` value shown in the output!

### Step 2: Create Artifact Registry Repository

```bash
gcloud artifacts repositories create snow-flow-enterprise \
  --repository-format=docker \
  --location=europe-west1 \
  --description="Snow-Flow Enterprise Docker images"
```

### Step 3: Configure Deployment

Create deployment configuration:

```bash
# The deploy.sh script will create a template on first run
./deploy.sh production
# Edit the generated file: deploy-config-production.env
```

Edit `deploy-config-production.env`:

```bash
# GCP Configuration
PROJECT_ID="your-project-id"
REGION="europe-west1"
ARTIFACT_REGISTRY_REPO="snow-flow-enterprise"
SERVICE_NAME="license-server"

# Cloud Run Configuration
MIN_INSTANCES="1"        # Always-on (0 for scale-to-zero)
MAX_INSTANCES="10"
MEMORY="512Mi"
CPU="1"
CONCURRENCY="80"
TIMEOUT="300s"

# Secret Manager
ADMIN_KEY_SECRET="ADMIN_KEY"
SESSION_SECRET_NAME="SESSION_SECRET"
JWT_SECRET_NAME="JWT_SECRET"
```

## Deployment

### Automated Deployment

Deploy with one command:

```bash
./deploy.sh production
```

This will:
1. ✅ Validate GCP configuration
2. ✅ Build Docker image (multi-stage build)
3. ✅ Push to Artifact Registry
4. ✅ Deploy to Cloud Run
5. ✅ Run health checks
6. ✅ Display service URL

**Deployment time:** ~5-8 minutes

### Manual Deployment

If you prefer manual control:

```bash
# 1. Build and push
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_REGION=europe-west1,_ARTIFACT_REGISTRY_REPO=snow-flow-enterprise,_SERVICE_NAME=license-server

# 2. Configure secrets
gcloud run services update license-server \
  --region=europe-west1 \
  --update-secrets=ADMIN_KEY=ADMIN_KEY:latest,SESSION_SECRET=SESSION_SECRET:latest,JWT_SECRET=JWT_SECRET:latest

# 3. Get service URL
gcloud run services describe license-server \
  --region=europe-west1 \
  --format='value(status.url)'
```

## Configuration

### Environment Variables

Set via Cloud Run console or `gcloud`:

```bash
gcloud run services update license-server \
  --region=europe-west1 \
  --set-env-vars=\
NODE_ENV=production,\
PORT=8080,\
LOG_LEVEL=info,\
DB_PATH=/app/data/licenses.db,\
CORS_ORIGIN=https://yourdomain.com
```

### Secrets (Sensitive Data)

Configure via Secret Manager:

```bash
gcloud run services update license-server \
  --region=europe-west1 \
  --update-secrets=\
ADMIN_KEY=ADMIN_KEY:latest,\
SESSION_SECRET=SESSION_SECRET:latest,\
JWT_SECRET=JWT_SECRET:latest
```

### Scaling Configuration

```bash
gcloud run services update license-server \
  --region=europe-west1 \
  --min-instances=1 \          # Always-on (0 for scale-to-zero)
  --max-instances=10 \          # Max autoscaling
  --cpu=1 \                     # CPU allocation
  --memory=512Mi \              # Memory allocation
  --concurrency=80 \            # Requests per instance
  --timeout=300s                # Request timeout
```

**Cost Optimization:**
- **Development:** `MIN_INSTANCES=0` (scale to zero when idle)
- **Production:** `MIN_INSTANCES=1` (eliminate cold starts)

### Custom Domain

```bash
# Map custom domain
gcloud run services update license-server \
  --region=europe-west1 \
  --add-cloudsql-instances=your-instance

# Add domain mapping
gcloud run domain-mappings create \
  --service=license-server \
  --domain=api.yourdomain.com \
  --region=europe-west1
```

## Testing

### 1. Health Check

```bash
SERVICE_URL=$(gcloud run services describe license-server \
  --region=europe-west1 \
  --format='value(status.url)')

curl $SERVICE_URL/health | jq .
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "uptime": 123.45
}
```

### 2. Detailed Health Check

```bash
curl $SERVICE_URL/monitoring/health/detailed | jq .
```

Expected response:
```json
{
  "status": "healthy",
  "checks": {
    "database": "✅ Connected",
    "mcp_servers": "✅ 3 servers ready",
    "credentials_store": "✅ Accessible"
  },
  "version": "1.0.0",
  "uptime": 123.45
}
```

### 3. Create Test Customer

```bash
# Use the ADMIN_KEY from setup-secrets.sh output
ADMIN_KEY="your-admin-key-here"

curl -X POST $SERVICE_URL/api/admin/customers \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "email": "admin@acme.com",
    "tier": "enterprise",
    "maxInstances": 10,
    "expiresAt": 1735689600000
  }' | jq .
```

Expected response:
```json
{
  "success": true,
  "customer": {
    "id": 1,
    "name": "Acme Corporation",
    "licenseKey": "SNOW-ENT-ACME-ABC123",
    "tier": "enterprise",
    "status": "active"
  }
}
```

### 4. Test MCP Endpoint

```bash
LICENSE_KEY="SNOW-ENT-ACME-ABC123"  # From previous step

curl -X POST $SERVICE_URL/mcp/tools/list \
  -H "Authorization: Bearer $LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.tools | length'
```

Expected: Number of available tools (26)

### 5. Test Jira Integration

```bash
curl -X POST $SERVICE_URL/mcp/tools/call \
  -H "Authorization: Bearer $LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "jira_list_projects",
    "arguments": {},
    "credentials": {
      "jiraUrl": "https://your-domain.atlassian.net",
      "jiraEmail": "your-email@domain.com",
      "jiraApiToken": "your-api-token"
    }
  }' | jq .
```

## Monitoring

### Cloud Run Metrics

View in Console:
```
https://console.cloud.google.com/run/detail/europe-west1/license-server/metrics
```

Or via CLI:
```bash
gcloud run services describe license-server \
  --region=europe-west1 \
  --format=yaml
```

### Custom Metrics

```bash
# Usage statistics
curl -H "X-Admin-Key: $ADMIN_KEY" \
  $SERVICE_URL/monitoring/stats/usage | jq .

# Performance metrics
curl -H "X-Admin-Key: $ADMIN_KEY" \
  $SERVICE_URL/monitoring/metrics | jq .
```

### Logs

```bash
# Stream logs
gcloud run services logs tail license-server --region=europe-west1

# Query logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=license-server" \
  --limit=50 \
  --format=json
```

### Alerts

Set up Cloud Monitoring alerts:

```bash
# High error rate alert
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="License Server High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s
```

## Troubleshooting

### Common Issues

#### 1. Health Check Failing

**Symptom:** Deployment succeeds but health check fails

**Solutions:**
```bash
# Check logs
gcloud run services logs tail license-server --region=europe-west1

# Check service status
gcloud run services describe license-server --region=europe-west1

# Test locally
docker build -t license-server .
docker run -p 8080:8080 license-server
curl http://localhost:8080/health
```

#### 2. Database Permission Issues

**Symptom:** "SQLITE_CANTOPEN" or "Permission denied"

**Solution:** Cloud Run uses read-only filesystem except /tmp
```bash
# Set DB_PATH to writable location
gcloud run services update license-server \
  --region=europe-west1 \
  --set-env-vars=DB_PATH=/tmp/licenses.db
```

**⚠️ WARNING:** /tmp is ephemeral. For production, use Cloud SQL or persistent volume.

#### 3. Secret Access Denied

**Symptom:** "Permission denied accessing secret"

**Solution:**
```bash
# Grant Cloud Run service account access
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding ADMIN_KEY \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"
```

#### 4. Rate Limiting Issues

**Symptom:** "429 Too Many Requests"

**Solution:** Rate limits are per customer, not per IP
```bash
# Check rate limit configuration in src/middleware/security.ts
# Default: 100 requests per 15 minutes per customer

# Increase limits if needed (edit and redeploy)
```

#### 5. Cold Start Latency

**Symptom:** First request after idle period is slow

**Solution:**
```bash
# Keep minimum 1 instance always warm
gcloud run services update license-server \
  --region=europe-west1 \
  --min-instances=1
```

### Debug Mode

Enable debug logging:

```bash
gcloud run services update license-server \
  --region=europe-west1 \
  --set-env-vars=LOG_LEVEL=debug
```

### Rollback Deployment

```bash
# List revisions
gcloud run revisions list --service=license-server --region=europe-west1

# Rollback to previous revision
gcloud run services update-traffic license-server \
  --region=europe-west1 \
  --to-revisions=license-server-00002-abc=100
```

## Production Checklist

Before going live:

- [ ] Secrets configured in Secret Manager
- [ ] Custom domain mapped
- [ ] CORS_ORIGIN set to production domain
- [ ] MIN_INSTANCES set appropriately (1+ for production)
- [ ] Cloud Monitoring alerts configured
- [ ] Backup strategy for database (Cloud SQL or scheduled backups)
- [ ] SSL/TLS certificate verified
- [ ] Rate limits tested under load
- [ ] All integrations tested (Jira, Azure DevOps, Confluence)
- [ ] SSO/SAML configured (if using web portal)
- [ ] Documentation updated with service URL

## Cost Optimization

### Development Environment
```bash
# Scale to zero when idle
MIN_INSTANCES=0
MAX_INSTANCES=5
MEMORY=512Mi
CPU=1
```

**Estimated cost:** $0-5/month (pay only when active)

### Production Environment
```bash
# Always-on, auto-scale under load
MIN_INSTANCES=1
MAX_INSTANCES=10
MEMORY=512Mi
CPU=1
CONCURRENCY=80
```

**Estimated cost:** ~$15-50/month (depends on traffic)

## Support

For issues or questions:

- **Documentation:** https://github.com/yourusername/snow-flow
- **Issues:** https://github.com/yourusername/snow-flow/issues
- **Email:** support@snow-flow.com

---

**Last Updated:** 2025-01-XX
**Version:** 1.0.0
