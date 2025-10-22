# Admin API Reference Guide

**Base URL:** `http://localhost:8080/api/admin` (development)
**Authentication:** All endpoints require `X-Admin-Key` header

## 🔐 Authentication

```bash
# All requests must include ADMIN_KEY
curl -H "X-Admin-Key: your-admin-key-here" \
  http://localhost:8080/api/admin/health
```

## 📋 Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Service Integrators** |||
| POST | `/si` | Create service integrator |
| GET | `/si` | List service integrators |
| GET | `/si/:masterKey` | Get SI details |
| **Customers** |||
| POST | `/customers` | Create customer |
| GET | `/customers` | List customers |
| GET | `/customers/:id` | Get customer details |
| PUT | `/customers/:id` | Update customer |
| GET | `/customers/:id/usage` | Get usage stats |
| GET | `/customers/:id/instances` | Get instances |
| **Analytics** |||
| GET | `/analytics/overview` | Dashboard overview |
| GET | `/analytics/tools` | Tool usage stats |
| GET | `/analytics/customers` | Customer analytics |
| **System** |||
| GET | `/health` | Health check |

## 📝 Detailed API Documentation

### Service Integrators

#### Create Service Integrator

**POST** `/api/admin/si`

Create a new service integrator (master account).

**Request Body:**
```json
{
  "companyName": "Acme ServiceNow Consulting",
  "contactEmail": "admin@acme-snow.com",
  "billingEmail": "billing@acme-snow.com"
}
```

**Response:**
```json
{
  "success": true,
  "serviceIntegrator": {
    "id": 1,
    "companyName": "Acme ServiceNow Consulting",
    "contactEmail": "admin@acme-snow.com",
    "billingEmail": "billing@acme-snow.com",
    "masterLicenseKey": "SNOW-SI-ABC12XYZ",
    "whiteLabelEnabled": false,
    "status": "active",
    "createdAt": 1704067200000
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/api/admin/si \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: your-admin-key" \
  -d '{
    "companyName": "Acme ServiceNow Consulting",
    "contactEmail": "admin@acme-snow.com",
    "billingEmail": "billing@acme-snow.com"
  }'
```

#### List Service Integrators

**GET** `/api/admin/si?status={active|suspended|churned}`

List all service integrators (optionally filtered by status).

**Response:**
```json
{
  "success": true,
  "count": 5,
  "serviceIntegrators": [
    {
      "id": 1,
      "companyName": "Acme ServiceNow Consulting",
      "masterLicenseKey": "SNOW-SI-ABC12XYZ",
      "status": "active",
      "createdAt": 1704067200000
    }
  ]
}
```

**Example:**
```bash
curl http://localhost:8080/api/admin/si?status=active \
  -H "X-Admin-Key: your-admin-key"
```

#### Get Service Integrator Details

**GET** `/api/admin/si/:masterKey`

Get detailed information about a service integrator.

**Response:**
```json
{
  "success": true,
  "serviceIntegrator": {
    "id": 1,
    "companyName": "Acme ServiceNow Consulting",
    "masterLicenseKey": "SNOW-SI-ABC12XYZ",
    "whiteLabelEnabled": false,
    "status": "active"
  },
  "stats": {
    "totalCustomers": 25,
    "activeCustomers": 23
  }
}
```

### Customers

#### Create Customer

**POST** `/api/admin/customers`

Create a new end customer for a service integrator.

**Request Body:**
```json
{
  "serviceIntegratorId": 1,
  "name": "GlobalCorp IT",
  "contactEmail": "it@globalcorp.com",
  "company": "GlobalCorp Inc."
}
```

**Response:**
```json
{
  "success": true,
  "customer": {
    "id": 1,
    "serviceIntegratorId": 1,
    "name": "GlobalCorp IT",
    "contactEmail": "it@globalcorp.com",
    "company": "GlobalCorp Inc.",
    "licenseKey": "SNOW-ENT-GLOB-ABC123",
    "status": "active",
    "createdAt": 1704067200000,
    "totalApiCalls": 0
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/api/admin/customers \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: your-admin-key" \
  -d '{
    "serviceIntegratorId": 1,
    "name": "GlobalCorp IT",
    "contactEmail": "it@globalcorp.com",
    "company": "GlobalCorp Inc."
  }'
```

#### List Customers

**GET** `/api/admin/customers?si_id={id}&status={active|suspended}`

List customers (all or filtered by service integrator and/or status).

**Response:**
```json
{
  "success": true,
  "count": 25,
  "customers": [
    {
      "id": 1,
      "name": "GlobalCorp IT",
      "licenseKey": "SNOW-ENT-GLOB-ABC123",
      "status": "active",
      "totalApiCalls": 15234
    }
  ]
}
```

**Examples:**
```bash
# All customers
curl http://localhost:8080/api/admin/customers \
  -H "X-Admin-Key: your-admin-key"

# Customers for specific SI
curl "http://localhost:8080/api/admin/customers?si_id=1" \
  -H "X-Admin-Key: your-admin-key"

# Active customers only
curl "http://localhost:8080/api/admin/customers?status=active" \
  -H "X-Admin-Key: your-admin-key"
```

#### Get Customer Details

**GET** `/api/admin/customers/:id`

Get detailed customer information including instances and usage stats.

**Response:**
```json
{
  "success": true,
  "customer": {
    "id": 1,
    "name": "GlobalCorp IT",
    "licenseKey": "SNOW-ENT-GLOB-ABC123",
    "status": "active",
    "totalApiCalls": 15234
  },
  "instances": 3,
  "instanceDetails": [
    {
      "id": 1,
      "instanceId": "abc123def456",
      "instanceName": "Production",
      "hostname": "snow-prod.globalcorp.com",
      "ipAddress": "192.168.1.100",
      "lastSeen": 1704067200000,
      "version": "8.2.0"
    }
  ],
  "usage": {
    "totalCalls": 5432,
    "successfulCalls": 5420,
    "failedCalls": 12,
    "avgDurationMs": 234,
    "byCategory": {
      "jira": 3421,
      "azdo": 1200,
      "confluence": 811
    },
    "topTools": [
      { "toolName": "snow_jira_sync_backlog", "count": 1234 },
      { "toolName": "snow_azdo_sync_work_items", "count": 987 }
    ]
  }
}
```

#### Update Customer

**PUT** `/api/admin/customers/:id`

Update customer information.

**Request Body:**
```json
{
  "name": "GlobalCorp IT Department",
  "contactEmail": "newit@globalcorp.com",
  "status": "active"
}
```

**Response:**
```json
{
  "success": true,
  "customer": {
    "id": 1,
    "name": "GlobalCorp IT Department",
    "contactEmail": "newit@globalcorp.com",
    "status": "active"
  }
}
```

#### Get Customer Usage

**GET** `/api/admin/customers/:id/usage?days=30`

Get detailed usage statistics for a customer.

**Response:**
```json
{
  "success": true,
  "customerId": 1,
  "period": "30 days",
  "stats": {
    "totalCalls": 5432,
    "successfulCalls": 5420,
    "failedCalls": 12,
    "avgDurationMs": 234,
    "byCategory": {
      "jira": 3421,
      "azdo": 1200
    },
    "topTools": [
      { "toolName": "snow_jira_sync_backlog", "count": 1234 }
    ]
  },
  "timeseries": [
    { "timestamp": 1704067200000, "count": 234 },
    { "timestamp": 1704153600000, "count": 189 }
  ]
}
```

#### Get Customer Instances

**GET** `/api/admin/customers/:id/instances`

List all instances for a customer.

**Response:**
```json
{
  "success": true,
  "customerId": 1,
  "count": 3,
  "instances": [
    {
      "id": 1,
      "instanceId": "abc123",
      "instanceName": "Production",
      "hostname": "snow-prod.globalcorp.com",
      "lastSeen": 1704067200000,
      "version": "8.2.0",
      "validationCount": 1543
    }
  ]
}
```

### Analytics

#### Dashboard Overview

**GET** `/api/admin/analytics/overview`

Get high-level metrics for the admin dashboard.

**Response:**
```json
{
  "success": true,
  "overview": {
    "totalServiceIntegrators": 10,
    "activeServiceIntegrators": 9,
    "totalCustomers": 125,
    "activeCustomers": 118,
    "totalInstances": 342,
    "totalApiCalls": 1543234,
    "apiStats": {
      "totalRequests": 45321,
      "avgDurationMs": 234,
      "errorRate": "0.12%"
    }
  }
}
```

**Example:**
```bash
curl http://localhost:8080/api/admin/analytics/overview \
  -H "X-Admin-Key: your-admin-key"
```

#### Tool Usage Analytics

**GET** `/api/admin/analytics/tools?days=30`

Get tool usage statistics across all customers.

**Response:**
```json
{
  "success": true,
  "period": "30 days",
  "toolUsage": [
    { "toolName": "snow_jira_sync_backlog", "count": 15432 },
    { "toolName": "snow_azdo_sync_work_items", "count": 12345 },
    { "toolName": "snow_ml_predict_priority", "count": 9876 }
  ],
  "categoryUsage": {
    "jira": 45321,
    "azdo": 32145,
    "confluence": 23456,
    "ml": 15678
  }
}
```

#### Customer Analytics

**GET** `/api/admin/analytics/customers?days=30`

Get usage analytics per customer.

**Response:**
```json
{
  "success": true,
  "period": "30 days",
  "customers": [
    {
      "customerId": 1,
      "customerName": "GlobalCorp IT",
      "licenseKey": "SNOW-ENT-GLOB-ABC123",
      "totalApiCalls": 15234,
      "recentCalls": 5432,
      "successRate": "99.78%",
      "avgDurationMs": 234,
      "topTools": [
        { "toolName": "snow_jira_sync_backlog", "count": 1234 }
      ]
    }
  ]
}
```

### System

#### Health Check

**GET** `/api/admin/health`

Check system health and statistics.

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": 1704067200000,
  "stats": {
    "requestsLast24h": 45321,
    "avgResponseTime": "234ms",
    "errorRate": "0.12%"
  }
}
```

## 🧪 Testing with curl

### Complete Workflow Example

```bash
# 1. Create Service Integrator
SI_RESPONSE=$(curl -X POST http://localhost:8080/api/admin/si \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: test-admin-key-123" \
  -d '{
    "companyName": "Test SI",
    "contactEmail": "admin@testsi.com",
    "billingEmail": "billing@testsi.com"
  }')

echo "Service Integrator created: $SI_RESPONSE"
SI_ID=$(echo $SI_RESPONSE | jq -r '.serviceIntegrator.id')

# 2. Create Customer
CUST_RESPONSE=$(curl -X POST http://localhost:8080/api/admin/customers \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: test-admin-key-123" \
  -d "{
    \"serviceIntegratorId\": $SI_ID,
    \"name\": \"Test Customer\",
    \"contactEmail\": \"it@testcustomer.com\",
    \"company\": \"Test Corp\"
  }")

echo "Customer created: $CUST_RESPONSE"
CUST_ID=$(echo $CUST_RESPONSE | jq -r '.customer.id')
LICENSE_KEY=$(echo $CUST_RESPONSE | jq -r '.customer.licenseKey')

echo "License Key: $LICENSE_KEY"

# 3. Get Customer Details
curl http://localhost:8080/api/admin/customers/$CUST_ID \
  -H "X-Admin-Key: test-admin-key-123" | jq

# 4. Get Analytics Overview
curl http://localhost:8080/api/admin/analytics/overview \
  -H "X-Admin-Key: test-admin-key-123" | jq
```

## 📊 Response Formats

### Success Response
```json
{
  "success": true,
  "data": { /* response data */ }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message here"
}
```

## 🔒 Security Notes

- All endpoints require `X-Admin-Key` header
- Failed authentication returns 401 Unauthorized
- All requests are logged to `api_logs` table
- Rate limiting: 100 requests per 15 minutes per IP

## 📈 Next Steps

After implementing Admin API:
1. ✅ Create React Admin UI to consume these endpoints
2. ✅ Add MCP HTTP endpoints for remote tool execution
3. ✅ Deploy to Cloud Run
4. ✅ Setup monitoring and alerts

---

**Total Endpoints:** 13
**Authentication:** Required (ADMIN_KEY)
**Rate Limit:** 100/15min
