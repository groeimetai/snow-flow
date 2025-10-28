# Snow-Flow Status Page

**Live URL**: https://status.snow-flow.dev (after deployment)

Real-time status and uptime monitoring for Snow-Flow Enterprise services.

## Features

- ✅ Real-time service status monitoring
- ✅ 90-day uptime history visualization
- ✅ Incident tracking and history
- ✅ 99.9% SLA tracking
- ✅ Responsive design (mobile-friendly)
- ✅ Auto-refresh every 30 seconds

## Services Monitored

1. **MCP Server** - Snow-Flow Enterprise MCP Server (europe-west4)
2. **Enterprise Portal** - Customer portal and dashboard
3. **Website** - Main website (snow-flow.dev)
4. **Database** - PostgreSQL database cluster

## Deployment

### Prerequisites

- Google Cloud Project: `snow-flow-ai`
- Artifact Registry repository: `cloud-run-source-deploy`
- Cloud Build API enabled
- Cloud Run API enabled

### Automatic Deployment (via Cloud Build Trigger)

This status page is automatically deployed when changes are pushed to the `main` branch in the `status-page/` directory.

**Cloud Build Trigger Setup**:

```bash
gcloud builds triggers create github \
  --name="snow-flow-status-page-deploy" \
  --repo-name="snow-flow" \
  --repo-owner="groeimetai" \
  --branch-pattern="^main$" \
  --build-config="status-page/cloudbuild.yaml" \
  --included-files="status-page/**" \
  --region="europe-west4" \
  --description="Deploy status page to Cloud Run"
```

### Manual Deployment

```bash
# From the status-page directory
cd status-page

# Submit build to Cloud Build
gcloud builds submit --config cloudbuild.yaml --project=snow-flow-ai

# Or deploy directly with Cloud Run
gcloud run deploy snow-flow-status-page \
  --source . \
  --region europe-west4 \
  --platform managed \
  --allow-unauthenticated \
  --port 80 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 5
```

### Custom Domain Setup

1. Map custom domain in Cloud Run:
```bash
gcloud run domain-mappings create \
  --service snow-flow-status-page \
  --domain status.snow-flow.dev \
  --region europe-west4
```

2. Add DNS records (provided by Cloud Run)

## Architecture

```
┌─────────────────────────────────────────────────┐
│           User's Browser                        │
└──────────────────┬──────────────────────────────┘
                   │ HTTPS
                   ▼
┌─────────────────────────────────────────────────┐
│    Cloud Run: snow-flow-status-page             │
│    (nginx serving static HTML)                  │
│                                                  │
│  - index.html                                   │
│  - Auto-refresh every 30s                       │
│  - /health endpoint                             │
│  - /api/status endpoint (placeholder)           │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│    Future: Backend API for real-time data      │
│    (Google Cloud Monitoring API)                │
└─────────────────────────────────────────────────┘
```

## Technology Stack

- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript
- **Web Server**: nginx:alpine
- **Container**: Docker
- **Hosting**: Google Cloud Run (europe-west4)
- **Build**: Cloud Build
- **Registry**: Artifact Registry

## Configuration

### Environment Variables

Currently, the status page is static and doesn't require environment variables. Future API integration will use:

- `API_ENDPOINT` - Backend API endpoint for real-time status data
- `REFRESH_INTERVAL` - Auto-refresh interval in milliseconds (default: 30000)

### Monitoring Integration

The status page currently displays simulated data. To integrate with real Google Cloud Monitoring:

1. Create backend API service
2. Fetch metrics from Cloud Monitoring API
3. Update `/api/status` endpoint in nginx.conf to proxy to backend
4. Update JavaScript to fetch from `/api/status`

**Example API Response Structure**:

```json
{
  "overall_status": "operational",
  "uptime_30d": 99.97,
  "avg_latency": 245,
  "active_incidents": 0,
  "services": {
    "mcp_server": {
      "status": "operational",
      "latency": 180
    },
    "portal": {
      "status": "operational",
      "latency": 320
    },
    "website": {
      "status": "operational",
      "latency": 150
    },
    "database": {
      "status": "operational",
      "connections": 12
    }
  },
  "uptime_history": [
    {
      "date": "2025-10-28",
      "uptime_percent": 100,
      "status": "operational"
    }
  ],
  "incidents": [
    {
      "id": "incident-123",
      "title": "Brief outage",
      "status": "resolved",
      "severity": "warning",
      "started_at": "2025-10-15T10:30:00Z",
      "resolved_at": "2025-10-15T10:45:00Z",
      "description": "MCP server experienced brief connectivity issue"
    }
  ]
}
```

## Development

### Local Testing

```bash
# Build Docker image
docker build -t status-page .

# Run locally
docker run -p 8080:80 status-page

# Open http://localhost:8080
```

### File Structure

```
status-page/
├── index.html          # Main status page HTML
├── nginx.conf          # nginx web server configuration
├── Dockerfile          # Docker container definition
├── cloudbuild.yaml     # Cloud Build deployment configuration
├── .dockerignore       # Files to exclude from Docker build
└── README.md           # This file
```

## Maintenance

### Updating Status Manually

For emergency maintenance notifications, update the `index.html` directly and deploy.

### Incident Management

Currently, incidents are displayed statically. Future integration with backend API will allow dynamic incident management.

## Monitoring the Status Page

The status page itself is monitored by Google Cloud Monitoring:

- Uptime checks every 5 minutes
- Alert if status page is unreachable
- Monitor response time (should be < 500ms)

## Cost Estimate

**Cloud Run Costs** (very low traffic):
- 1 minimum instance × 512Mi × $0.000024/hour = ~$0.18/month
- Requests: Free tier covers status page traffic
- **Total**: < $1/month

## Support

- **Report an issue**: support@snow-flow.dev
- **Documentation**: https://github.com/groeimetai/snow-flow
- **Main website**: https://snow-flow.dev

---

**Last Updated**: October 28, 2025
