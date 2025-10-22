#!/bin/bash
# Snow-Flow Enterprise License Server - Cloud Build Deployment Script
#
# This script triggers Google Cloud Build to build and deploy the license server
#
# Prerequisites:
#   1. gcloud CLI installed and authenticated
#   2. Google Cloud project created
#   3. Artifact Registry repository created
#   4. Cloud Build API enabled
#   5. Cloud Run API enabled
#   6. Secrets configured in Secret Manager (ADMIN_KEY, SESSION_SECRET, JWT_SECRET)
#
# Usage:
#   ./deploy.sh [environment]
#
# Examples:
#   ./deploy.sh production
#   ./deploy.sh staging

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
ENVIRONMENT="${1:-production}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment-specific config
CONFIG_FILE="$SCRIPT_DIR/deploy-config-${ENVIRONMENT}.env"
if [ ! -f "$CONFIG_FILE" ]; then
  echo -e "${RED}❌ Configuration file not found: $CONFIG_FILE${NC}"
  echo -e "${YELLOW}Creating template configuration file...${NC}"

  cat > "$CONFIG_FILE" <<'EOF'
# Snow-Flow Enterprise License Server - Deployment Configuration
# Copy this file and configure for your environment

# GCP Configuration
PROJECT_ID=""                    # Your GCP project ID
REGION="europe-west1"            # GCP region (europe-west1, us-central1, etc.)
ARTIFACT_REGISTRY_REPO="snow-flow-enterprise"  # Artifact Registry repository name
SERVICE_NAME="license-server"    # Cloud Run service name

# Cloud Run Configuration
MIN_INSTANCES="1"                # Minimum instances (0 for scale-to-zero, 1+ for always-on)
MAX_INSTANCES="10"               # Maximum instances
MEMORY="512Mi"                   # Memory per instance (512Mi, 1Gi, 2Gi)
CPU="1"                          # CPU per instance (1, 2)
CONCURRENCY="80"                 # Max concurrent requests per instance
TIMEOUT="300s"                   # Request timeout (max 3600s for Cloud Run)

# Secret Manager (these should be created separately)
# Create secrets: gcloud secrets create ADMIN_KEY --data-file=- <<< "your-admin-key"
ADMIN_KEY_SECRET="ADMIN_KEY"             # Secret Manager secret name
SESSION_SECRET_NAME="SESSION_SECRET"      # Secret Manager secret name
JWT_SECRET_NAME="JWT_SECRET"              # Secret Manager secret name
EOF

  echo -e "${GREEN}✅ Template created: $CONFIG_FILE${NC}"
  echo -e "${YELLOW}⚠️  Please edit the file and configure your settings, then run this script again.${NC}"
  exit 1
fi

# Load configuration
echo -e "${BLUE}📋 Loading configuration from: $CONFIG_FILE${NC}"
source "$CONFIG_FILE"

# Validate required configuration
if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}❌ PROJECT_ID not configured in $CONFIG_FILE${NC}"
  exit 1
fi

# Set GCP project
echo -e "${BLUE}🔧 Setting GCP project: $PROJECT_ID${NC}"
gcloud config set project "$PROJECT_ID"

# Verify APIs are enabled
echo -e "${BLUE}🔍 Verifying required APIs...${NC}"
REQUIRED_APIS=(
  "cloudbuild.googleapis.com"
  "run.googleapis.com"
  "artifactregistry.googleapis.com"
  "secretmanager.googleapis.com"
)

for API in "${REQUIRED_APIS[@]}"; do
  if gcloud services list --enabled --filter="name:$API" --format="value(name)" | grep -q "$API"; then
    echo -e "${GREEN}  ✅ $API enabled${NC}"
  else
    echo -e "${YELLOW}  ⚠️  $API not enabled. Enabling...${NC}"
    gcloud services enable "$API"
    echo -e "${GREEN}  ✅ $API enabled${NC}"
  fi
done

# Verify Artifact Registry repository exists
echo -e "${BLUE}🔍 Verifying Artifact Registry repository...${NC}"
if gcloud artifacts repositories describe "$ARTIFACT_REGISTRY_REPO" \
    --location="$REGION" &>/dev/null; then
  echo -e "${GREEN}✅ Artifact Registry repository exists: $ARTIFACT_REGISTRY_REPO${NC}"
else
  echo -e "${YELLOW}⚠️  Artifact Registry repository not found. Creating...${NC}"
  gcloud artifacts repositories create "$ARTIFACT_REGISTRY_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Snow-Flow Enterprise Docker images"
  echo -e "${GREEN}✅ Artifact Registry repository created${NC}"
fi

# Verify secrets exist
echo -e "${BLUE}🔍 Verifying secrets in Secret Manager...${NC}"
REQUIRED_SECRETS=("$ADMIN_KEY_SECRET" "$SESSION_SECRET_NAME" "$JWT_SECRET_NAME")

for SECRET in "${REQUIRED_SECRETS[@]}"; do
  if gcloud secrets describe "$SECRET" --project="$PROJECT_ID" &>/dev/null; then
    echo -e "${GREEN}  ✅ Secret exists: $SECRET${NC}"
  else
    echo -e "${RED}  ❌ Secret not found: $SECRET${NC}"
    echo -e "${YELLOW}  Create it with: gcloud secrets create $SECRET --data-file=- <<< 'your-secret-value'${NC}"
    exit 1
  fi
done

# Trigger Cloud Build
echo ""
echo -e "${BLUE}🚀 Triggering Cloud Build deployment...${NC}"
echo -e "${BLUE}   Region: $REGION${NC}"
echo -e "${BLUE}   Service: $SERVICE_NAME${NC}"
echo -e "${BLUE}   Repository: $ARTIFACT_REGISTRY_REPO${NC}"
echo ""

gcloud builds submit \
  --config="$SCRIPT_DIR/cloudbuild.yaml" \
  --substitutions="_REGION=$REGION,_ARTIFACT_REGISTRY_REPO=$ARTIFACT_REGISTRY_REPO,_SERVICE_NAME=$SERVICE_NAME,_MIN_INSTANCES=$MIN_INSTANCES,_MAX_INSTANCES=$MAX_INSTANCES,_MEMORY=$MEMORY,_CPU=$CPU,_CONCURRENCY=$CONCURRENCY,_TIMEOUT=$TIMEOUT" \
  "$SCRIPT_DIR"

# Get service URL
echo ""
echo -e "${BLUE}🔍 Getting Cloud Run service URL...${NC}"
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --format='value(status.url)')

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Service URL: $SERVICE_URL${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📊 Endpoints:${NC}"
echo -e "  Health:      $SERVICE_URL/health"
echo -e "  MCP:         $SERVICE_URL/mcp/tools/list"
echo -e "  Admin:       $SERVICE_URL/api/admin/customers"
echo -e "  SSO:         $SERVICE_URL/sso/login/:customerId"
echo -e "  Credentials: $SERVICE_URL/api/credentials/list"
echo -e "  Monitoring:  $SERVICE_URL/monitoring/health/detailed"
echo ""
echo -e "${BLUE}🔐 Next steps:${NC}"
echo -e "  1. Configure Cloud Run secrets:"
echo -e "     ${YELLOW}gcloud run services update $SERVICE_NAME \\${NC}"
echo -e "     ${YELLOW}  --region=$REGION \\${NC}"
echo -e "     ${YELLOW}  --update-secrets=ADMIN_KEY=$ADMIN_KEY_SECRET:latest,SESSION_SECRET=$SESSION_SECRET_NAME:latest,JWT_SECRET=$JWT_SECRET_NAME:latest${NC}"
echo ""
echo -e "  2. Test health endpoint:"
echo -e "     ${YELLOW}curl $SERVICE_URL/health${NC}"
echo ""
echo -e "  3. Create first customer license:"
echo -e "     ${YELLOW}curl -X POST $SERVICE_URL/api/admin/customers \\${NC}"
echo -e "     ${YELLOW}  -H 'X-Admin-Key: \$ADMIN_KEY' \\${NC}"
echo -e "     ${YELLOW}  -H 'Content-Type: application/json' \\${NC}"
echo -e "     ${YELLOW}  -d '{\"name\": \"Acme Corp\", \"email\": \"admin@acme.com\", \"tier\": \"enterprise\"}'${NC}"
echo ""
