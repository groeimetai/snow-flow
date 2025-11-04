# Database Migration Guide

## Problem

The `/api/service-integrator/themes` endpoint returns a 500 error because the `service_integrator_themes` table doesn't exist yet.

## Solution

Run the database migrations to create the required tables.

## Option 1: Cloud SQL Proxy (Recommended)

If you're using Google Cloud SQL:

```bash
# 1. Start Cloud SQL Proxy
cloud-sql-proxy --port 3307 snow-flow-ai:europe-west4:snow-flow-production-db

# 2. In another terminal, run migrations via mysql client
cd /Users/nielsvanderwerf/snow-flow-enterprise/portal/backend
mysql -h 127.0.0.1 -P 3307 -u snow-flow -p licenses < migrations/002_add_custom_themes.sql

# Enter your database password when prompted
```

## Option 2: Direct MySQL Connection

If you have direct access to the database:

```bash
cd /Users/nielsvanderwerf/snow-flow-enterprise/portal/backend

# Connect to your MySQL database
mysql -h YOUR_DB_HOST -u snow-flow -p licenses < migrations/002_add_custom_themes.sql
```

## Option 3: Google Cloud Console

1. Go to [Cloud SQL Instances](https://console.cloud.google.com/sql/instances)
2. Click on your instance: `snow-flow-production-db`
3. Click "OPEN CLOUD SHELL"
4. Run:
   ```bash
   gcloud sql connect snow-flow-production-db --user=snow-flow --database=licenses
   ```
5. Paste the contents of `migrations/002_add_custom_themes.sql`

## Option 4: Run via Application

Set environment variables and run the migration script:

```bash
cd /Users/nielsvanderwerf/snow-flow-enterprise/portal/backend

# Set environment variables
export NODE_ENV=production
export USE_CLOUD_SQL=true
export INSTANCE_CONNECTION_NAME=snow-flow-ai:europe-west4:snow-flow-production-db
export DB_USER=snow-flow
export DB_NAME=licenses
export DB_PASSWORD=your-db-password

# Run migrations
npm run db:migrate
```

## Verify

After running the migration, verify the table was created:

```sql
SHOW TABLES LIKE 'service_integrator_themes';

DESC service_integrator_themes;
```

## All Available Migrations

The migrations should be run in order:

1. `001_add_customer_credentials.sql` - Customer credential storage
2. `002_add_custom_themes.sql` - ⚠️ **Required for themes feature**
3. `003_add_seat_tracking_to_customers.sql` - Seat tracking
4. `004_create_active_connections_table.sql` - Active connections
5. `005_create_connection_events_table.sql` - Connection events
6. `006_create_users_table.sql` - User management

## Troubleshooting

### "Table already exists" error
This is safe to ignore. The migration uses `CREATE TABLE IF NOT EXISTS`.

### Connection refused
- Make sure your database is running
- Check firewall rules allow connections
- Verify credentials are correct

### Permission denied
Make sure your database user has the following privileges:
```sql
GRANT CREATE, ALTER, INSERT, UPDATE, SELECT ON licenses.* TO 'snow-flow'@'%';
```
