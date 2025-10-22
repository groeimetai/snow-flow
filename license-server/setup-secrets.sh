#!/bin/bash
# Snow-Flow Enterprise License Server - Secret Manager Setup
#
# This script helps create required secrets in Google Secret Manager
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - Secret Manager API enabled
#   - Appropriate IAM permissions
#
# Usage:
#   ./setup-secrets.sh [project-id]

set -e
set -u

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ID="${1:-}"

if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}❌ Usage: $0 <project-id>${NC}"
  echo -e "${YELLOW}Example: $0 my-gcp-project${NC}"
  exit 1
fi

echo -e "${BLUE}🔐 Setting up secrets for project: $PROJECT_ID${NC}"
gcloud config set project "$PROJECT_ID"

# Generate secure random secrets
generate_secret() {
  openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Enable Secret Manager API
echo -e "${BLUE}🔧 Enabling Secret Manager API...${NC}"
gcloud services enable secretmanager.googleapis.com

# Create ADMIN_KEY
echo ""
echo -e "${BLUE}📝 Creating ADMIN_KEY secret...${NC}"
echo -e "${YELLOW}This key is used for admin API authentication.${NC}"
read -p "Enter admin key (or press Enter to generate): " ADMIN_KEY_INPUT
ADMIN_KEY="${ADMIN_KEY_INPUT:-$(generate_secret)}"

if gcloud secrets describe ADMIN_KEY --project="$PROJECT_ID" &>/dev/null; then
  echo -e "${YELLOW}⚠️  ADMIN_KEY already exists. Updating...${NC}"
  echo -n "$ADMIN_KEY" | gcloud secrets versions add ADMIN_KEY --data-file=-
else
  echo -n "$ADMIN_KEY" | gcloud secrets create ADMIN_KEY --data-file=- \
    --replication-policy="automatic" \
    --labels="app=snow-flow,component=license-server"
fi
echo -e "${GREEN}✅ ADMIN_KEY configured${NC}"
echo -e "${GREEN}   Value: $ADMIN_KEY${NC}"
echo -e "${YELLOW}   ⚠️  Save this value securely! You'll need it for API calls.${NC}"

# Create SESSION_SECRET
echo ""
echo -e "${BLUE}📝 Creating SESSION_SECRET...${NC}"
echo -e "${YELLOW}This secret is used for session management (SSO).${NC}"
SESSION_SECRET=$(generate_secret)

if gcloud secrets describe SESSION_SECRET --project="$PROJECT_ID" &>/dev/null; then
  echo -e "${YELLOW}⚠️  SESSION_SECRET already exists. Updating...${NC}"
  echo -n "$SESSION_SECRET" | gcloud secrets versions add SESSION_SECRET --data-file=-
else
  echo -n "$SESSION_SECRET" | gcloud secrets create SESSION_SECRET --data-file=- \
    --replication-policy="automatic" \
    --labels="app=snow-flow,component=license-server"
fi
echo -e "${GREEN}✅ SESSION_SECRET configured (auto-generated)${NC}"

# Create JWT_SECRET
echo ""
echo -e "${BLUE}📝 Creating JWT_SECRET...${NC}"
echo -e "${YELLOW}This secret is used for JWT token signing (SSO).${NC}"
JWT_SECRET=$(generate_secret)

if gcloud secrets describe JWT_SECRET --project="$PROJECT_ID" &>/dev/null; then
  echo -e "${YELLOW}⚠️  JWT_SECRET already exists. Updating...${NC}"
  echo -n "$JWT_SECRET" | gcloud secrets versions add JWT_SECRET --data-file=-
else
  echo -n "$JWT_SECRET" | gcloud secrets create JWT_SECRET --data-file=- \
    --replication-policy="automatic" \
    --labels="app=snow-flow,component=license-server"
fi
echo -e "${GREEN}✅ JWT_SECRET configured (auto-generated)${NC}"

# Grant Cloud Run access to secrets
echo ""
echo -e "${BLUE}🔐 Granting Cloud Run access to secrets...${NC}"

# Get Cloud Run service account (default: PROJECT_NUMBER-compute@developer.gserviceaccount.com)
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
SERVICE_ACCOUNT="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

echo -e "${BLUE}Service account: $SERVICE_ACCOUNT${NC}"

for SECRET in "ADMIN_KEY" "SESSION_SECRET" "JWT_SECRET"; do
  echo -e "${BLUE}  Granting access to $SECRET...${NC}"
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT_ID" > /dev/null
  echo -e "${GREEN}  ✅ Access granted to $SECRET${NC}"
done

# Summary
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ All secrets configured successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📋 Secrets created:${NC}"
echo -e "  • ADMIN_KEY: ${GREEN}$ADMIN_KEY${NC}"
echo -e "  • SESSION_SECRET: ${GREEN}(auto-generated)${NC}"
echo -e "  • JWT_SECRET: ${GREEN}(auto-generated)${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Save the ADMIN_KEY value!${NC}"
echo -e "${YELLOW}   You'll need it for admin API calls.${NC}"
echo ""
echo -e "${BLUE}🔧 Next steps:${NC}"
echo -e "  1. Update Cloud Run service to use secrets:"
echo -e "     ${YELLOW}gcloud run services update license-server \\${NC}"
echo -e "     ${YELLOW}  --region=europe-west1 \\${NC}"
echo -e "     ${YELLOW}  --update-secrets=ADMIN_KEY=ADMIN_KEY:latest,SESSION_SECRET=SESSION_SECRET:latest,JWT_SECRET=JWT_SECRET:latest${NC}"
echo ""
echo -e "  2. Or deploy with secrets already configured:"
echo -e "     ${YELLOW}./deploy.sh production${NC}"
echo ""
echo -e "${BLUE}📝 Save credentials to file (optional):${NC}"
cat > "secrets-$PROJECT_ID.env" <<EOF
# Snow-Flow Enterprise License Server - Secrets
# Generated: $(date)
# Project: $PROJECT_ID
#
# ⚠️  KEEP THIS FILE SECURE! DO NOT COMMIT TO GIT!

ADMIN_KEY=$ADMIN_KEY
PROJECT_ID=$PROJECT_ID
EOF
echo -e "${GREEN}✅ Credentials saved to: secrets-$PROJECT_ID.env${NC}"
echo -e "${YELLOW}⚠️  Add to .gitignore: secrets-*.env${NC}"
echo ""
