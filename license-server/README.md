# Snow-Flow License Server

License validation server for Snow-Flow Enterprise features.

## Overview

This server handles license validation requests from Snow-Flow Enterprise installations. It provides:

- **License validation** with HMAC signature verification
- **Instance tracking** to enforce concurrent installation limits
- **Expiration management** with automatic license expiry
- **Usage analytics** for monitoring license usage
- **Rate limiting** to prevent abuse
- **Security hardening** with Helmet.js and CORS

## Architecture

### Components

1. **Express API Server** - REST endpoints for license validation
2. **SQLite Database** - Fast, reliable license storage with WAL mode
3. **Validation Service** - License validation logic with security checks
4. **Database Layer** - Type-safe database operations

### Security Features

- **HMAC Signature Verification** - All requests must include valid HMAC signature
- **Timestamp Validation** - Prevents replay attacks (5-minute window)
- **Rate Limiting** - 100 requests per 15 minutes per IP
- **Helmet.js** - Security headers and protections
- **Admin Authentication** - Stats endpoint requires admin key

## Installation

```bash
# Install dependencies
npm install

# Initialize database
npm run db:init

# Seed test licenses (development only)
npm run db:seed

# Configure environment
cp .env.example .env
# Edit .env with your settings
```

## Configuration

Create `.env` file with the following variables:

```env
# Server
NODE_ENV=production
PORT=3000

# Database
DB_PATH=./data/licenses.db

# Security
ADMIN_KEY=your-secure-admin-key-here
CORS_ORIGIN=https://yourdomain.com

# Logging
LOG_LEVEL=info
```

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
# Build TypeScript
npm run build

# Start server
npm start
```

### Docker Deployment

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY .env .env

EXPOSE 3000

CMD ["npm", "start"]
```

## API Endpoints

### POST /validate

Validate a license key.

**Request:**
```json
{
  "key": "SNOW-ENT-XXXXX",
  "version": "8.2.0",
  "instanceId": "abc123...",
  "timestamp": 1704067200000,
  "signature": "hmac_signature_here"
}
```

**Success Response (200):**
```json
{
  "valid": true,
  "tier": "Enterprise",
  "features": ["jira", "advanced-ml", "*"],
  "expiresAt": 1735689600000,
  "maxInstances": 999,
  "currentInstances": 5,
  "warnings": ["License expires in 25 days"]
}
```

**Error Response (400):**
```json
{
  "valid": false,
  "error": "License has expired"
}
```

### GET /stats/:key

Get license statistics (admin only).

**Headers:**
```
X-Admin-Key: your-admin-key
```

**Response:**
```json
{
  "license": {
    "key": "SNOW-ENT-XXXXX",
    "tier": "Enterprise",
    "status": "active",
    "companyName": "Acme Corp",
    "maxInstances": 999,
    "expiresAt": 1735689600000
  },
  "instances": 5,
  "validations": {
    "total": 1523,
    "successful": 1520,
    "failed": 3
  }
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1704067200000,
  "uptime": 86400.5
}
```

## Database Schema

### licenses
- `id` - Primary key
- `key` - Unique license key
- `tier` - License tier (Team, Professional, Enterprise)
- `status` - Status (active, expired, suspended, invalid)
- `company_name` - Customer company name
- `contact_email` - Contact email
- `max_instances` - Maximum concurrent installations
- `features` - JSON array of enabled features
- `expires_at` - Expiration timestamp
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

### license_instances
- `id` - Primary key
- `license_id` - Foreign key to licenses
- `instance_id` - Unique installation identifier
- `version` - Snow-Flow version
- `last_seen` - Last validation timestamp
- `ip_address` - Client IP address
- `hostname` - Client hostname
- `validation_count` - Total validation requests
- `created_at` - First seen timestamp

### validation_logs
- `id` - Primary key
- `license_id` - Foreign key to licenses
- `instance_id` - Installation identifier
- `version` - Snow-Flow version
- `success` - Validation success/failure
- `error_code` - Error code if failed
- `ip_address` - Client IP address
- `timestamp` - Log timestamp

## License Management

### Creating Licenses

Use the database interface directly or create an admin CLI:

```typescript
import { LicenseDatabase } from './database/schema.js';

const db = new LicenseDatabase();

db.createLicense({
  key: 'SNOW-ENT-CUSTOM',
  tier: 'Enterprise',
  status: 'active',
  companyName: 'Acme Corp',
  contactEmail: 'admin@acme.com',
  maxInstances: 50,
  features: JSON.stringify(['jira', 'advanced-ml', 'priority-support']),
  expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year
});
```

### Updating Licenses

```typescript
db.updateLicense('SNOW-ENT-CUSTOM', {
  maxInstances: 100,
  expiresAt: Date.now() + 2 * 365 * 24 * 60 * 60 * 1000 // 2 years
});
```

### Suspending Licenses

```typescript
db.updateLicense('SNOW-ENT-CUSTOM', {
  status: 'suspended'
});
```

## Monitoring

### Logs

Server logs include:
- All validation requests (success/failure)
- Error details
- Performance metrics
- Security events

Logs are written to:
- Console (colorized)
- `license-server.log` (JSON format)

### Metrics

Use the `/stats/:key` endpoint with admin key to get:
- Current instance count
- Validation statistics (30-day window)
- License details

## Production Deployment

### Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate secure `ADMIN_KEY`
- [ ] Configure proper `CORS_ORIGIN`
- [ ] Set up database backups
- [ ] Configure log rotation
- [ ] Set up monitoring/alerting
- [ ] Use reverse proxy (nginx/Apache)
- [ ] Enable HTTPS/TLS
- [ ] Configure firewall rules
- [ ] Set up automated backups

### Recommended Setup

```bash
# Use PM2 for process management
npm install -g pm2

# Start with PM2
pm2 start dist/index.js --name license-server

# Configure startup script
pm2 startup
pm2 save

# Monitor
pm2 monit
```

### Backup Strategy

```bash
# Backup database daily
0 0 * * * cp /path/to/licenses.db /backup/licenses-$(date +\%Y\%m\%d).db

# Retain 30 days of backups
find /backup -name "licenses-*.db" -mtime +30 -delete
```

## Troubleshooting

### Database locked error
- Check if multiple processes are accessing database
- Ensure WAL mode is enabled
- Check file permissions

### High CPU usage
- Review rate limit settings
- Check for database index usage
- Monitor query performance

### Validation failures
- Verify HMAC signatures match
- Check timestamp synchronization
- Review error codes in logs

## Support

For issues with the license server:
1. Check server logs
2. Verify database integrity
3. Review configuration
4. Contact Snow-Flow support with log files

## License

Commercial - See LICENSE-COMMERCIAL.md
