# 🧪 Jira Integration - End-to-End Testing Guide

**Version:** 1.0.0
**Date:** 2025-10-22
**Purpose:** Complete guide voor het testen van de Jira integratie

## 📋 Prerequisites

Wat je nodig hebt:
- ✅ Jira Cloud account (gratis trial is prima!)
- ✅ Terminal/command line access
- ✅ curl (of Postman/Insomnia)
- ✅ License server lokaal draaiend

## 🔧 Stap 1: Jira API Token Aanmaken

### 1.1 Login bij Jira
Ga naar: https://id.atlassian.com/manage-profile/security/api-tokens

### 1.2 Maak API Token
1. Klik op **"Create API token"**
2. Geef een label: `snow-flow-testing`
3. Kopieer de token (je kunt hem maar 1x zien!)
4. Bewaar deze veilig

### 1.3 Noteer Je Jira Details
```bash
# Je hebt deze info nodig:
JIRA_HOST="jouw-bedrijf.atlassian.net"
JIRA_EMAIL="jouw-email@example.com"
JIRA_API_TOKEN="xxx"  # De token die je net hebt gemaakt
```

### 1.4 Test Jira Verbinding (Optioneel)
```bash
# Verify je credentials werken
curl -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  https://$JIRA_HOST/rest/api/3/myself

# Als dit werkt zie je je Jira user info
```

## 🚀 Stap 2: License Server Starten

### 2.1 Open Terminal
```bash
cd /Users/nielsvanderwerf/snow-flow/enterprise/license-server
```

### 2.2 Install Dependencies (als nog niet gedaan)
```bash
npm install
```

### 2.3 Build TypeScript
```bash
npm run build
```

### 2.4 Start Development Server
```bash
npm run dev
```

Je zou moeten zien:
```
[2025-10-22 12:00:00] info: License Server starting...
[2025-10-22 12:00:00] info: Database initialized successfully
[2025-10-22 12:00:00] info: Admin API routes registered at /api/admin/*
[2025-10-22 12:00:00] info: MCP HTTP Server routes registered at /mcp/*
[2025-10-22 12:00:00] info: [MCP] Registered 8 Jira tools (fully implemented)
[2025-10-22 12:00:00] info: Server listening on http://localhost:3000
```

✅ **Server draait nu op http://localhost:3000**

## 🏢 Stap 3: Service Integrator & Customer Aanmaken

### 3.1 Open Nieuw Terminal Venster
Laat de server draaien in het eerste venster!

### 3.2 Maak Service Integrator
```bash
# Set admin key (voor testing, gebruik een echte key in productie!)
export ADMIN_KEY="test-admin-key-123"

# Maak Service Integrator
curl -X POST http://localhost:3000/api/admin/si \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test SI Company",
    "contactEmail": "contact@testsi.com",
    "billingEmail": "billing@testsi.com"
  }'
```

**Response:**
```json
{
  "success": true,
  "serviceIntegrator": {
    "id": 1,
    "companyName": "Test SI Company",
    "masterLicenseKey": "SNOW-SI-ABCD1234",
    "status": "active"
  }
}
```

📝 **NOTEER DE `id`** (gebruik in volgende stap)

### 3.3 Maak Test Customer
```bash
# Replace SI_ID with the id from previous step
export SI_ID=1

curl -X POST http://localhost:3000/api/admin/customers \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceIntegratorId": '$SI_ID',
    "name": "Test Customer",
    "contactEmail": "customer@test.com",
    "company": "Test Company BV"
  }'
```

**Response:**
```json
{
  "success": true,
  "customer": {
    "id": 1,
    "name": "Test Customer",
    "licenseKey": "SNOW-ENT-TEST-ABC123",
    "status": "active"
  }
}
```

📝 **NOTEER DE `licenseKey`** (gebruik voor alle MCP requests!)

### 3.4 Verify Customer
```bash
curl http://localhost:3000/api/admin/customers/$SI_ID \
  -H "X-Admin-Key: $ADMIN_KEY"
```

## 🧪 Stap 4: Test De 8 Jira Tools

### Setup: Export Credentials
```bash
# Customer license key (van stap 3.3)
export LICENSE_KEY="SNOW-ENT-TEST-ABC123"

# Jira credentials (van stap 1.3)
export JIRA_HOST="jouw-bedrijf.atlassian.net"
export JIRA_EMAIL="jouw-email@example.com"
export JIRA_API_TOKEN="xxx"
```

### Test 1: List Available Tools ✅

```bash
curl http://localhost:3000/mcp/tools/list \
  -H "Authorization: Bearer $LICENSE_KEY"
```

**Expected:** Lijst van 43 tools, waarvan 8 Jira tools

---

### Test 2: Get Jira Project 🏢

```bash
# Replace PROJ with je eigen project key
export JIRA_PROJECT="PROJ"

curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Authorization: Bearer $LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "snow_jira_get_project",
    "arguments": {
      "projectKey": "'"$JIRA_PROJECT"'"
    },
    "credentials": {
      "jira": {
        "host": "'"$JIRA_HOST"'",
        "email": "'"$JIRA_EMAIL"'",
        "apiToken": "'"$JIRA_API_TOKEN"'"
      }
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "tool": "snow_jira_get_project",
  "result": {
    "project": {
      "id": "10001",
      "key": "PROJ",
      "name": "My Project",
      "lead": { "displayName": "..." }
    },
    "issueCount": 42
  },
  "usage": {
    "durationMs": 234,
    "timestamp": 1704067200000,
    "customer": "Test Customer"
  }
}
```

✅ **Als dit werkt, werkt je Jira verbinding!**

---

### Test 3: Create Test Issue 📝

```bash
curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Authorization: Bearer $LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "snow_jira_create_issue",
    "arguments": {
      "projectKey": "'"$JIRA_PROJECT"'",
      "summary": "Test issue created by Snow-Flow Enterprise",
      "description": "This is a test issue to verify the Jira integration works!",
      "issueType": "Task",
      "priority": "Medium",
      "labels": ["snow-flow-test", "automated"]
    },
    "credentials": {
      "jira": {
        "host": "'"$JIRA_HOST"'",
        "email": "'"$JIRA_EMAIL"'",
        "apiToken": "'"$JIRA_API_TOKEN"'"
      }
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "tool": "snow_jira_create_issue",
  "result": {
    "issue": { ... },
    "key": "PROJ-123",
    "url": "https://jouw-bedrijf.atlassian.net/browse/PROJ-123"
  }
}
```

📝 **NOTEER DE `key`** (bijvoorbeeld PROJ-123) voor volgende tests!

✅ **Ga naar Jira en verify dat het issue bestaat!**

---

### Test 4: Get Issue Details 🔍

```bash
# Use the key from previous test
export TEST_ISSUE_KEY="PROJ-123"

curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Authorization: Bearer $LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "snow_jira_get_issue",
    "arguments": {
      "issueKey": "'"$TEST_ISSUE_KEY"'"
    },
    "credentials": {
      "jira": {
        "host": "'"$JIRA_HOST"'",
        "email": "'"$JIRA_EMAIL"'",
        "apiToken": "'"$JIRA_API_TOKEN"'"
      }
    }
  }'
```

**Expected:** Complete issue details + ServiceNow field mapping

---

### Test 5: Update Issue ✏️

```bash
curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Authorization: Bearer $LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "snow_jira_update_issue",
    "arguments": {
      "issueKey": "'"$TEST_ISSUE_KEY"'",
      "summary": "UPDATED: Test issue via Snow-Flow",
      "priority": "High",
      "labels": ["snow-flow-test", "automated", "updated"]
    },
    "credentials": {
      "jira": {
        "host": "'"$JIRA_HOST"'",
        "email": "'"$JIRA_EMAIL"'",
        "apiToken": "'"$JIRA_API_TOKEN"'"
      }
    }
  }'
```

✅ **Check in Jira dat summary en priority zijn geupdate!**

---

### Test 6: Transition Issue 🔄

```bash
# First, get available transitions
curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Authorization: Bearer $LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "snow_jira_transition_issue",
    "arguments": {
      "issueKey": "'"$TEST_ISSUE_KEY"'",
      "transitionIdOrName": "In Progress",
      "comment": "Snow-Flow agent started working on this issue"
    },
    "credentials": {
      "jira": {
        "host": "'"$JIRA_HOST"'",
        "email": "'"$JIRA_EMAIL"'",
        "apiToken": "'"$JIRA_API_TOKEN"'"
      }
    }
  }'
```

**Expected:**
```json
{
  "success": true,
  "result": {
    "previousStatus": "To Do",
    "newStatus": "In Progress",
    "transitioned": true
  }
}
```

✅ **Check in Jira dat status is veranderd naar "In Progress"!**

---

### Test 7: Search Issues 🔎

```bash
curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Authorization: Bearer $LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "snow_jira_search_issues",
    "arguments": {
      "jql": "project = '"$JIRA_PROJECT"' AND labels = snow-flow-test",
      "maxResults": 10
    },
    "credentials": {
      "jira": {
        "host": "'"$JIRA_HOST"'",
        "email": "'"$JIRA_EMAIL"'",
        "apiToken": "'"$JIRA_API_TOKEN"'"
      }
    }
  }'
```

**Expected:** Lijst van issues met label "snow-flow-test"

---

### Test 8: Sync Backlog 📦

```bash
curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Authorization: Bearer $LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "snow_jira_sync_backlog",
    "arguments": {
      "projectKey": "'"$JIRA_PROJECT"'",
      "status": ["To Do", "In Progress"],
      "maxResults": 20
    },
    "credentials": {
      "jira": {
        "host": "'"$JIRA_HOST"'",
        "email": "'"$JIRA_EMAIL"'",
        "apiToken": "'"$JIRA_API_TOKEN"'"
      }
    }
  }'
```

**Expected:**
```json
{
  "success": true,
  "result": {
    "syncedIssues": 5,
    "created": 5,
    "updated": 0,
    "skipped": 0,
    "errors": [],
    "issues": [
      {
        "jiraKey": "PROJ-123",
        "summary": "...",
        "status": "In Progress",
        "syncedFields": {
          "short_description": "...",
          "priority": 2,
          "state": 2,
          "u_jira_issue_key": "PROJ-123"
        }
      }
    ]
  }
}
```

✅ **Dit is de power tool - synct hele backlog in 1 call!**

---

### Test 9: Link Issues 🔗

```bash
# Create a second test issue first
curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Authorization: Bearer $LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "snow_jira_create_issue",
    "arguments": {
      "projectKey": "'"$JIRA_PROJECT"'",
      "summary": "Second test issue for linking",
      "issueType": "Task"
    },
    "credentials": {
      "jira": {
        "host": "'"$JIRA_HOST"'",
        "email": "'"$JIRA_EMAIL"'",
        "apiToken": "'"$JIRA_API_TOKEN"'"
      }
    }
  }'

# Get the key from response, then link
export SECOND_ISSUE_KEY="PROJ-124"

curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Authorization: Bearer $LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "snow_jira_link_issues",
    "arguments": {
      "inwardIssueKey": "'"$TEST_ISSUE_KEY"'",
      "outwardIssueKey": "'"$SECOND_ISSUE_KEY"'",
      "linkType": "Relates"
    },
    "credentials": {
      "jira": {
        "host": "'"$JIRA_HOST"'",
        "email": "'"$JIRA_EMAIL"'",
        "apiToken": "'"$JIRA_API_TOKEN"'"
      }
    }
  }'
```

✅ **Check in Jira dat issues gelinkt zijn!**

---

## 📊 Stap 5: Verify Usage Tracking

### 5.1 Check Customer Usage
```bash
curl http://localhost:3000/api/admin/customers/$SI_ID \
  -H "X-Admin-Key: $ADMIN_KEY"
```

**Expected:** `totalApiCalls` should be > 0

### 5.2 Get Detailed Usage Stats
```bash
# Get customer ID from previous response
export CUSTOMER_ID=1

curl http://localhost:3000/api/admin/analytics/customer/$CUSTOMER_ID \
  -H "X-Admin-Key: $ADMIN_KEY"
```

**Expected:**
```json
{
  "success": true,
  "analytics": {
    "totalCalls": 8,
    "successfulCalls": 8,
    "failedCalls": 0,
    "avgDurationMs": 523,
    "byCategory": {
      "jira": 8
    },
    "topTools": [
      { "toolName": "snow_jira_create_issue", "count": 2 },
      { "toolName": "snow_jira_get_project", "count": 1 },
      { "toolName": "snow_jira_sync_backlog", "count": 1 }
    ]
  }
}
```

✅ **Usage tracking werkt!**

---

## 🎯 Stap 6: Test Error Handling

### Test Invalid License Key
```bash
curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Authorization: Bearer INVALID-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "snow_jira_get_project",
    "arguments": { "projectKey": "PROJ" }
  }'
```

**Expected:**
```json
{
  "success": false,
  "error": "Invalid or inactive license"
}
```

### Test Invalid Jira Credentials
```bash
curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Authorization: Bearer $LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "snow_jira_get_project",
    "arguments": { "projectKey": "PROJ" },
    "credentials": {
      "jira": {
        "host": "'"$JIRA_HOST"'",
        "email": "wrong@email.com",
        "apiToken": "invalid-token"
      }
    }
  }'
```

**Expected:**
```json
{
  "success": false,
  "error": "Failed to get Jira project PROJ: ..."
}
```

### Test Missing Credentials
```bash
curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Authorization: Bearer $LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "snow_jira_get_project",
    "arguments": { "projectKey": "PROJ" }
  }'
```

**Expected:**
```json
{
  "success": false,
  "error": "Failed to get Jira project: Jira credentials are required"
}
```

✅ **Error handling werkt correct!**

---

## ✅ Success Checklist

Je hebt succesvol getest als:

- [ ] License server start zonder errors
- [ ] Service Integrator aangemaakt
- [ ] Customer aangemaakt met license key
- [ ] Jira project opgehaald
- [ ] Test issue aangemaakt in Jira
- [ ] Issue details opgehaald
- [ ] Issue geupdate (summary + priority)
- [ ] Issue ge-transitioned (status change)
- [ ] JQL search werkt
- [ ] Backlog sync werkt
- [ ] Issues gelinkt
- [ ] Usage tracking werkt
- [ ] Error handling werkt (invalid license, invalid credentials)

## 🐛 Troubleshooting

### Server start niet
```bash
# Check TypeScript compilation
npm run build

# Check for port conflicts
lsof -i :3000

# Check logs
tail -f logs/license-server.log
```

### "Jira credentials are required"
Zorg dat je `credentials.jira` object hebt in je request met:
- `host` (zonder https://)
- `email`
- `apiToken`

### "Invalid license key format"
License key moet format hebben: `SNOW-ENT-XXXX-XXXXXX`

### "Authentication failed"
- Check je Jira email is correct
- Check je API token is geldig
- Check je host is correct (zonder https://)

### "Tool not found"
Run `curl http://localhost:3000/mcp/tools/list` om te zien welke tools beschikbaar zijn.

## 🎉 Klaar!

Als alle tests slagen, heb je:
✅ Werkende Jira integration
✅ Werkende license server
✅ Werkende usage tracking
✅ Werkende error handling

**Next:** Test met een echte ServiceNow instance om de volledige agent autonomy flow te testen!

---

**Happy Testing!** 🚀
