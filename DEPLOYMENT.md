# Snow-Flow Deployment Guide

This document describes how to deploy Snow-Flow services to Google Cloud Platform.

## Architecture Overview

Snow-Flow uses a monorepo structure with multiple deployable services:

```
snow-flow/
├── status-page/        # Status page (Cloud Run)
├── website/            # Main website (Cloud Run)
└── cloudbuild.yaml     # Root build config (auto-detects changes)
```

## Prerequisites

### Required GCP APIs
```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### Required Permissions
- Cloud Build Service Account needs:
  - `roles/run.admin`
  - `roles/iam.serviceAccountUser`
  - `roles/artifactregistry.writer`

### Grant Permissions
```bash
PROJECT_ID="snow-flow-ai"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

## Deployment Methods

### Method 1: Automatic Deployment (Recommended)

Cloud Build automatically deploys services when changes are pushed to the `main` branch.

**Setup Cloud Build Trigger:**

```bash
gcloud builds triggers create github \
  --name="snow-flow-monorepo-deploy" \
  --repo-name="snow-flow" \
  --repo-owner="groeimetai" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml" \
  --region="europe-west4" \
  --description="Auto-deploy Snow-Flow services (status-page, website)"
```

**How it works:**
1. Push changes to `main` branch
2. Cloud Build detects which directories changed (`status-page/` or `website/`)
3. Builds and deploys only the changed services
4. Skips unchanged services to save build time

### Method 2: Manual Deployment

#### Deploy All Services
```bash
# From repository root
gcloud builds submit --config cloudbuild.yaml --project=snow-flow-ai
```

#### Deploy Status Page Only
```bash
cd status-page
gcloud builds submit --config cloudbuild.yaml --project=snow-flow-ai
```

#### Deploy Website Only
```bash
cd website
gcloud builds submit --config cloudbuild.yaml --project=snow-flow-ai
```

### Method 3: Direct Cloud Run Deployment (Fast)

**Status Page:**
```bash
cd status-page

gcloud run deploy snow-flow-status-page \
  --source . \
  --region europe-west4 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 5 \
  --project snow-flow-ai
```

**Website:**
```bash
cd website

gcloud run deploy snow-flow-website \
  --source . \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated \
  --port 80 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --project snow-flow-ai
```

## Service Configuration

### Status Page
- **Service Name**: `snow-flow-status-page`
- **Region**: `europe-west4` (Netherlands)
- **Port**: `8080`
- **Memory**: `512Mi`
- **CPU**: `1`
- **Min Instances**: `1` (always on for status monitoring)
- **Max Instances**: `5`
- **Image Registry**: Artifact Registry (`europe-west4-docker.pkg.dev`)

### Website
- **Service Name**: `snow-flow-website`
- **Region**: `europe-west1` (Belgium)
- **Port**: `80`
- **Memory**: `512Mi`
- **CPU**: `1`
- **Min Instances**: `1`
- **Max Instances**: `10`
- **Image Registry**: Container Registry (`gcr.io`)

## Custom Domain Setup

### Status Page: status.snow-flow.dev

```bash
# Map domain
gcloud run domain-mappings create \
  --service snow-flow-status-page \
  --domain status.snow-flow.dev \
  --region europe-west4 \
  --project snow-flow-ai

# Get DNS records to add
gcloud run domain-mappings describe \
  --domain status.snow-flow.dev \
  --region europe-west4 \
  --project snow-flow-ai
```

**Add DNS records** (provided by command above):
- Type: `A` or `AAAA` (IPv4/IPv6)
- Name: `status`
- Value: Cloud Run IP

### Website: snow-flow.dev

```bash
# Map root domain
gcloud run domain-mappings create \
  --service snow-flow-website \
  --domain snow-flow.dev \
  --region europe-west1 \
  --project snow-flow-ai

# Map www subdomain
gcloud run domain-mappings create \
  --service snow-flow-website \
  --domain www.snow-flow.dev \
  --region europe-west1 \
  --project snow-flow-ai
```

## Monitoring & Logs

### View Logs
```bash
# Status page logs
gcloud run services logs read snow-flow-status-page \
  --region europe-west4 \
  --limit 50 \
  --project snow-flow-ai

# Website logs
gcloud run services logs read snow-flow-website \
  --region europe-west1 \
  --limit 50 \
  --project snow-flow-ai

# Cloud Build logs
gcloud builds list --limit 10 --project snow-flow-ai
```

### Health Checks

**Status Page:**
- URL: `https://status.snow-flow.dev/health`
- Expected: `200 OK`

**Website:**
- URL: `https://snow-flow.dev/`
- Expected: `200 OK` with HTML content

### Service URLs

```bash
# Get status page URL
gcloud run services describe snow-flow-status-page \
  --region europe-west4 \
  --format "value(status.url)" \
  --project snow-flow-ai

# Get website URL
gcloud run services describe snow-flow-website \
  --region europe-west1 \
  --format "value(status.url)" \
  --project snow-flow-ai
```

## Troubleshooting

### Error: "Permission denied" on cloudbuild.yaml

**Problem**: Cloud Build tries to execute `cloudbuild.yaml` instead of reading it.

**Solution**: Use the fixed `cloudbuild.yaml` files that specify paths from root:
- ✅ `status-page/Dockerfile` with build context `status-page/`
- ❌ ~~`dir: 'status-page'`~~ (removed - causes issues)

### Error: "Failed to push image to Artifact Registry"

**Problem**: Cloud Build service account lacks permissions.

**Solution**:
```bash
PROJECT_NUMBER=$(gcloud projects describe snow-flow-ai --format="value(projectNumber)")

gcloud projects add-iam-policy-binding snow-flow-ai \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

### Error: "Service deployment failed"

**Problem**: Cloud Build can push images but can't deploy to Cloud Run.

**Solution**:
```bash
PROJECT_NUMBER=$(gcloud projects describe snow-flow-ai --format="value(projectNumber)")

gcloud projects add-iam-policy-binding snow-flow-ai \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding snow-flow-ai \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### Build Times

**Expected build times:**
- Status page: ~2-3 minutes (nginx image is lightweight)
- Website: ~3-5 minutes
- Both services: ~5-7 minutes (parallel builds)

**Slow builds?**
- Check machine type in `cloudbuild.yaml` (should be `E2_HIGHCPU_8`)
- Enable layer caching: `--cache-from` argument in Docker build

### Local Testing

**Status Page:**
```bash
cd status-page
docker build -t status-page-local .
docker run -p 8080:8080 status-page-local
# Open http://localhost:8080
```

**Website:**
```bash
cd website
docker build -t website-local .
docker run -p 80:80 website-local
# Open http://localhost:80
```

## Rollback

### Rollback to Previous Revision

```bash
# List revisions
gcloud run revisions list \
  --service snow-flow-status-page \
  --region europe-west4 \
  --project snow-flow-ai

# Rollback to specific revision
gcloud run services update-traffic snow-flow-status-page \
  --to-revisions REVISION_NAME=100 \
  --region europe-west4 \
  --project snow-flow-ai
```

## Cost Optimization

### Current Setup (Cost Effective)

**Status Page:**
- 1 min instance × 512Mi × 730 hours = ~$18/month
- Requests: Negligible (status page has low traffic)
- **Total**: ~$18/month

**Website:**
- 1 min instance × 512Mi × 730 hours = ~$18/month
- Requests: Free tier likely covers traffic
- **Total**: ~$18/month

**Grand Total**: ~$36/month for both services with 99.9% uptime

### Further Optimization

To reduce costs while maintaining availability:

```bash
# Reduce min instances to 0 (cold starts ~1-2s)
gcloud run services update snow-flow-status-page \
  --min-instances 0 \
  --region europe-west4

# Reduce memory (if sufficient)
gcloud run services update snow-flow-status-page \
  --memory 256Mi \
  --region europe-west4
```

**Cost with min-instances=0**: ~$2-5/month (request-based)

## CI/CD Best Practices

1. ✅ **Use root `cloudbuild.yaml`** - Auto-detects changes, builds only what's needed
2. ✅ **Enable caching** - `--cache-from` speeds up builds by 50%
3. ✅ **Tag images properly** - Both `:$COMMIT_SHA` and `:latest` for easy rollback
4. ✅ **Set appropriate timeouts** - 20 minutes for full monorepo build
5. ✅ **Use separate registries** - Artifact Registry (status-page), Container Registry (website)
6. ✅ **Monitor build metrics** - Cloud Build dashboard shows success rate

## Security Considerations

1. **Allow unauthenticated access**: Both services are public
2. **HTTPS enforced**: Cloud Run provides automatic SSL certificates
3. **Security headers**: nginx.conf includes X-Frame-Options, CSP, etc.
4. **No secrets in code**: Use Secret Manager for sensitive data
5. **Regular updates**: Rebuild images monthly for security patches

## Support

- **Documentation**: This file + service-specific READMEs
- **Issues**: https://github.com/groeimetai/snow-flow/issues
- **Email**: support@snow-flow.dev

---

**Last Updated**: October 31, 2025
