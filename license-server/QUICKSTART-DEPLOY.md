# Quick Start: Deploy to GCP in 5 Minutes

Fast-track deployment guide for Snow-Flow Enterprise License Server.

## Prerequisites

- Google Cloud SDK installed (`gcloud` command available)
- Authenticated with GCP (`gcloud auth login` completed)
- GCP project with billing enabled

## Step 1: Setup Secrets (2 minutes)

```bash
# Run automated secrets setup
./setup-secrets.sh your-project-id

# Save the ADMIN_KEY value shown in output!
```

✅ **Result:** Three secrets created in Secret Manager (ADMIN_KEY, SESSION_SECRET, JWT_SECRET)

## Step 2: Configure Deployment (1 minute)

```bash
# Run deploy script (creates template config on first run)
./deploy.sh production

# Edit the generated config file
nano deploy-config-production.env
```

**Minimum required configuration:**
```bash
PROJECT_ID="your-project-id"
REGION="europe-west1"
```

## Step 3: Deploy! (5-8 minutes)

```bash
# Deploy to Cloud Run
./deploy.sh production
```

✅ **Result:** Service deployed and health-checked automatically

## Step 4: Test (30 seconds)

```bash
# Get service URL from deploy output, then:
SERVICE_URL="https://license-server-xxxxx-ew.a.run.app"
ADMIN_KEY="your-admin-key-from-step-1"

# Health check
curl $SERVICE_URL/health

# Create first customer
curl -X POST $SERVICE_URL/api/admin/customers \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "email": "admin@acme.com",
    "tier": "enterprise",
    "maxInstances": 10
  }'
```

✅ **Done!** Your license server is live.

## Common Commands

```bash
# View logs
gcloud run services logs tail license-server --region=europe-west1

# Update service
./deploy.sh production

# Rollback
gcloud run services update-traffic license-server \
  --region=europe-west1 \
  --to-revisions=license-server-00001-abc=100

# Delete service
gcloud run services delete license-server --region=europe-west1
```

## What's Next?

- Configure custom domain: See [DEPLOYMENT.md](DEPLOYMENT.md#custom-domain)
- Set up monitoring alerts: See [DEPLOYMENT.md](DEPLOYMENT.md#alerts)
- Production hardening: See [DEPLOYMENT.md](DEPLOYMENT.md#production-checklist)

## Troubleshooting

**Deployment fails?**
```bash
# Check build logs
gcloud builds list --limit=5

# View detailed logs
gcloud builds log <BUILD_ID>
```

**Health check fails?**
```bash
# Check service logs
gcloud run services logs tail license-server --region=europe-west1

# Check service status
gcloud run services describe license-server --region=europe-west1
```

**Need help?**
- Full guide: [DEPLOYMENT.md](DEPLOYMENT.md)
- Troubleshooting: [DEPLOYMENT.md#troubleshooting](DEPLOYMENT.md#troubleshooting)

---

**Deployment Time:** ~10 minutes total
**Estimated Cost:** $15-50/month (production with MIN_INSTANCES=1)
