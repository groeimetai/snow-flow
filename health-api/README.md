# Snow-Flow Health API

Real-time system health monitoring API for Snow-Flow services.

## Endpoints

- GET /health - Basic health check
- GET /api/v1/status - Current system status  
- GET /api/v1/uptime-history - 90-day uptime history
- GET /api/v1/metrics - Detailed system metrics

## Deployment

Automatically deployed via Cloud Build on push to main branch.

## Configuration

- Port: 8080 (Cloud Run standard)
- Memory: 512Mi
- CPU: 1
- Instances: 1-3 (auto-scaling)

