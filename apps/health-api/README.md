# Snow-Flow Health API

**Live URL**: https://health-api.snow-flow.dev (or Cloud Run URL)

Real-time system health monitoring API providing status, metrics, and incident management for Snow-Flow Enterprise services.

## Features

- ✅ Real-time system health monitoring
- ✅ CPU, memory, and disk usage tracking
- ✅ 90-day uptime history
- ✅ Service status per component
- ✅ Incident management (create, update, resolve)
- ✅ Average response latency tracking
- ✅ CORS enabled for status page integration
- ✅ Auto-scaling with Cloud Run

## API Endpoints

### Health Check

```bash
GET /health
```

Basic health check endpoint for load balancers and monitoring.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-27T10:30:00.000Z",
  "service": "snow-flow-health-api",
  "version": "1.0.0"
}
```

### System Status

```bash
GET /api/v1/status
```

Comprehensive system status including all services, uptime, and active incidents.

**Response:**
```json
{
  "overall_status": "operational",
  "uptime_30d": 99.97,
  "avg_latency": 145,
  "active_incidents": 0,
  "services": {
    "mcp_server": { "status": "operational" },
    "portal": { "status": "operational" },
    "website": { "status": "operational" },
    "database": { "status": "operational" }
  },
  "system_resources": {
    "cpu_usage": 12.5,
    "memory_usage": 45.2,
    "disk_usage": 28.3,
    "uptime_seconds": 864000
  },
  "timestamp": "2025-12-27T10:30:00.000Z"
}
```

### System Metrics

```bash
GET /api/v1/metrics
```

Detailed system resource metrics for monitoring dashboards.

**Response:**
```json
{
  "timestamp": "2025-12-27T10:30:00.000Z",
  "uptime_seconds": 864000,
  "total_checks": 2880,
  "system_resources": {
    "cpuUsage": 12.5,
    "memoryUsage": 256.4,
    "memoryTotal": 512.0,
    "memoryUsagePercent": 50.1,
    "diskUsage": 28.3,
    "diskTotal": 10.0,
    "loadAverage": [0.5, 0.4, 0.3],
    "processCount": 1,
    "platform": "linux",
    "arch": "x64"
  }
}
```

### Uptime History

```bash
GET /api/v1/uptime-history?days=90
```

Historical uptime data for trend analysis and SLA reporting.

**Parameters:**
- `days` (optional): Number of days to retrieve (default: 90)

**Response:**
```json
{
  "days": 30,
  "uptime_data": [
    {
      "date": "2025-12-27",
      "uptime_percentage": 100,
      "total_checks": 48,
      "healthy_checks": 48
    }
  ]
}
```

### Incident Management

#### List Incidents

```bash
GET /api/v1/incidents?limit=50
```

Retrieve active and recent incidents.

**Response:**
```json
{
  "active": [],
  "recent": [],
  "total_active": 0,
  "total_history": 5
}
```

#### Create Incident

```bash
POST /api/v1/incidents
Content-Type: application/json

{
  "title": "Database Connection Issues",
  "description": "Intermittent connection timeouts to primary database",
  "severity": "major",
  "affectedServices": ["database", "portal"]
}
```

**Severity Levels:**
- `critical` - Major service outage, status becomes "outage"
- `major` - Service degradation, status becomes "degraded"
- `minor` - Minor issues, status remains "operational"

#### Update Incident

```bash
POST /api/v1/incidents/:id/update
Content-Type: application/json

{
  "status": "identified",
  "message": "Root cause identified: connection pool exhaustion"
}
```

**Status Values:**
- `investigating` - Initial state
- `identified` - Root cause found
- `monitoring` - Fix applied, monitoring
- `resolved` - Issue resolved

#### Resolve Incident

```bash
POST /api/v1/incidents/:id/resolve
Content-Type: application/json

{
  "message": "Connection pool increased, all systems operational"
}
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Status Page (Frontend)                  │
│        https://status.snow-flow.dev                  │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS (every 30s)
                       ▼
┌─────────────────────────────────────────────────────┐
│         Cloud Run: snow-flow-health-api              │
│              (Node.js + Express)                     │
│                                                      │
│  Endpoints:                                          │
│  ├── /health              - Basic health check       │
│  ├── /api/v1/status       - System status            │
│  ├── /api/v1/metrics      - Detailed metrics         │
│  ├── /api/v1/uptime-history - Historical data        │
│  └── /api/v1/incidents    - Incident management      │
│                                                      │
│  Data:                                               │
│  ├── In-memory health history (4320 records)        │
│  ├── Response time tracking (last 100 requests)    │
│  └── Incident storage (active + history)            │
└──────────────────────┬──────────────────────────────┘
                       │ Future
                       ▼
┌─────────────────────────────────────────────────────┐
│     Cloud SQL: snow-flow-production-db               │
│        (Persistent storage - planned)                │
└─────────────────────────────────────────────────────┘
```

## Technology Stack

- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js
- **Hosting**: Google Cloud Run (europe-west4)
- **Build**: Cloud Build with Docker
- **Registry**: Artifact Registry

## Deployment

### Prerequisites

- Google Cloud Project: `snow-flow-ai`
- Cloud Build API enabled
- Cloud Run API enabled
- Artifact Registry repository

### Automatic Deployment (CI/CD)

The Health API is automatically deployed when changes are pushed to the `main` branch.

**Cloud Build Trigger:**
```bash
gcloud builds triggers create github \
  --name="snow-flow-health-api-deploy" \
  --repo-name="snow-flow" \
  --repo-owner="groeimetai" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild-health-api.yaml" \
  --included-files="apps/health-api/**,src/api/simple-health-api.ts" \
  --region="europe-west4"
```

### Manual Deployment

```bash
# From repository root
cd apps/health-api

# Submit build to Cloud Build
gcloud builds submit --config cloudbuild.yaml --project=snow-flow-ai

# Or deploy directly with Cloud Run
gcloud run deploy snow-flow-health-api \
  --source . \
  --region europe-west4 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 3
```

### Custom Domain Setup

See [DOMAIN_SETUP.md](./DOMAIN_SETUP.md) for detailed instructions on mapping `health-api.snow-flow.dev`.

```bash
gcloud run domain-mappings create \
  --service=snow-flow-health-api \
  --domain=health-api.snow-flow.dev \
  --region=europe-west4
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port (Cloud Run provides this) | `8080` |
| `HOST` | Server host binding | `0.0.0.0` |
| `NODE_ENV` | Environment mode | `development` |

### CORS Configuration

The API allows requests from:
- `http://localhost:8080` (development)
- `https://status.snow-flow.dev` (production status page)
- `https://snow-flow.dev` (main website)

### Resource Limits

| Resource | Value |
|----------|-------|
| Memory | 512 MiB |
| CPU | 1 vCPU |
| Min Instances | 1 (always warm) |
| Max Instances | 3 (auto-scaling) |
| Timeout | 300 seconds |

## Development

### Local Setup

```bash
# Install dependencies
cd apps/health-api
npm install

# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Run production build
npm start
```

### Local Testing

```bash
# Health check
curl http://localhost:8080/health

# System status
curl http://localhost:8080/api/v1/status

# System metrics
curl http://localhost:8080/api/v1/metrics

# Uptime history
curl http://localhost:8080/api/v1/uptime-history
```

### Docker Development

```bash
# Build Docker image
docker build -t snow-flow-health-api .

# Run container
docker run -p 8080:8080 snow-flow-health-api

# Test endpoints
curl http://localhost:8080/health
```

## File Structure

```
health-api/
├── src/
│   └── simple-health-api.ts    # Main API server (TypeScript)
├── Dockerfile                   # Container definition
├── cloudbuild.yaml              # Cloud Build configuration
├── package.json                 # Dependencies and scripts
├── tsconfig.json                # TypeScript configuration
├── README.md                    # This file
├── DEPLOYMENT_SUMMARY.md        # Deployment details and verification
├── DOMAIN_SETUP.md              # Custom domain configuration
├── INCIDENT_TESTING.md          # Incident testing guide
└── CLOUD_SQL_INTEGRATION.md     # Database integration plan
```

## Monitoring

### View Logs

```bash
gcloud run services logs read snow-flow-health-api \
  --region=europe-west4 \
  --limit=50
```

### Check Service Status

```bash
gcloud run services describe snow-flow-health-api \
  --region=europe-west4
```

### Cloud Console Links

- **Service**: [Cloud Run Console](https://console.cloud.google.com/run/detail/europe-west4/snow-flow-health-api?project=snow-flow-ai)
- **Builds**: [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers?project=snow-flow-ai)
- **Logs**: [Cloud Logging](https://console.cloud.google.com/logs/query?project=snow-flow-ai)

## Incident Testing

For testing incident workflows and status page integration, see [INCIDENT_TESTING.md](./INCIDENT_TESTING.md).

Quick test:
```bash
# Create a test incident
curl -X POST https://health-api.snow-flow.dev/api/v1/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Incident",
    "description": "Testing incident workflow",
    "severity": "minor",
    "affectedServices": ["website"]
  }'
```

## Future Enhancements

See [CLOUD_SQL_INTEGRATION.md](./CLOUD_SQL_INTEGRATION.md) for the planned database integration:

- Persistent metrics storage with Cloud SQL
- Historical trend analysis
- Automated uptime aggregation
- Enhanced incident tracking

## Performance

| Metric | Value |
|--------|-------|
| Cold Start | ~2-3 seconds |
| Response Time | <200ms |
| Availability SLA | 99.95% (Cloud Run) |

## Security

- **HTTPS**: Automatic SSL/TLS certificates via Cloud Run
- **IAM**: Public access for health endpoints
- **Isolation**: Serverless container environment
- **Secrets**: No sensitive data in environment variables

## Cost Estimate

Cloud Run pricing (pay-per-use):

| Component | Price |
|-----------|-------|
| CPU | $0.00002400/vCPU-second |
| Memory | $0.00000250/GiB-second |
| Requests | $0.40/million requests |

**Estimated monthly cost**: $5-10 (with 1 min instance always warm)

## Related Documentation

- [Deployment Summary](./DEPLOYMENT_SUMMARY.md) - Detailed deployment info
- [Domain Setup](./DOMAIN_SETUP.md) - Custom domain configuration
- [Incident Testing](./INCIDENT_TESTING.md) - Testing incident workflows
- [Cloud SQL Integration](./CLOUD_SQL_INTEGRATION.md) - Database integration plan

## Support

- **Report an issue**: support@snow-flow.dev
- **GitHub**: https://github.com/groeimetai/snow-flow
- **Main website**: https://snow-flow.dev
- **Status page**: https://status.snow-flow.dev

---

**Last Updated**: December 2025
