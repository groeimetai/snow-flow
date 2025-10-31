# Snow-Flow Troubleshooting Guide

## Cloud Build Error: "Permission denied" on cloudbuild.yaml

### The Error

```
2025-10-31 14:54:25.788 CET
bash: line 1: status-page/cloudbuild.yaml: Permission denied
```

### Root Cause

This error occurs when a Cloud Build trigger tries to **execute** the `cloudbuild.yaml` file as a bash script instead of using it as a **configuration file**.

This typically happens when:

1. ❌ The Cloud Build trigger has a **missing or incorrect `--build-config` parameter**
2. ❌ A script somewhere runs `status-page/cloudbuild.yaml` instead of `gcloud builds submit --config status-page/cloudbuild.yaml`
3. ❌ The trigger is configured with wrong build type (inline build instead of config file)

### How Cloud Build SHOULD Call the File

✅ **Correct:**
```bash
gcloud builds submit \
  --config status-page/cloudbuild.yaml \
  --project snow-flow-ai
```

❌ **Wrong (causes "Permission denied"):**
```bash
# This tries to execute the YAML file as a bash script!
status-page/cloudbuild.yaml
```

## Solution 1: Check Your Cloud Build Trigger Configuration

### List Your Triggers

```bash
gcloud builds triggers list --region=europe-west4
```

### Inspect a Specific Trigger

```bash
gcloud builds triggers describe TRIGGER_NAME --region=europe-west4
```

### What to Look For

The trigger configuration should have:

```yaml
# ✅ CORRECT - Uses cloudbuild.yaml as config file
buildConfig:
  type: CLOUD_BUILD_FILE
  path: status-page/cloudbuild.yaml  # OR cloudbuild.yaml for root
```

**NOT:**

```yaml
# ❌ WRONG - Missing buildConfig
# ❌ WRONG - Wrong type
buildConfig:
  type: INLINE_BUILD  # This is wrong!
```

## Solution 2: Recreate the Trigger Correctly

### Delete Old Trigger (if exists)

```bash
gcloud builds triggers delete snow-flow-status-page-deploy --region=europe-west4
```

### Create New Trigger for Status Page

#### Option A: Using Root cloudbuild.yaml (Recommended)

This auto-detects which service changed and builds only what's needed:

```bash
gcloud builds triggers create github \
  --name="snow-flow-monorepo-deploy" \
  --repo-name="snow-flow" \
  --repo-owner="groeimetai" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml" \
  --region="europe-west4" \
  --description="Auto-deploy Snow-Flow services based on changes" \
  --project="snow-flow-ai"
```

#### Option B: Status Page Only

```bash
gcloud builds triggers create github \
  --name="snow-flow-status-page-deploy" \
  --repo-name="snow-flow" \
  --repo-owner="groeimetai" \
  --branch-pattern="^main$" \
  --build-config="status-page/cloudbuild.yaml" \
  --included-files="status-page/**" \
  --region="europe-west4" \
  --description="Deploy status page to Cloud Run" \
  --project="snow-flow-ai"
```

**Key Parameters:**
- `--build-config`: Path to cloudbuild.yaml (this is critical!)
- `--included-files`: Only trigger on changes to these files
- `--region`: europe-west4 (matches Artifact Registry)

### Verify Trigger Configuration

```bash
gcloud builds triggers describe snow-flow-monorepo-deploy \
  --region=europe-west4 \
  --format=yaml
```

You should see:

```yaml
filename: cloudbuild.yaml  # ✅ This means it's using the file as config
# OR
filename: status-page/cloudbuild.yaml  # ✅ For service-specific trigger
```

## Solution 3: Manual Build (Bypass Trigger)

If triggers are giving issues, build manually:

### From Root (Monorepo Build)

```bash
cd /path/to/snow-flow
gcloud builds submit --config cloudbuild.yaml --project=snow-flow-ai
```

### Status Page Only

```bash
cd /path/to/snow-flow
gcloud builds submit --config status-page/cloudbuild.yaml --project=snow-flow-ai
```

### Direct Cloud Run Deployment (Fastest)

Bypass Cloud Build entirely and deploy directly:

```bash
cd status-page
gcloud run deploy snow-flow-status-page \
  --source . \
  --region europe-west4 \
  --platform managed \
  --allow-unauthenticated \
  --project snow-flow-ai
```

## Common Mistakes & Fixes

### Mistake 1: Using `dir:` in cloudbuild.yaml

❌ **Wrong:**
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '.']
    dir: 'status-page'  # This causes path issues!
```

✅ **Correct:**
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-f'
      - 'status-page/Dockerfile'  # Explicit path from root
      - 'status-page/'            # Build context
```

### Mistake 2: Wrong Trigger Type

❌ **Wrong:**
```bash
# Creating inline build (no config file)
gcloud builds triggers create github \
  --name="my-trigger" \
  --inline-config="..."  # This is wrong!
```

✅ **Correct:**
```bash
# Using config file
gcloud builds triggers create github \
  --name="my-trigger" \
  --build-config="cloudbuild.yaml"  # This is right!
```

### Mistake 3: Missing --config Flag

❌ **Wrong:**
```bash
# This tries to build without a config file
gcloud builds submit --project=snow-flow-ai
```

✅ **Correct:**
```bash
# Always specify --config
gcloud builds submit --config cloudbuild.yaml --project=snow-flow-ai
```

## Diagnostic Commands

### Check Cloud Build Service Account Permissions

```bash
PROJECT_NUMBER=$(gcloud projects describe snow-flow-ai --format="value(projectNumber)")
echo "Cloud Build Service Account: ${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

# Check IAM permissions
gcloud projects get-iam-policy snow-flow-ai \
  --flatten="bindings[].members" \
  --filter="bindings.members:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
```

Should have:
- `roles/run.admin`
- `roles/iam.serviceAccountUser`
- `roles/artifactregistry.writer`

### View Recent Build Logs

```bash
# List recent builds
gcloud builds list --limit=5 --project=snow-flow-ai

# Get specific build log
gcloud builds log BUILD_ID --project=snow-flow-ai
```

### Test Build Locally (Docker)

```bash
cd status-page
docker build -t test-status-page .
docker run -p 8080:8080 test-status-page

# Open http://localhost:8080
```

## Quick Fix Checklist

- [ ] Cloud Build trigger uses `--build-config` parameter
- [ ] Trigger `buildConfig.type` is `CLOUD_BUILD_FILE`
- [ ] The `cloudbuild.yaml` file has correct paths (no `dir:` directive)
- [ ] Cloud Build service account has required permissions
- [ ] Running `gcloud builds submit --config cloudbuild.yaml` works manually
- [ ] Dockerfile exists at `status-page/Dockerfile`
- [ ] Artifact Registry repository exists (`europe-west4-docker.pkg.dev`)

## Still Having Issues?

### Enable Detailed Logging

In `cloudbuild.yaml`:
```yaml
options:
  logging: CLOUD_LOGGING_ONLY
  logStreamingOption: STREAM_ON  # Add this
  substitution_option: ALLOW_LOOSE
```

### Check Trigger Events

```bash
# View trigger history
gcloud builds triggers run TRIGGER_NAME --branch=main --region=europe-west4

# Watch build progress
gcloud builds log --stream $(gcloud builds list --limit=1 --format="value(id)")
```

### Contact Support

If none of these solutions work:

1. **Check build logs**: Copy full error from Cloud Build logs
2. **Verify trigger config**: Export with `gcloud builds triggers describe`
3. **Test manually**: Try `gcloud builds submit --config cloudbuild.yaml`
4. **GitHub Issues**: https://github.com/groeimetai/snow-flow/issues
5. **Email**: support@snow-flow.dev

## Related Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) - Complete deployment guide
- [status-page/README.md](status-page/README.md) - Status page specifics
- [Cloud Build Documentation](https://cloud.google.com/build/docs)

---

**Last Updated**: October 31, 2025
