# Google Cloud KMS Setup for Credential Encryption

This portal uses **Google Cloud KMS envelope encryption** for maximum security of customer credentials.

## Why KMS?

- ✅ **HSM-backed encryption** (Hardware Security Modules)
- ✅ **Compliance ready** (SOC 2, ISO 27001, PCI-DSS, HIPAA)
- ✅ **Automatic key rotation** with versioning
- ✅ **Audit logging** for all key access
- ✅ **Zero-knowledge architecture** - keys never leave Google's infrastructure
- ✅ **Perfect for B2B2C** - enterprise trust for service integrators

## How Envelope Encryption Works

1. **Generate** random DEK (Data Encryption Key) for each credential
2. **Encrypt** credential with DEK using AES-256-GCM
3. **Encrypt** DEK with Google Cloud KMS key
4. **Store**: `encrypted_dek:iv:authTag:encrypted_data`

**Benefits:**
- KMS key never leaves Google's HSM
- Each credential has unique DEK
- Fast: only DEK encrypt/decrypt uses KMS API
- Secure: compromising DB doesn't compromise keys

## Setup Instructions

### 1. Create KMS Key Ring & Key

**Via Console:**
1. Go to: https://console.cloud.google.com/security/kms/keyrings
2. Click **"CREATE KEY RING"**
   - Name: `credentials-keyring`
   - Location: `europe-west4` (same region as Cloud Run)
3. Click **"CREATE KEY"** inside the key ring
   - Name: `credentials-key`
   - Protection level: `HSM` (recommended) or `Software`
   - Purpose: `Symmetric encrypt/decrypt`
   - Rotation period: `90 days`

**Via gcloud:**
```bash
# Create keyring
gcloud kms keyrings create credentials-keyring \
  --location=europe-west4

# Create key with HSM
gcloud kms keys create credentials-key \
  --location=europe-west4 \
  --keyring=credentials-keyring \
  --purpose=encryption \
  --protection-level=hsm \
  --rotation-period=90d \
  --next-rotation-time=$(date -d '+90 days' +%Y-%m-%dT%H:%M:%S%z)
```

### 2. Grant Cloud Run Access to KMS Key

```bash
# Get project number
PROJECT_NUMBER=$(gcloud projects describe YOUR-PROJECT-ID --format="value(projectNumber)")

# Get Cloud Run service account
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant KMS access
gcloud kms keys add-iam-policy-binding credentials-key \
  --location=europe-west4 \
  --keyring=credentials-keyring \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter"
```

### 3. Update Cloud Run Environment Variables

```bash
gcloud run services update snow-flow-enterprise \
  --region=europe-west4 \
  --update-env-vars=GCP_PROJECT_ID=YOUR-PROJECT-ID,KMS_LOCATION=europe-west4,KMS_KEY_RING=credentials-keyring,KMS_KEY_NAME=credentials-key
```

**Or via Console:**
1. Go to Cloud Run service
2. Edit & Deploy New Revision
3. Add environment variables:
   - `GCP_PROJECT_ID`: `your-project-id`
   - `KMS_LOCATION`: `europe-west4`
   - `KMS_KEY_RING`: `credentials-keyring`
   - `KMS_KEY_NAME`: `credentials-key`

### 4. Verify KMS is Active

Check Cloud Run logs after deployment:
```
✅ KMS encryption enabled for credentials
✅ KMS connection test successful
```

If you see:
```
ℹ️  KMS not configured - using local AES-256-GCM encryption
```

Then KMS env vars are missing or incorrect.

## Fallback Mode

If KMS is not configured or fails to initialize, the system automatically falls back to local AES-256-GCM encryption using `CREDENTIALS_ENCRYPTION_KEY`.

**Fallback is only for development!** Production deployments should ALWAYS use KMS.

## Key Rotation

KMS automatically rotates keys every 90 days. Old key versions remain available for decryption, but new encryptions use the latest version.

**No action needed** - rotation is transparent!

## Costs

**KMS Pricing (approximate):**
- Active key: **$1/month**
- HSM key: **$2.50/month**
- Operations: **$0.03 per 10,000 operations**

**Typical usage for 100 customers with 5 credentials each:**
- Encrypt operations: ~500 (one-time)
- Decrypt operations: ~50/day = 1,500/month
- **Total cost: ~$3-5/month**

**Worth it for enterprise trust!**

## Security Benefits

### For Service Integrators:
- ✅ SOC 2 compliance ready
- ✅ Enterprise-grade key management
- ✅ Audit trail for every key access
- ✅ HSM-backed encryption
- ✅ Meets GDPR, HIPAA, PCI-DSS requirements

### For Customers:
- ✅ Zero-knowledge architecture
- ✅ Keys managed by Google (not you)
- ✅ Automatic key rotation
- ✅ No single point of failure
- ✅ Military-grade encryption

## Troubleshooting

### "KMS initialization failed"

**Check:**
1. KMS API enabled: `gcloud services enable cloudkms.googleapis.com`
2. Service account has `roles/cloudkms.cryptoKeyEncrypterDecrypter`
3. Environment variables are correct (project ID, location, keyring, key name)

### "Permission denied on KMS key"

```bash
# Verify service account access
gcloud kms keys get-iam-policy credentials-key \
  --location=europe-west4 \
  --keyring=credentials-keyring
```

Should show your service account with `cryptoKeyEncrypterDecrypter` role.

### "KMS test failed - falling back to local encryption"

Check Cloud Run logs for detailed error. Common causes:
- Wrong key path (project ID, location, keyring name, or key name)
- Key doesn't exist
- Insufficient permissions

## Migration from Local to KMS

Existing credentials encrypted with local AES-256-GCM will continue to work! The system detects the format and decrypts accordingly:

- **3 parts** (`iv:authTag:data`) = Local AES-256-GCM
- **4 parts** (`encrypted_dek:iv:authTag:data`) = KMS envelope encryption

New credentials will automatically use KMS once configured.

---

**For support:** See main [README.md](../README.md)
