# Cloud SQL Integration Plan voor Health API

## 🎯 Doel

De Health API integreren met jullie bestaande Cloud SQL database (`snow-flow-production-db`) voor persistente opslag van monitoring data.

## 📊 Huidige Situatie

**Cloud SQL Instance:**
- Naam: `snow-flow-production-db`
- Database: MySQL 8.4
- Regio: europe-west4 (zelfde als Health API ✅)
- Connection: `snow-flow-ai:europe-west4:snow-flow-production-db`
- IP: `34.12.192.75`

**Health API:**
- Service: `snow-flow-health-api` (Cloud Run)
- Regio: europe-west4
- Huidige opslag: In-memory (gaat verloren bij restart)

## 🗄️ Database Schema Ontwerp

### Tabel: `health_metrics`
Real-time system metrics opslag:

```sql
CREATE TABLE health_metrics (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  cpu_usage DECIMAL(5,2) NOT NULL COMMENT 'CPU usage percentage (0-100)',
  memory_usage DECIMAL(5,2) NOT NULL COMMENT 'Memory usage percentage (0-100)',
  disk_usage DECIMAL(5,2) NOT NULL COMMENT 'Disk usage percentage (0-100)',
  uptime_seconds BIGINT UNSIGNED NOT NULL COMMENT 'System uptime in seconds',

  INDEX idx_timestamp (timestamp DESC),
  INDEX idx_cpu_usage (cpu_usage),
  INDEX idx_memory_usage (memory_usage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Real-time system health metrics';
```

### Tabel: `service_status`
Status van individuele services:

```sql
CREATE TABLE service_status (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  service_name VARCHAR(50) NOT NULL COMMENT 'Service identifier (mcp_server, portal, website, database)',
  status ENUM('operational', 'degraded', 'outage') NOT NULL,
  latency_ms INT UNSIGNED NULL COMMENT 'Response latency in milliseconds',
  error_message TEXT NULL COMMENT 'Error details if status is not operational',

  INDEX idx_timestamp_service (timestamp DESC, service_name),
  INDEX idx_service_status (service_name, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Individual service health status tracking';
```

### Tabel: `incidents`
Incident tracking en resolution:

```sql
CREATE TABLE incidents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  incident_id VARCHAR(36) UNIQUE NOT NULL COMMENT 'UUID for incident',
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  severity ENUM('critical', 'major', 'minor') NOT NULL,
  status ENUM('investigating', 'identified', 'monitoring', 'resolved') NOT NULL DEFAULT 'investigating',
  affected_services JSON NOT NULL COMMENT 'Array of affected service names',

  started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at DATETIME(3) NULL,
  duration_seconds INT UNSIGNED GENERATED ALWAYS AS (TIMESTAMPDIFF(SECOND, started_at, resolved_at)) STORED,

  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  INDEX idx_status (status),
  INDEX idx_started_at (started_at DESC),
  INDEX idx_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='System incidents and outages tracking';
```

### Tabel: `uptime_history`
Dagelijkse uptime aggregatie:

```sql
CREATE TABLE uptime_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL UNIQUE COMMENT 'Date of uptime record',
  uptime_percentage DECIMAL(5,2) NOT NULL COMMENT 'Daily uptime percentage (0-100)',
  total_downtime_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  incident_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,

  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  INDEX idx_date (date DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Daily uptime percentage aggregation';
```

## 🔧 Implementatie Stappen

### Stap 1: Database Setup

Maak een dedicated database voor health monitoring:

```bash
# Create database
gcloud sql databases create health_monitoring \
  --instance=snow-flow-production-db

# Create dedicated user (veiliger dan root)
gcloud sql users create health_api_user \
  --instance=snow-flow-production-db \
  --password='[STRONG_PASSWORD_HERE]'

# Grant permissions
# (Moet via SQL client - zie SQL commands hieronder)
```

SQL commands voor permissions:

```sql
-- Connect als root en voer uit:
GRANT SELECT, INSERT, UPDATE, DELETE ON health_monitoring.* TO 'health_api_user'@'%';
FLUSH PRIVILEGES;
```

### Stap 2: Cloud Run → Cloud SQL Connectie

Cloud Run heeft speciale configuratie nodig voor Cloud SQL:

```bash
# Update Cloud Run service met Cloud SQL connection
gcloud run services update snow-flow-health-api \
  --region=europe-west4 \
  --add-cloudsql-instances=snow-flow-ai:europe-west4:snow-flow-production-db \
  --set-env-vars="DB_HOST=/cloudsql/snow-flow-ai:europe-west4:snow-flow-production-db,DB_USER=health_api_user,DB_NAME=health_monitoring"
```

**Belangrijk:** Database password moet veilig opgeslagen worden via Secret Manager:

```bash
# Store password in Secret Manager
echo -n "YOUR_DB_PASSWORD" | gcloud secrets create health-api-db-password \
  --data-file=- \
  --replication-policy="automatic"

# Grant Cloud Run service account access
gcloud secrets add-iam-policy-binding health-api-db-password \
  --member="serviceAccount:761141808583-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Update Cloud Run to mount secret as env var
gcloud run services update snow-flow-health-api \
  --region=europe-west4 \
  --update-secrets=DB_PASSWORD=health-api-db-password:latest
```

### Stap 3: Code Implementatie

Installeer MySQL2 dependency:

```bash
npm install mysql2
```

Update `src/api/simple-health-api.ts`:

```typescript
import mysql from 'mysql2/promise';

// Database connection configuration
const dbConfig = {
  socketPath: process.env.DB_HOST, // Unix socket voor Cloud SQL
  user: process.env.DB_USER || 'health_api_user',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'health_monitoring',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
let db: mysql.Pool | null = null;

async function initDatabase() {
  try {
    db = mysql.createPool(dbConfig);

    // Test connection
    const connection = await db.getConnection();
    console.log('✅ Connected to Cloud SQL database');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    // Fallback to in-memory if DB unavailable
    db = null;
  }
}

// Save metrics to database
async function saveMetrics(metrics: HealthMetrics) {
  if (!db) return; // Skip if DB not available

  try {
    await db.execute(
      `INSERT INTO health_metrics (cpu_usage, memory_usage, disk_usage, uptime_seconds)
       VALUES (?, ?, ?, ?)`,
      [metrics.cpuUsage, metrics.memoryUsage, metrics.diskUsage, metrics.uptimeSeconds]
    );
  } catch (error) {
    console.error('Error saving metrics:', error);
  }
}

// Get uptime history from database
async function getUptimeHistory(days: number = 90): Promise<UptimeDay[]> {
  if (!db) {
    // Fallback to in-memory generated data
    return generateMockUptimeHistory(days);
  }

  try {
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT date, uptime_percentage, incident_count
       FROM uptime_history
       WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       ORDER BY date DESC`,
      [days]
    );

    return rows.map(row => ({
      date: row.date,
      uptime: row.uptime_percentage,
      incidents: row.incident_count
    }));
  } catch (error) {
    console.error('Error fetching uptime history:', error);
    return [];
  }
}

// Initialize database on startup
initDatabase();
```

### Stap 4: Database Migrations

Create `health-api/migrations/001_initial_schema.sql`:

```sql
-- Migration: Initial Health Monitoring Schema
-- Run with: gcloud sql connect snow-flow-production-db --user=root --database=health_monitoring

USE health_monitoring;

-- health_metrics table
CREATE TABLE IF NOT EXISTS health_metrics (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  cpu_usage DECIMAL(5,2) NOT NULL,
  memory_usage DECIMAL(5,2) NOT NULL,
  disk_usage DECIMAL(5,2) NOT NULL,
  uptime_seconds BIGINT UNSIGNED NOT NULL,
  INDEX idx_timestamp (timestamp DESC)
) ENGINE=InnoDB;

-- service_status table
CREATE TABLE IF NOT EXISTS service_status (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  service_name VARCHAR(50) NOT NULL,
  status ENUM('operational', 'degraded', 'outage') NOT NULL,
  latency_ms INT UNSIGNED NULL,
  error_message TEXT NULL,
  INDEX idx_timestamp_service (timestamp DESC, service_name)
) ENGINE=InnoDB;

-- incidents table
CREATE TABLE IF NOT EXISTS incidents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  incident_id VARCHAR(36) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  severity ENUM('critical', 'major', 'minor') NOT NULL,
  status ENUM('investigating', 'identified', 'monitoring', 'resolved') NOT NULL DEFAULT 'investigating',
  affected_services JSON NOT NULL,
  started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_status (status),
  INDEX idx_started_at (started_at DESC)
) ENGINE=InnoDB;

-- uptime_history table
CREATE TABLE IF NOT EXISTS uptime_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  uptime_percentage DECIMAL(5,2) NOT NULL,
  total_downtime_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  incident_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_date (date DESC)
) ENGINE=InnoDB;
```

### Stap 5: Automated Data Aggregation

Creëer een cron job (Cloud Scheduler) voor dagelijkse uptime aggregatie:

```bash
# Create Cloud Scheduler job
gcloud scheduler jobs create http daily-uptime-aggregation \
  --schedule="0 0 * * *" \
  --uri="https://snow-flow-health-api-2e7rlcc77q-ez.a.run.app/internal/aggregate-uptime" \
  --http-method=POST \
  --oidc-service-account-email=761141808583-compute@developer.gserviceaccount.com \
  --location=europe-west4
```

Implementeer `/internal/aggregate-uptime` endpoint in Health API:

```typescript
app.post('/internal/aggregate-uptime', async (req: Request, res: Response) => {
  if (!db) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  try {
    // Calculate yesterday's uptime
    const [result] = await db.execute(`
      INSERT INTO uptime_history (date, uptime_percentage, total_downtime_seconds, incident_count)
      SELECT
        DATE_SUB(CURDATE(), INTERVAL 1 DAY) as date,
        (1 - (SUM(CASE WHEN status != 'operational' THEN 1 ELSE 0 END) / COUNT(*))) * 100 as uptime_percentage,
        SUM(CASE WHEN status != 'operational' THEN 60 ELSE 0 END) as total_downtime_seconds,
        COUNT(DISTINCT CASE WHEN status = 'outage' THEN service_name END) as incident_count
      FROM service_status
      WHERE DATE(timestamp) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      ON DUPLICATE KEY UPDATE
        uptime_percentage = VALUES(uptime_percentage),
        total_downtime_seconds = VALUES(total_downtime_seconds),
        incident_count = VALUES(incident_count)
    `);

    res.json({ success: true, message: 'Uptime aggregation completed' });
  } catch (error) {
    console.error('Aggregation error:', error);
    res.status(500).json({ error: 'Aggregation failed' });
  }
});
```

## 🔒 Security Best Practices

1. **Nooit plaintext passwords in code of git!**
   - Gebruik altijd Secret Manager
   - Roteer passwords regelmatig

2. **Gebruik dedicated database user**
   - Niet de root user
   - Minimale permissions (alleen wat nodig is)

3. **Cloud SQL Auth Proxy voor development**
   ```bash
   cloud_sql_proxy -instances=snow-flow-ai:europe-west4:snow-flow-production-db=tcp:3306
   ```

4. **Connection pooling limits**
   - Cloud SQL heeft max connections limit
   - Health API gebruikt connection pool (max 10)

## 📊 Monitoring & Alerting

Monitor database performance:

```bash
# Database metrics
gcloud sql operations list \
  --instance=snow-flow-production-db \
  --limit=10

# Monitor connections
# Via Cloud Console: https://console.cloud.google.com/sql/instances/snow-flow-production-db/monitoring?project=snow-flow-ai
```

## 💰 Kosten Inschatting

**Cloud SQL (bestaande instance - shared cost):**
- Instance al draaiend voor enterprise
- Extra storage: ~1-5 GB/jaar voor health metrics (~€0.17/GB/maand)
- Extra CPU/memory gebruik: verwaarloosbaar (<1%)

**Estimated additional cost: €1-5/maand**

## ✅ Voordelen van Cloud SQL Integratie

1. **Persistente Data** - Geen verlies bij Health API restarts
2. **Historical Analytics** - Trend analysis over maanden/jaren
3. **SLA Reporting** - Exacte uptime berekeningen
4. **Incident Tracking** - Complete incident history
5. **Shared Infrastructure** - Gebruik bestaande enterprise database
6. **Backup & Recovery** - Automatische Cloud SQL backups
7. **Scalability** - Grow met enterprise data

## 🚀 Volgende Stappen

1. Database schema aanmaken (migrations runnen)
2. Secret Manager configureren voor DB password
3. Cloud Run service updaten met Cloud SQL connection
4. Health API code updaten (mysql2 integration)
5. Cloud Scheduler job creëren voor aggregation
6. Testen en monitoren

Wil je dat ik dit ga implementeren?
