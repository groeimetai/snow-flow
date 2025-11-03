# Snow-Flow Cloud Build Triggers Setup

## Health API - Automatic Deployment via Cloud Build Triggers

### Quick Setup (Recommended):

1. **Open GCP Console Cloud Build Triggers**
   ```
   https://console.cloud.google.com/cloud-build/triggers
   ```

2. **Connect GitHub Repository** (first time only)
   - Click "Connect Repository"
   - Select "GitHub (Cloud Build GitHub App)"
   - Authenticate with GitHub
   - Select: `groeimetai/snow-flow`
   - Click "Connect"

3. **Create Trigger for Health API**
   - Click "Create Trigger"
   - Name: `health-api-deploy`
   - Event: **Push to a branch**
   - Branch: `^main$`
   - Included files: `health-api/**`, `src/api/**`, `package.json`
   - Configuration: Cloud Build configuration file
   - Location: `health-api/cloudbuild.yaml`
   - Click "Create"

4. **Test the Trigger**
   - Click "RUN" button next to trigger
   - Or push to main branch to auto-trigger

### Via gcloud CLI:

```bash
gcloud builds triggers create github \
  --repo-name=snow-flow \
  --repo-owner=groeimetai \
  --branch-pattern="^main$" \
  --build-config=health-api/cloudbuild.yaml \
  --name=health-api-deploy
```

## That's it! Now every push to main = automatic deployment 🚀
