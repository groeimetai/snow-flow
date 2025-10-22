# ☁️ GCP Deployment Guide - Snow-Flow Enterprise

**Version:** 1.0.0
**Date:** 2025-10-22
**Purpose:** Complete guide voor deployment naar Google Cloud Platform

## 🎯 Architectuur

```
GitHub Repository (groeimetai/snow-flow-enterprise)
  ↓ Push to main/test branch
Cloud Build (Automatic Trigger)
  ↓ Build Docker image
  ↓ Push to Artifact Registry
  ↓ Deploy to Cloud Run
Cloud Run Instance
  ↓ License Server running on port 8080
  ↓ Auto-scaling (0-10 instances)
```

## 📋 Prerequisites

Wat je nodig hebt:
- ✅ Google Cloud Project
- ✅ Billing enabled
- ✅ gcloud CLI installed (`gcloud --version`)
- ✅ GitHub repo: `groeimetai/snow-flow-enterprise`

## 🚀 One-Time Setup (Eenmalig!)

### Stap 1: GCP Project Setup

```bash
# Login bij GCP
gcloud auth login

# Set je project ID
export PROJECT_ID="jouw-project-id"
gcloud config set project $PROJECT_ID

# Set region (waar je wilt deployen)
export REGION="europe-west1"
gcloud config set compute/region $REGION
```

### Stap 2: Enable Required APIs

```bash
# Enable alle benodigde APIs
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudresourcemanager.googleapis.com
```

### Stap 3: Create Artifact Registry Repository

```bash
# Maak repository voor Docker images
gcloud artifacts repositories create snow-flow-enterprise \
  --repository-format=docker \
  --location=$REGION \
  --description="Snow-Flow Enterprise Docker images"

# Verify
gcloud artifacts repositories list
```

### Stap 4: Create Admin Key Secret

```bash
# Generate een veilige admin key
ADMIN_KEY=$(openssl rand -base64 32)

# Store in Secret Manager
echo -n "$ADMIN_KEY" | gcloud secrets create admin-key \
  --data-file=- \
  --replication-policy="automatic"

# Bewaar deze key veilig! Je hebt hem nodig voor admin API calls
echo "Admin Key: $ADMIN_KEY"
```

### Stap 5: Cloud Build Service Account Permissions

```bash
# Get project number
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

# Grant Cloud Run Admin role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

# Grant Secret Manager Secret Accessor role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Grant Service Account User role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### Stap 6: Connect Cloud Build to GitHub

**Option A: Via GCP Console (Makkelijkste!)**

1. Ga naar: https://console.cloud.google.com/cloud-build/triggers
2. Klik: **"Connect Repository"**
3. Selecteer: **GitHub (Cloud Build GitHub App)**
4. Authenticate met GitHub
5. Selecteer repository: `groeimetai/snow-flow-enterprise`
6. Klik: **Connect**

**Option B: Via gcloud CLI**

```bash
# Install GitHub app in je repository
# Follow instructions on: https://github.com/apps/google-cloud-build

# Dan connect via CLI:
gcloud builds connections create github snow-flow-enterprise-connection \
  --region=$REGION
```

### Stap 7: Create Cloud Build Triggers

**Voor MAIN branch (Production):**

```bash
gcloud builds triggers create github \
  --name="snow-flow-enterprise-main" \
  --repo-name="snow-flow-enterprise" \
  --repo-owner="groeimetai" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml" \
  --substitutions="_REGION=$REGION,_SERVICE_NAME=snow-flow-license-server-prod,_NODE_ENV=production"
```

**Voor TEST branch (Staging):**

```bash
gcloud builds triggers create github \
  --name="snow-flow-enterprise-test" \
  --repo-name="snow-flow-enterprise" \
  --repo-owner="groeimetai" \
  --branch-pattern="^test$" \
  --build-config="cloudbuild.yaml" \
  --substitutions="_REGION=$REGION,_SERVICE_NAME=snow-flow-license-server-test,_NODE_ENV=staging"
```

**Verify triggers:**

```bash
gcloud builds triggers list
```

## 🎉 Deploy! (Automatisch via Git Push)

### Deploy naar TEST omgeving

```bash
# Maak test branch (als je die nog niet hebt)
git checkout -b test

# Push naar test branch
git push origin test

# Cloud Build start automatisch!
# Watch de build:
gcloud builds list --ongoing
```

### Deploy naar PRODUCTION

```bash
# Merge test naar main (als test succesvol is)
git checkout main
git merge test

# Push naar main
git push origin main

# Cloud Build start automatisch!
# Watch de build:
gcloud builds list --ongoing
```

### Monitor Deployment

```bash
# Real-time build logs
gcloud builds log --stream $(gcloud builds list --limit=1 --format='value(id)')

# Check Cloud Run services
gcloud run services list

# Get service URL
gcloud run services describe snow-flow-license-server-prod \
  --region=$REGION \
  --format='value(status.url)'
```

## 🔍 Verify Deployment

### Test Health Endpoint

```bash
# Get service URL
PROD_URL=$(gcloud run services describe snow-flow-license-server-prod \
  --region=$REGION \
  --format='value(status.url)')

# Test health endpoint
curl $PROD_URL/health
```

**Expected:**
```json
{
  "status": "healthy",
  "timestamp": 1704067200000,
  "version": "1.0.0"
}
```

### Test Admin API

```bash
# Get admin key from secrets
ADMIN_KEY=$(gcloud secrets versions access latest --secret="admin-key")

# Create test Service Integrator
curl -X POST $PROD_URL/api/admin/si \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test SI",
    "contactEmail": "test@example.com",
    "billingEmail": "billing@example.com"
  }'
```

### Test MCP Tools List

```bash
# First create a customer to get license key
# ... (use admin API)

# Then test MCP
curl $PROD_URL/mcp/tools/list \
  -H "Authorization: Bearer SNOW-ENT-TEST-ABC123"
```

## 📊 Monitoring & Logging

### View Logs

```bash
# Cloud Run logs (production)
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=snow-flow-license-server-prod" \
  --limit=50 \
  --format=json

# Cloud Build logs
gcloud logging read "resource.type=build" \
  --limit=20
```

### View Metrics (GCP Console)

- **Cloud Run Metrics:** https://console.cloud.google.com/run
- **Cloud Build History:** https://console.cloud.google.com/cloud-build/builds
- **Logs Explorer:** https://console.cloud.google.com/logs

### Set Up Alerts (Optioneel)

```bash
# Alert on high error rate
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="License Server Errors" \
  --condition-display-name="High error rate" \
  --condition-threshold-value=10 \
  --condition-threshold-duration=60s
```

## 🔧 Configuration

### Environment Variables (Cloud Run)

```bash
# Update environment variables
gcloud run services update snow-flow-license-server-prod \
  --region=$REGION \
  --set-env-vars="NODE_ENV=production,LOG_LEVEL=info"
```

### Secrets

```bash
# Update admin key
echo -n "new-admin-key" | gcloud secrets versions add admin-key \
  --data-file=-

# View secret versions
gcloud secrets versions list admin-key
```

### Resource Limits

```bash
# Update memory/CPU
gcloud run services update snow-flow-license-server-prod \
  --region=$REGION \
  --memory=1Gi \
  --cpu=2
```

## 🚨 Troubleshooting

### Build Failed

```bash
# Check build logs
gcloud builds log $(gcloud builds list --limit=1 --format='value(id)')

# Common issues:
# - Dockerfile path incorrect (should be: enterprise/license-server/Dockerfile)
# - Missing permissions (check service account roles)
# - Artifact Registry not created
```

### Service Won't Start

```bash
# Check Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=snow-flow-license-server-prod AND severity>=ERROR" \
  --limit=50

# Common issues:
# - PORT not set (should be 8080 for Cloud Run)
# - Database path issues (use /app/data/licenses.db)
# - Secrets not accessible
```

### Database Issues

Cloud Run instances zijn **stateless** - SQLite database moet persistent zijn!

**Solution: Use Cloud SQL or Cloud Storage**

```bash
# Option 1: Mount Cloud Storage bucket (voor SQLite)
gcloud run services update snow-flow-license-server-prod \
  --region=$REGION \
  --add-volume=name=database,type=cloud-storage,bucket=snow-flow-db-bucket \
  --add-volume-mount=volume=database,mount-path=/app/data

# Option 2: Use Cloud SQL (PostgreSQL) - beter voor productie!
# Update database/schema.ts to use PostgreSQL instead of SQLite
```

### Rollback Deployment

```bash
# List revisions
gcloud run revisions list \
  --service=snow-flow-license-server-prod \
  --region=$REGION

# Rollback to previous revision
gcloud run services update-traffic snow-flow-license-server-prod \
  --region=$REGION \
  --to-revisions=REVISION_NAME=100
```

## 🔐 Security Best Practices

### 1. Restrict Access (Optioneel - als je geen public API wilt)

```bash
# Require authentication
gcloud run services update snow-flow-license-server-prod \
  --region=$REGION \
  --no-allow-unauthenticated
```

### 2. Use VPC Connector (voor private access)

```bash
# Create VPC connector
gcloud compute networks vpc-access connectors create snow-flow-connector \
  --region=$REGION \
  --network=default \
  --range=10.8.0.0/28

# Use connector
gcloud run services update snow-flow-license-server-prod \
  --region=$REGION \
  --vpc-connector=snow-flow-connector
```

### 3. Add Custom Domain

```bash
# Map custom domain
gcloud run domain-mappings create \
  --service=snow-flow-license-server-prod \
  --domain=api.snow-flow.com \
  --region=$REGION
```

## 📝 File Locations (Voor Cloud Build)

**BELANGRIJK:** Cloud Build zoekt naar bestanden vanaf de repo root!

**Repository structuur:**
```
groeimetai/snow-flow-enterprise/    # GitHub repo root (= enterprise directory!)
├── cloudbuild.yaml                 # ✅ Build config
├── license-server/                 # Server directory
│   ├── Dockerfile                  # ✅ Docker build file
│   ├── .dockerignore               # ✅ Docker ignore
│   ├── package.json                # Dependencies
│   ├── tsconfig.json               # TypeScript config
│   └── src/                        # Source code
│       └── index.ts                # Main entry point
└── GCP-DEPLOYMENT-GUIDE.md         # Deze guide!
```

**In cloudbuild.yaml:**
```yaml
args:
  - '-f'
  - 'license-server/Dockerfile'  # ✅ Vanaf repo root
  - 'license-server'             # ✅ Build context
# NO dir: specified - werkt vanaf repo root!
```

## 🎯 Quick Commands Reference

```bash
# View services
gcloud run services list

# View builds
gcloud builds list --limit=10

# View logs
gcloud run logs read snow-flow-license-server-prod

# Describe service
gcloud run services describe snow-flow-license-server-prod --region=$REGION

# Update service
gcloud run services update snow-flow-license-server-prod --region=$REGION

# Delete service
gcloud run services delete snow-flow-license-server-prod --region=$REGION
```

## ✅ Post-Deployment Checklist

- [ ] Health endpoint returns 200
- [ ] Admin API accessible
- [ ] MCP tools list returns 43 tools
- [ ] Test Jira integration works
- [ ] Usage tracking logs to database
- [ ] Secrets accessible
- [ ] Metrics visible in console
- [ ] Alerts configured
- [ ] Custom domain mapped (if needed)
- [ ] Costs monitored

## 💰 Cost Optimization

```bash
# Set min instances to 0 (scale to zero when idle)
gcloud run services update snow-flow-license-server-prod \
  --region=$REGION \
  --min-instances=0

# Set max instances (prevent runaway costs)
gcloud run services update snow-flow-license-server-prod \
  --region=$REGION \
  --max-instances=10

# Enable CPU throttling (cheaper, slower cold starts)
gcloud run services update snow-flow-license-server-prod \
  --region=$REGION \
  --cpu-throttling
```

**Expected Costs (europe-west1):**
- Cloud Run: ~€0.10/day (with scale-to-zero)
- Artifact Registry: ~€0.10/GB/month
- Cloud Build: 120 builds/day gratis, dan ~€0.003/build-minute
- Secret Manager: 6 accesses gratis, dan ~€0.03/10K accesses

**Total: ~€3-5/maand** voor test + prod omgeving met light usage! 🎉

---

**Klaar om te deployen?** Push gewoon naar GitHub en Cloud Build doet de rest! 🚀
