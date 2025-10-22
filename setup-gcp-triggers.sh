#!/bin/bash

# Snow-Flow Enterprise - GCP Cloud Build Triggers Setup
# This script creates Cloud Build triggers for automatic deployment

set -e  # Exit on error

echo "================================================"
echo "🚀 Snow-Flow Enterprise - GCP Setup"
echo "================================================"
echo ""

# Configuration
PROJECT_ID="${1:-snow-flow-enterprise}"
REPO_OWNER="groeimetai"
REPO_NAME="snow-flow-enterprise"
REGION="europe-west4"

echo "📋 Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Repository: $REPO_OWNER/$REPO_NAME"
echo "  Region: $REGION"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI not found"
    echo "   Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Set active project
echo "🔧 Setting active project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable storage.googleapis.com

# Create Secret Manager secret for ADMIN_KEY (if not exists)
echo "🔒 Setting up secrets..."
if ! gcloud secrets describe ADMIN_KEY &> /dev/null; then
    echo "  Creating ADMIN_KEY secret..."
    ADMIN_KEY=$(openssl rand -hex 32)
    echo -n "$ADMIN_KEY" | gcloud secrets create ADMIN_KEY --data-file=-
    echo "  ✓ ADMIN_KEY created: $ADMIN_KEY"
    echo "  ⚠️  SAVE THIS KEY! You'll need it for /stats endpoint"
else
    echo "  ✓ ADMIN_KEY already exists"
fi

# Grant Cloud Build service account access to secrets
echo "🔐 Granting Cloud Build access to secrets..."
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding ADMIN_KEY \
    --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet

# Create Cloud Storage bucket for backups
echo "💾 Setting up backup storage..."
BACKUP_BUCKET="gs://$PROJECT_ID-license-backups"
if ! gsutil ls $BACKUP_BUCKET &> /dev/null; then
    gsutil mb -l $REGION $BACKUP_BUCKET
    gsutil versioning set on $BACKUP_BUCKET
    echo "  ✓ Backup bucket created: $BACKUP_BUCKET"
else
    echo "  ✓ Backup bucket already exists"
fi

# Create Cloud Build trigger for TEST branch
echo "🔨 Creating TEST environment trigger..."
if gcloud builds triggers describe license-server-test &> /dev/null; then
    echo "  ✓ TEST trigger already exists"
else
    gcloud builds triggers create github \
        --name="license-server-test" \
        --repo-owner="$REPO_OWNER" \
        --repo-name="$REPO_NAME" \
        --branch-pattern="^test$" \
        --build-config="license-server/cloudbuild-test.yaml" \
        --description="Deploy license server to TEST on push to test branch"
    echo "  ✓ TEST trigger created"
fi

# Create Cloud Build trigger for PRODUCTION branch
echo "🔨 Creating PRODUCTION environment trigger..."
if gcloud builds triggers describe license-server-prod &> /dev/null; then
    echo "  ✓ PRODUCTION trigger already exists"
else
    gcloud builds triggers create github \
        --name="license-server-prod" \
        --repo-owner="$REPO_OWNER" \
        --repo-name="$REPO_NAME" \
        --branch-pattern="^main$" \
        --build-config="license-server/cloudbuild-prod.yaml" \
        --description="Deploy license server to PRODUCTION on push to main branch"
    echo "  ✓ PRODUCTION trigger created"
fi

echo ""
echo "================================================"
echo "✅ Setup Complete!"
echo "================================================"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Connect GitHub repository to Cloud Build:"
echo "   https://console.cloud.google.com/cloud-build/triggers/connect?project=$PROJECT_ID"
echo ""
echo "2. Create branches in GitHub:"
echo "   cd /path/to/snow-flow-enterprise"
echo "   git checkout -b test"
echo "   git push origin test"
echo ""
echo "3. Test deployment:"
echo "   - Push to 'test' branch → triggers test deployment"
echo "   - Push to 'main' branch → triggers production deployment"
echo ""
echo "4. View deployments:"
echo "   - Test: https://console.cloud.google.com/run/detail/$REGION/license-server-test"
echo "   - Prod: https://console.cloud.google.com/run/detail/$REGION/license-server-prod"
echo ""
echo "================================================"
echo "🔑 ADMIN_KEY is stored in Secret Manager"
echo "   To retrieve: gcloud secrets versions access latest --secret=ADMIN_KEY"
echo "================================================"
