# Health API Custom Domain Setup

## Current Status

✅ Health API deployed successfully to Cloud Run
- Service URL: https://snow-flow-health-api-2e7rlcc77q-ez.a.run.app
- Region: europe-west4
- Service Name: snow-flow-health-api

## Custom Domain Configuration

To map `health-api.snow-flow.dev` to the Health API:

### Step 1: Map the domain in Cloud Run

Run this command in your terminal:

```bash
gcloud run services add-iam-policy-binding snow-flow-health-api \
  --region=europe-west4 \
  --member="allUsers" \
  --role="roles/run.invoker"

# Then add the custom domain mapping
gcloud run domain-mappings create \
  --service=snow-flow-health-api \
  --domain=health-api.snow-flow.dev \
  --region=europe-west4
```

### Step 2: Get DNS records

After running the command above, Google Cloud will provide you with DNS records to add to your domain registrar.

You can also get the required DNS records by running:

```bash
gcloud run domain-mappings describe health-api.snow-flow.dev \
  --region=europe-west4 \
  --format="value(status.resourceRecords)"
```

### Step 3: Add DNS records

Add the following records to your `snow-flow.dev` DNS configuration (exact values will be provided by the command above):

**Typical records:**
- Type: CNAME
- Name: health-api
- Value: ghs.googlehosted.com (or specific value from GCP)

**Or:**
- Type: A
- Name: health-api
- Value: [IP addresses provided by GCP]

### Step 4: Wait for DNS propagation

DNS changes can take up to 48 hours to propagate, but usually complete within 15 minutes.

Verify DNS propagation:
```bash
dig health-api.snow-flow.dev
nslookup health-api.snow-flow.dev
```

### Step 5: Verify SSL certificate

Cloud Run automatically provisions an SSL certificate. Check status:

```bash
gcloud run domain-mappings describe health-api.snow-flow.dev \
  --region=europe-west4 \
  --format="value(status.conditions)"
```

## Alternative: Use Cloud Console

You can also configure the custom domain via the GCP Console:

1. Go to https://console.cloud.google.com/run/domains?project=snow-flow-ai
2. Click "Add Mapping"
3. Select service: `snow-flow-health-api`
4. Enter domain: `health-api.snow-flow.dev`
5. Follow the DNS verification steps

## Testing

Once DNS is configured and propagated:

```bash
# Test health endpoint
curl https://health-api.snow-flow.dev/health

# Test status API
curl https://health-api.snow-flow.dev/api/v1/status

# Test metrics API
curl https://health-api.snow-flow.dev/api/v1/metrics
```

## Troubleshooting

**Domain mapping fails:**
- Ensure you own the domain `snow-flow.dev`
- Verify DNS records are correctly configured
- Check that SSL certificate provisioning completed

**SSL certificate pending:**
```bash
gcloud run domain-mappings list --region=europe-west4
```

**Need to remove mapping:**
```bash
gcloud run domain-mappings delete health-api.snow-flow.dev \
  --region=europe-west4
```
