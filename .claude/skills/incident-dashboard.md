# Incident Analytics Dashboard Builder

Build comprehensive incident analytics dashboards with real-time metrics, charts, and drill-down capabilities.

## When to use this skill

Use when asked to:
- "Create an incident dashboard"
- "Build incident analytics"
- "Show incident metrics"
- "Make incident report dashboard"
- "Display incident KPIs"

## What this skill does

Creates a complete incident analytics dashboard with:
- Real-time incident metrics (count, priority breakdown, status)
- Visual charts (priority distribution, SLA compliance, trends)
- Interactive drill-down capabilities
- Auto-refresh functionality
- Exportable data

## Step-by-step Workflow

### 0. 🚨 CREATE UPDATE SET FIRST (MANDATORY!)

**BEFORE starting, create an Update Set:**

```javascript
// STEP 0: Create Update Set
const updateSet = await snow_update_set_manage({
  action: 'create',
  name: "Feature: Incident Dashboard",
  description: "Create incident dashboard for [purpose]",
  application: "global"
});

// Verify it's active
const current = await snow_update_set_query({ action: 'current' });
console.log('Active Update Set:', current.name);
```

**✅ Now all development will be tracked in this Update Set!**

### 1. Define Dashboard Requirements

Ask user:
- Which metrics to display? (count, priority, status, assignment, SLA)
- Time period? (today, this week, this month)
- Which charts? (pie, bar, trend line)
- Drill-down needs? (click to see incident list)
- Refresh interval? (manual, auto every X minutes)

### 2. Query Incident Data

Use `snow_query_table` to get incident data:

```javascript
{
  table: 'incident',
  query: 'active=true',  // Or custom query
  fields: [
    'number',
    'priority',
    'state',
    'assigned_to',
    'short_description',
    'sys_created_on',
    'sla_due',
    'assignment_group'
  ],
  limit: 1000  // Or use pagination for more
}
```

### 3. Analyze and Aggregate Data

Process incident data to calculate metrics:

```javascript
var metrics = {
  total: 0,
  byPriority: {p1: 0, p2: 0, p3: 0, p4: 0},
  byState: {},
  byAssignmentGroup: {},
  slaBreached: 0,
  avgResolutionTime: 0
};

// Process each incident
incidents.forEach(function(inc) {
  metrics.total++;

  // Count by priority
  var priority = inc.priority || '4';
  metrics.byPriority['p' + priority]++;

  // Count by state
  var state = inc.state || 'New';
  metrics.byState[state] = (metrics.byState[state] || 0) + 1;

  // Count by assignment group
  var group = inc.assignment_group || 'Unassigned';
  metrics.byAssignmentGroup[group] = (metrics.byAssignmentGroup[group] || 0) + 1;

  // Check SLA
  if (inc.sla_due && new Date(inc.sla_due) < new Date()) {
    metrics.slaBreached++;
  }
});
```

### 4. Create Dashboard Widget

Use widget-builder skill to create visualization:

```javascript
{
  type: 'widget',
  config: {
    name: 'incident_dashboard',
    title: 'Incident Analytics Dashboard',

    template: `
      <div class="incident-dashboard">
        <!-- Header Stats -->
        <div class="stats-row">
          <div class="stat-card total">
            <h2>{{data.metrics.total}}</h2>
            <p>Total Active</p>
          </div>
          <div class="stat-card critical">
            <h2>{{data.metrics.byPriority.p1}}</h2>
            <p>Critical (P1)</p>
          </div>
          <div class="stat-card high">
            <h2>{{data.metrics.byPriority.p2}}</h2>
            <p>High (P2)</p>
          </div>
          <div class="stat-card medium">
            <h2>{{data.metrics.byPriority.p3}}</h2>
            <p>Medium (P3)</p>
          </div>
          <div class="stat-card sla-breach">
            <h2>{{data.metrics.slaBreached}}</h2>
            <p>SLA Breached</p>
          </div>
        </div>

        <!-- Charts Row -->
        <div class="charts-row">
          <!-- Priority Chart -->
          <div class="chart-container">
            <h3>Priority Distribution</h3>
            <canvas id="priorityChart"></canvas>
          </div>

          <!-- Status Chart -->
          <div class="chart-container">
            <h3>Status Breakdown</h3>
            <canvas id="statusChart"></canvas>
          </div>
        </div>

        <!-- Recent Incidents Table -->
        <div class="incidents-table">
          <h3>Recent Incidents</h3>
          <table class="table table-striped">
            <thead>
              <tr>
                <th>Number</th>
                <th>Priority</th>
                <th>Description</th>
                <th>Assigned To</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              <tr ng-repeat="incident in data.recentIncidents">
                <td>
                  <a ng-click="c.openIncident(incident.sys_id)">
                    {{incident.number}}
                  </a>
                </td>
                <td>
                  <span class="badge priority-{{incident.priority}}">
                    P{{incident.priority}}
                  </span>
                </td>
                <td>{{incident.short_description}}</td>
                <td>{{incident.assigned_to}}</td>
                <td>{{incident.state}}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Actions -->
        <div class="actions">
          <button ng-click="c.refresh()" class="btn btn-primary">
            <span class="glyphicon glyphicon-refresh"></span>
            Refresh
          </button>
          <button ng-click="c.exportData()" class="btn btn-default">
            <span class="glyphicon glyphicon-download"></span>
            Export CSV
          </button>
        </div>
      </div>
    `,

    server_script: `
      (function() {
        data.metrics = {
          total: 0,
          byPriority: {p1: 0, p2: 0, p3: 0, p4: 0},
          byState: {},
          slaBreached: 0
        };
        data.recentIncidents = [];
        data.chartData = {};

        if (input.action === 'loadDashboard' || !input.action) {
          // Query active incidents
          var gr = new GlideRecord('incident');
          gr.addQuery('active', true);
          gr.orderByDesc('sys_created_on');
          gr.setLimit(100);
          gr.query();

          var now = new GlideDateTime();

          while (gr.next()) {
            data.metrics.total++;

            // Priority breakdown
            var priority = gr.getValue('priority') || '4';
            var pKey = 'p' + priority;
            data.metrics.byPriority[pKey]++;

            // State breakdown
            var stateName = gr.state.getDisplayValue();
            data.metrics.byState[stateName] = (data.metrics.byState[stateName] || 0) + 1;

            // SLA check
            if (gr.getValue('sla_due')) {
              var slaDue = new GlideDateTime(gr.getValue('sla_due'));
              if (slaDue.before(now)) {
                data.metrics.slaBreached++;
              }
            }

            // Add to recent incidents (first 10)
            if (data.recentIncidents.length < 10) {
              data.recentIncidents.push({
                sys_id: gr.getValue('sys_id'),
                number: gr.getValue('number'),
                priority: gr.getValue('priority'),
                short_description: gr.getValue('short_description'),
                assigned_to: gr.assigned_to.getDisplayValue(),
                state: gr.state.getDisplayValue()
              });
            }
          }

          // Prepare chart data
          data.chartData = {
            priority: {
              labels: ['P1 Critical', 'P2 High', 'P3 Medium', 'P4 Low'],
              values: [
                data.metrics.byPriority.p1,
                data.metrics.byPriority.p2,
                data.metrics.byPriority.p3,
                data.metrics.byPriority.p4
              ]
            },
            status: {
              labels: Object.keys(data.metrics.byState),
              values: Object.values(data.metrics.byState)
            }
          };
        }

        if (input.action === 'openIncident') {
          data.redirectUrl = '/incident.do?sys_id=' + input.sys_id;
        }
      })();
    `,

    client_script: `
      function($scope, $window) {
        var c = this;

        c.$onInit = function() {
          c.loadDashboard();
        };

        c.loadDashboard = function() {
          c.server.get({action: 'loadDashboard'}).then(function() {
            c.renderCharts();
          });
        };

        c.refresh = function() {
          c.loadDashboard();
        };

        c.openIncident = function(sysId) {
          c.server.get({
            action: 'openIncident',
            sys_id: sysId
          }).then(function(response) {
            if (response.data.redirectUrl) {
              $window.open(response.data.redirectUrl, '_blank');
            }
          });
        };

        c.exportData = function() {
          var csv = 'Number,Priority,Description,Assigned To,State\\n';
          c.data.recentIncidents.forEach(function(inc) {
            csv += inc.number + ',' +
                   inc.priority + ',' +
                   '"' + inc.short_description + '",' +
                   inc.assigned_to + ',' +
                   inc.state + '\\n';
          });

          var blob = new Blob([csv], {type: 'text/csv'});
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'incidents_' + new Date().toISOString().split('T')[0] + '.csv';
          a.click();
        };

        c.renderCharts = function() {
          // Priority Chart
          var ctx1 = document.getElementById('priorityChart');
          if (ctx1 && c.data.chartData) {
            new Chart(ctx1, {
              type: 'pie',
              data: {
                labels: c.data.chartData.priority.labels,
                datasets: [{
                  data: c.data.chartData.priority.values,
                  backgroundColor: [
                    '#d32f2f',  // P1 Red
                    '#f57c00',  // P2 Orange
                    '#fbc02d',  // P3 Yellow
                    '#388e3c'   // P4 Green
                  ]
                }]
              }
            });
          }

          // Status Chart
          var ctx2 = document.getElementById('statusChart');
          if (ctx2 && c.data.chartData) {
            new Chart(ctx2, {
              type: 'bar',
              data: {
                labels: c.data.chartData.status.labels,
                datasets: [{
                  label: 'Incidents',
                  data: c.data.chartData.status.values,
                  backgroundColor: '#1976d2'
                }]
              }
            });
          }
        };
      }
    `,

    css: `
      .incident-dashboard {
        padding: 20px;
      }

      .stats-row {
        display: flex;
        gap: 15px;
        margin-bottom: 30px;
      }

      .stat-card {
        flex: 1;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .stat-card h2 {
        margin: 0;
        font-size: 36px;
        font-weight: bold;
      }

      .stat-card p {
        margin: 5px 0 0 0;
        font-size: 14px;
        opacity: 0.8;
      }

      .stat-card.total {
        background: #1976d2;
        color: white;
      }

      .stat-card.critical {
        background: #d32f2f;
        color: white;
      }

      .stat-card.high {
        background: #f57c00;
        color: white;
      }

      .stat-card.medium {
        background: #fbc02d;
      }

      .stat-card.sla-breach {
        background: #c62828;
        color: white;
      }

      .charts-row {
        display: flex;
        gap: 20px;
        margin-bottom: 30px;
      }

      .chart-container {
        flex: 1;
        padding: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .chart-container h3 {
        margin-top: 0;
      }

      .incidents-table {
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin-bottom: 20px;
      }

      .badge.priority-1 {
        background: #d32f2f;
      }

      .badge.priority-2 {
        background: #f57c00;
      }

      .badge.priority-3 {
        background: #fbc02d;
        color: #333;
      }

      .badge.priority-4 {
        background: #388e3c;
      }

      .actions {
        text-align: right;
      }

      .actions .btn {
        margin-left: 10px;
      }
    `
  }
}
```

### 5. Add Chart Library Dependency

Ensure Chart.js is available in Service Portal:

```javascript
// Use snow_update to add Chart.js to portal dependencies
{
  type: 'portal',
  identifier: 'sp',
  config: {
    js_includes: [
      'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js'
    ]
  }
}
```

### 6. Configure Auto-Refresh (Optional)

Add auto-refresh capability:

```javascript
// In client script
c.$onInit = function() {
  c.loadDashboard();

  // Auto-refresh every 5 minutes
  $interval(function() {
    c.loadDashboard();
  }, 300000);
};
```

### 7. Add Filters (Optional)

Allow users to filter by date range, priority, assignment group:

```javascript
// Add filter UI to template
<div class="filters">
  <select ng-model="c.filters.priority" ng-change="c.applyFilters()">
    <option value="">All Priorities</option>
    <option value="1">P1 Critical</option>
    <option value="2">P2 High</option>
    <option value="3">P3 Medium</option>
    <option value="4">P4 Low</option>
  </select>

  <select ng-model="c.filters.timeRange" ng-change="c.applyFilters()">
    <option value="today">Today</option>
    <option value="week">This Week</option>
    <option value="month">This Month</option>
  </select>
</div>

// In client script
c.applyFilters = function() {
  c.server.get({
    action: 'loadDashboard',
    priority: c.filters.priority,
    timeRange: c.filters.timeRange
  });
};
```

## Advanced Features

### Drill-Down Capabilities

Allow clicking on chart segments to see filtered incidents:

```javascript
// In chart configuration
onClick: function(evt, elements) {
  if (elements.length > 0) {
    var index = elements[0].index;
    var priority = index + 1;  // P1, P2, P3, P4
    c.filterByPriority(priority);
  }
}
```

### Trend Analysis

Show incident trends over time:

```javascript
// Query historical data
var days = 7;
var trendData = [];

for (var i = days - 1; i >= 0; i--) {
  var date = new GlideDateTime();
  date.addDaysLocalTime(-i);
  date.setDisplayValue(date.getLocalDate().substring(0, 10) + ' 00:00:00');

  var nextDate = new GlideDateTime(date);
  nextDate.addDaysLocalTime(1);

  var gr = new GlideRecord('incident');
  gr.addQuery('sys_created_on', '>=', date);
  gr.addQuery('sys_created_on', '<', nextDate);
  gr.query();

  trendData.push({
    date: date.getLocalDate().substring(0, 10),
    count: gr.getRowCount()
  });
}

data.trendData = trendData;
```

### Real-Time Notifications

Alert on critical incidents:

```javascript
// Check for new P1 incidents
if (newP1Count > c.previousP1Count) {
  c.showAlert('New Critical Incident!', 'danger');
}
```

## Success Criteria

Dashboard is complete when:
1. ✅ All metrics display accurately
2. ✅ Charts render correctly
3. ✅ Drill-down navigation works
4. ✅ Refresh updates data correctly
5. ✅ Export functionality works
6. ✅ Performance is acceptable (< 2s load)
7. ✅ Mobile-responsive design
8. ✅ No console errors


### Final Step: Complete Update Set

```javascript
// After dashboard creation, complete the Update Set
await snow_update_set_manage({
  action: "complete",
  update_set_id: updateSet.sys_id,
  state: "complete"
});

console.log("✅ Incident Dashboard complete and tracked in Update Set!");
```
