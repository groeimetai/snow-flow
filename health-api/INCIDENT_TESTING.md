# Incident Management Testing Guide

## 🎯 Doel

Test hoe de status dashboard reageert op incidents: creation, updates, en resolution.

## 🔴 Test Scenario 1: Critical Incident (Website Outage)

### Stap 1: Check huidige status
```bash
curl https://snow-flow-health-api-2e7rlcc77q-ez.a.run.app/api/v1/status | jq '{overall_status, uptime_30d, active_incidents}'
```

**Verwacht resultaat:**
```json
{
  "overall_status": "operational",
  "uptime_30d": 100,
  "active_incidents": 0
}
```

### Stap 2: Creëer een CRITICAL incident
```bash
curl -X POST https://snow-flow-health-api-2e7rlcc77q-ez.a.run.app/api/v1/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Website Down - Database Connection Lost",
    "description": "Main website cannot connect to database. Users receiving 500 errors.",
    "severity": "critical",
    "affectedServices": ["website", "database"]
  }' | jq .
```

**Verwacht resultaat:**
- `success: true`
- Incident ID wordt teruggegeven (bijv. `INC-1730640000000`)
- Status: `investigating`

### Stap 3: Check status na incident
```bash
curl https://snow-flow-health-api-2e7rlcc77q-ez.a.run.app/api/v1/status | jq '{overall_status, uptime_30d, active_incidents}'
```

**Verwacht resultaat:**
```json
{
  "overall_status": "outage",  // Changed!
  "uptime_30d": [iets lager],   // Slightly decreased
  "active_incidents": 1         // Increased!
}
```

### Stap 4: Open de status page
```
https://snow-flow-status-page-761141808583.europe-west4.run.app
```

**Verwacht:**
- 🔴 Status banner toont "Service Disruption - Major service outage in progress"
- Active incidents counter: 1
- Rode indicator bij affected services

### Stap 5: Update incident status
```bash
# Vervang INC-XXXXXXXXX met het echte incident ID uit stap 2
curl -X POST https://snow-flow-health-api-2e7rlcc77q-ez.a.run.app/api/v1/incidents/INC-XXXXXXXXX/update \
  -H "Content-Type: application/json" \
  -d '{
    "status": "identified",
    "message": "Issue identified: Database server restarting. ETA 5 minutes."
  }' | jq .
```

### Stap 6: Resolve incident
```bash
curl -X POST https://snow-flow-health-api-2e7rlcc77q-ez.a.run.app/api/v1/incidents/INC-XXXXXXXXX/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Database connection restored. All systems operational."
  }' | jq .
```

**Verwacht resultaat:**
- Status: `resolved`
- Duration in minutes
- Incident moved to history

### Stap 7: Check status na resolution
```bash
curl https://snow-flow-health-api-2e7rlcc77q-ez.a.run.app/api/v1/status | jq '{overall_status, uptime_30d, active_incidents}'
```

**Verwacht resultaat:**
```json
{
  "overall_status": "operational",  // Back to normal!
  "uptime_30d": [iets lager dan 100], // Permanently decreased by incident duration
  "active_incidents": 0             // Back to 0
}
```

## 🟡 Test Scenario 2: Major Incident (Service Degradation)

```bash
# Create major incident
curl -X POST https://snow-flow-health-api-2e7rlcc77q-ez.a.run.app/api/v1/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API Response Time Degraded",
    "description": "API latency increased to 3-5 seconds. Investigating cause.",
    "severity": "major",
    "affectedServices": ["mcp_server", "portal"]
  }' | jq .
```

**Verwacht effect:**
- Status: `degraded` (not outage!)
- Status page toont 🟡 "Service Issues"
- Less severe than critical

## 🟢 Test Scenario 3: Minor Incident (Minimal Impact)

```bash
# Create minor incident
curl -X POST https://snow-flow-health-api-2e7rlcc77q-ez.a.run.app/api/v1/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Intermittent Email Delays",
    "description": "Some emails experiencing 1-2 minute delays. Monitoring.",
    "severity": "minor",
    "affectedServices": ["website"]
  }' | jq .
```

**Verwacht effect:**
- Status blijft `operational`
- Incident wordt wel geteld
- Minimale impact op uptime

## 📊 View All Incidents

```bash
# Get active incidents and history
curl https://snow-flow-health-api-2e7rlcc77q-ez.a.run.app/api/v1/incidents | jq .
```

**Shows:**
- Active incidents array
- Recent history (last 50)
- Total counts

## 🧪 Complete Test Flow (Copy-Paste)

```bash
API_URL="https://snow-flow-health-api-2e7rlcc77q-ez.a.run.app"

echo "=== 1. Initial Status ==="
curl -s $API_URL/api/v1/status | jq '{overall_status, uptime_30d, active_incidents}'

echo ""
echo "=== 2. Create Critical Incident ==="
INCIDENT=$(curl -s -X POST $API_URL/api/v1/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Website Down - Test Incident",
    "description": "This is a test incident to verify status dashboard behavior",
    "severity": "critical",
    "affectedServices": ["website", "database"]
  }')

echo "$INCIDENT" | jq .
INCIDENT_ID=$(echo "$INCIDENT" | jq -r '.incident.id')

echo ""
echo "=== 3. Status After Incident (Should be OUTAGE) ==="
sleep 2
curl -s $API_URL/api/v1/status | jq '{overall_status, uptime_30d, active_incidents}'

echo ""
echo "=== 4. Open Status Page Now ==="
echo "https://snow-flow-status-page-761141808583.europe-west4.run.app"

echo ""
echo "Press Enter to resolve incident..."
read

echo ""
echo "=== 5. Resolve Incident ==="
curl -s -X POST $API_URL/api/v1/incidents/$INCIDENT_ID/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test incident resolved. All systems back to normal."
  }' | jq .

echo ""
echo "=== 6. Final Status (Should be OPERATIONAL) ==="
sleep 2
curl -s $API_URL/api/v1/status | jq '{overall_status, uptime_30d, active_incidents}'

echo ""
echo "=== Test Complete! ==="
```

## 📈 Wat Je Zou Moeten Zien

### Status Page Changes

1. **Critical Incident Active:**
   - 🔴 Red banner: "Service Disruption"
   - Services show degraded/outage status
   - Uptime graph shows red bar

2. **Major Incident Active:**
   - 🟡 Yellow banner: "Service Issues"
   - Some services degraded
   - Uptime affected but less severe

3. **Incident Resolved:**
   - 🟢 Green banner: "All Systems Operational"
   - All services operational
   - Uptime percentage slightly decreased (permanent record)

### API Behavior

- ✅ **Incidents automatically affect status**
- ✅ **Multiple incidents stack** (most severe wins)
- ✅ **Resolved incidents go to history**
- ✅ **Uptime calculation includes downtime**
- ✅ **Real-time updates** (30-second refresh)

## 🔧 Troubleshooting

**Status niet veranderd na incident?**
```bash
# Check if incident was created
curl https://snow-flow-health-api-2e7rlcc77q-ez.a.run.app/api/v1/incidents | jq '.active'
```

**Status page toont nog steeds oude data?**
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Check browser console for errors
- Verify CORS headers are set

**Incident ID niet gevonden?**
```bash
# List all active incidents to get correct ID
curl https://snow-flow-health-api-2e7rlcc77q-ez.a.run.app/api/v1/incidents | jq '.active[].id'
```

## 💡 Tips

1. **Test verschillende severities** - zie hoe critical vs major vs minor differ
2. **Creëer meerdere incidents** - test hoe ze stacken
3. **Monitor uptime changes** - zie real-time impact
4. **Check incident history** - verify persistence works
5. **Test auto-refresh** - status page updates every 30s

## 🚀 Next Steps

Na testing:
- Integreer met Cloud SQL voor persistent storage
- Set up alerts voor echte incidents
- Add webhook notifications
- Implement auto-recovery logic
