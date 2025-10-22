# Snow-Flow Enterprise - GCP Deployment Guide

Complete guide for deploying the license server to Google Cloud Platform with automatic CI/CD.

## 🏗️ Architecture

```
GitHub Repository (snow-flow-enterprise)
  ├─ test branch   → Cloud Build → Cloud Run (license-server-test)
  └─ main branch   → Cloud Build → Cloud Run (license-server-prod)
```

## 📋 Prerequisites

1. **GCP Project** - Create at https://console.cloud.google.com
2. **GitHub Repository** - Private repo: groeimetai/snow-flow-enterprise
3. **gcloud CLI** - Install from https://cloud.google.com/sdk/docs/install
4. **Billing Enabled** - Required for Cloud Run (~€15-30/month)

## 🚀 Quick Setup (5 Minutes)

### Step 1: Run Setup Script

```bash
cd enterprise
chmod +x setup-gcp-triggers.sh
./setup-gcp-triggers.sh snow-flow-enterprise
```

This script will:
- ✅ Enable required GCP APIs
- ✅ Create ADMIN_KEY secret
- ✅ Setup backup storage bucket
- ✅ Create Cloud Build triggers for test + prod

### Step 2: Connect GitHub Repository

1. Go to: https://console.cloud.google.com/cloud-build/triggers/connect?project=snow-flow-enterprise
2. Click "Connect Repository"
3. Select "GitHub"
4. Authenticate with GitHub
5. Select repository: `groeimetai/snow-flow-enterprise`
6. Click "Connect"

### Step 3: Create Test Branch

```bash
cd /path/to/snow-flow-enterprise
git checkout -b test
git push origin test
```

### Step 4: Verify Triggers

```bash
# List triggers
gcloud builds triggers list

# Should show:
# - license-server-test (branch: test)
# - license-server-prod (branch: main)
```

## 🔄 Automatic Deployment Flow

### Test Environment

```bash
# Make changes
git checkout test
git add .
git commit -m "feat: new feature"
git push origin test

# ✨ Automatic deployment triggered!
# - Cloud Build runs cloudbuild-test.yaml
# - Builds Docker image
# - Deploys to license-server-test
# - Scales: 0-2 instances (min=0 for cost)
```

**Test URL:** https://license-server-test-xxx.run.app

### Production Environment

```bash
# After testing, merge to main
git checkout main
git merge test
git push origin main

# ✨ Automatic deployment triggered!
# - Cloud Build runs cloudbuild-prod.yaml
# - Builds Docker image
# - Deploys to license-server-prod
# - Scales: 1-5 instances (min=1, always warm)
```

**Production URL:** https://license-server-prod-xxx.run.app

## 📊 Environment Configuration

### Test Environment
- **Service:** `license-server-test`
- **Min Instances:** 0 (scales to zero for cost)
- **Max Instances:** 2
- **Memory:** 512Mi
- **CPU:** 1
- **Environment:** `NODE_ENV=test`
- **Log Level:** `debug`
- **Cost:** ~€3-5/month

### Production Environment
- **Service:** `license-server-prod`
- **Min Instances:** 1 (always warm)
- **Max Instances:** 5
- **Memory:** 512Mi
- **CPU:** 1
- **Environment:** `NODE_ENV=production`
- **Log Level:** `info`
- **Cost:** ~€10-15/month

## 🔧 Manual Deployment (Optional)

If you need to deploy without pushing to GitHub:

```bash
cd license-server

# Build TypeScript
npm install
npm run build

# Deploy to test
gcloud builds submit --config=cloudbuild-test.yaml --project=snow-flow-enterprise

# Deploy to production
gcloud builds submit --config=cloudbuild-prod.yaml --project=snow-flow-enterprise
```

## 🏥 Health Checks

Both environments expose a `/health` endpoint:

```bash
# Test environment
curl https://license-server-test-xxx.run.app/health

# Production environment
curl https://license-server-prod-xxx.run.app/health

# Expected response:
{
  "status": "ok",
  "timestamp": 1704067200000,
  "uptime": 123.45
}
```

## 📈 Monitoring

### View Logs

```bash
# Test logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=license-server-test" --limit 50

# Production logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=license-server-prod" --limit 50
```

### View Metrics

**Test:** https://console.cloud.google.com/run/detail/europe-west4/license-server-test/metrics

**Production:** https://console.cloud.google.com/run/detail/europe-west4/license-server-prod/metrics

Key metrics:
- Request count
- Request latency (p50, p95, p99)
- Error rate
- Instance count
- Memory usage
- CPU utilization

## 🔒 Secrets Management

### Retrieve ADMIN_KEY

```bash
gcloud secrets versions access latest --secret=ADMIN_KEY
```

### Update ADMIN_KEY

```bash
echo -n "new-admin-key-here" | gcloud secrets versions add ADMIN_KEY --data-file=-
```

### Add New Secret

```bash
echo -n "secret-value" | gcloud secrets create NEW_SECRET --data-file=-

# Grant Cloud Build access
PROJECT_NUMBER=$(gcloud projects describe snow-flow-enterprise --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding NEW_SECRET \
    --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# Update cloudbuild yaml to include:
# --set-secrets=NEW_SECRET=NEW_SECRET:latest
```

## 💾 Database Backups

### Manual Backup

```bash
# Backup to Cloud Storage
gsutil cp /path/to/licenses.db gs://snow-flow-enterprise-license-backups/licenses-$(date +%Y%m%d).db
```

### Scheduled Backups (Cloud Scheduler)

```bash
# Create backup Cloud Function (future enhancement)
# Or use Cloud Scheduler + Cloud Functions
```

### Restore from Backup

```bash
# List backups
gsutil ls gs://snow-flow-enterprise-license-backups/

# Download backup
gsutil cp gs://snow-flow-enterprise-license-backups/licenses-20250122.db ./licenses.db

# Redeploy with restored database (manual process)
```

## 🌐 Custom Domain Setup

### Add Custom Domain to Cloud Run

```bash
# Map domain to production service
gcloud run domain-mappings create \
  --service license-server-prod \
  --domain license.snow-flow.dev \
  --region europe-west4

# Get DNS records to add
gcloud run domain-mappings describe \
  --domain license.snow-flow.dev \
  --region europe-west4
```

### Add DNS Records

Add to your DNS provider (e.g., Cloudflare, Google Domains):

```
Type: CNAME
Name: license.snow-flow.dev
Value: ghs.googlehosted.com
```

SSL certificate is automatically provisioned by Cloud Run.

## 🐛 Troubleshooting

### Build Fails

```bash
# View build logs
gcloud builds list --limit=5
gcloud builds log <BUILD_ID>

# Common issues:
# 1. Node version mismatch → Check Dockerfile FROM node:20
# 2. TypeScript errors → Run npm run build locally first
# 3. Missing files → Check .dockerignore
```

### Deployment Fails

```bash
# Check service status
gcloud run services describe license-server-test --region=europe-west4

# Check logs
gcloud run logs read license-server-test --region=europe-west4 --limit=100

# Common issues:
# 1. Port mismatch → Check PORT env var (should be 8080)
# 2. Secret access denied → Check IAM permissions
# 3. Out of memory → Increase --memory flag
```

### Service Not Responding

```bash
# Check if service is running
gcloud run services list

# Force new revision
gcloud run deploy license-server-test \
  --image gcr.io/snow-flow-enterprise/license-server:test-latest \
  --region europe-west4

# View container logs in real-time
gcloud run logs tail license-server-test --region=europe-west4
```

## 💰 Cost Optimization

### Current Setup (Optimized)

- **Test:** Min 0 instances = €0 when idle
- **Prod:** Min 1 instance = ~€7/month base + usage
- **Storage:** Backups ~€1/month
- **Build:** First 120 builds/month free
- **Total:** ~€8-17/month

### Further Optimization

1. **Reduce prod min instances to 0** (slower cold starts)
   ```bash
   --min-instances=0  # Save €7/month, add ~2s cold start
   ```

2. **Use shared VPC** (advanced, for multiple services)

3. **Compress database backups**
   ```bash
   gzip licenses.db
   gsutil cp licenses.db.gz gs://...
   ```

## 📊 Monitoring & Alerts

### Setup Email Alerts

```bash
# Create notification channel
gcloud alpha monitoring channels create \
  --display-name="Email Alerts" \
  --type=email \
  --channel-labels=email_address=your-email@company.com

# Create alert policy for high error rate
gcloud alpha monitoring policies create \
  --notification-channels=<CHANNEL_ID> \
  --display-name="License Server High Error Rate" \
  --condition-display-name="Error Rate > 5%" \
  --condition-threshold-value=5 \
  --condition-threshold-duration=300s
```

## 🔄 Rollback Procedure

### Rollback to Previous Version

```bash
# List revisions
gcloud run revisions list --service=license-server-prod --region=europe-west4

# Rollback to specific revision
gcloud run services update-traffic license-server-prod \
  --to-revisions=<REVISION_NAME>=100 \
  --region=europe-west4
```

### Emergency Rollback

```bash
# Deploy previous Docker image
gcloud run deploy license-server-prod \
  --image gcr.io/snow-flow-enterprise/license-server:prod-<PREVIOUS_SHA> \
  --region=europe-west4
```

## 📚 Additional Resources

- **Cloud Run Docs:** https://cloud.google.com/run/docs
- **Cloud Build Docs:** https://cloud.google.com/build/docs
- **Secret Manager:** https://cloud.google.com/secret-manager/docs
- **Pricing Calculator:** https://cloud.google.com/products/calculator

## 🆘 Support

For issues with deployment:
1. Check logs (see Troubleshooting section)
2. Verify IAM permissions
3. Check quotas: https://console.cloud.google.com/iam-admin/quotas
4. Contact: enterprise@snow-flow.dev

---

**Last Updated:** 2025-01-22
**Version:** 1.0.0
