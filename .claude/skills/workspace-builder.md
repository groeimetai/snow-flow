# Agent Workspace Builder

Build complete, production-ready Agent Workspaces using ServiceNow's Now Experience Framework with proper configuration and routing.

## When to use this skill

Use when asked to:
- "Create an Agent Workspace"
- "Build a workspace for [team/function]"
- "Make an IT support workspace"
- "Configure Now Experience workspace"

## What this skill does

Creates complete Agent Workspace with:
- Now Experience Framework architecture
- UX App configuration
- List menus and navigation
- Page routes and properties
- Table configurations
- Proper permissions and ACLs

## Architecture Overview

**Agent Workspace Components:**
1. **Experience** (`sys_ux_experience`) - Main workspace definition
2. **App Config** (`sys_ux_app_config`) - Application configuration
3. **List Menu** (`sys_ux_list_menu_config`) - Navigation menu
4. **Page Properties** (`sys_ux_page_property`) - Page metadata
5. **List Configuration** (`sys_ux_list`) - Table list configs
6. **App Route** (`sys_ux_app_route`) - URL routing

## Step-by-step Workflow

### 1. Gather Requirements

Ask user:
- What is the workspace for? (IT Support, HR, Customer Service)
- Which tables to include? (incident, task, change_request, etc.)
- Which roles need access?
- Custom branding/theming?
- Special features needed? (search, filters, quick actions)

### 2. Create Complete Workspace (Recommended)

Use the high-level tool for full workspace creation:

```javascript
// Use snow_create_complete_workspace - Creates EVERYTHING
{
  workspace_name: "IT Support Workspace",
  tables: [
    "incident",
    "change_request",
    "problem",
    "sc_request"
  ],
  description: "Agent workspace for IT support team",
  roles: ["itil", "it_support"],

  // Optional configurations
  branding: {
    title: "IT Support",
    icon: "support-icon",
    theme: "dark"
  },

  features: {
    enableSearch: true,
    enableQuickCreate: true,
    enableFilters: true
  }
}
```

This creates:
- ✅ Experience record
- ✅ App configuration
- ✅ List menu with all tables
- ✅ Page properties
- ✅ List configurations
- ✅ App routes
- ✅ Permissions

### 3. OR: Build Step-by-Step (Advanced)

For fine-grained control, build components individually:

#### Step 3A: Create Experience

```javascript
{
  name: "it_support_workspace",
  title: "IT Support Workspace",
  description: "Agent workspace for IT support operations",
  active: true,
  roles: "itil,it_support"
}
```

#### Step 3B: Create App Configuration

```javascript
{
  name: "it_support_app",
  title: "IT Support",
  experience_id: "<experience_sys_id>",
  landing_page: "home",
  theme: "dark"
}
```

#### Step 3C: Create List Menu

```javascript
{
  name: "it_support_menu",
  app_config_id: "<app_config_sys_id>",
  items: [
    {
      label: "Incidents",
      table: "incident",
      view: "itsm",
      icon: "incident-icon",
      order: 1
    },
    {
      label: "Change Requests",
      table: "change_request",
      view: "itsm",
      icon: "change-icon",
      order: 2
    },
    {
      label: "Problems",
      table: "problem",
      view: "itsm",
      icon: "problem-icon",
      order: 3
    }
  ]
}
```

#### Step 3D: Configure Table Lists

For each table, create list configuration:

```javascript
{
  table: "incident",
  view: "itsm",
  fields: [
    "number",
    "priority",
    "state",
    "assigned_to",
    "short_description",
    "sys_created_on"
  ],
  filters: [
    {
      name: "My Open Incidents",
      condition: "assigned_to=javascript:gs.getUserID()^state!=6^state!=7"
    },
    {
      name: "Unassigned",
      condition: "assigned_toISEMPTY^active=true"
    },
    {
      name: "High Priority",
      condition: "priority<=2^active=true"
    }
  ],
  default_filter: "My Open Incidents"
}
```

#### Step 3E: Create App Routes

```javascript
{
  app_config_id: "<app_config_sys_id>",
  routes: [
    {
      path: "/home",
      page: "workspace_home",
      title: "Home"
    },
    {
      path: "/incident",
      page: "record_page",
      params: {table: "incident"}
    },
    {
      path: "/change",
      page: "record_page",
      params: {table: "change_request"}
    }
  ]
}
```

### 4. Configure Workspace Features

#### Add Search Capability

```javascript
{
  app_config_id: "<app_config_sys_id>",
  search: {
    enabled: true,
    tables: ["incident", "change_request", "problem"],
    fields: ["number", "short_description", "description"]
  }
}
```

#### Add Quick Create Actions

```javascript
{
  app_config_id: "<app_config_sys_id>",
  quick_create: {
    enabled: true,
    actions: [
      {
        label: "New Incident",
        table: "incident",
        template: "incident_template"
      },
      {
        label: "New Change",
        table: "change_request",
        template: "change_template"
      }
    ]
  }
}
```

#### Configure Workspace Panels

```javascript
{
  workspace_id: "<experience_sys_id>",
  panels: [
    {
      position: "left",
      width: 300,
      content: "navigation_menu",
      collapsible: true
    },
    {
      position: "main",
      content: "record_workspace"
    },
    {
      position: "right",
      width: 400,
      content: "contextual_panel",
      tabs: [
        "notes",
        "related_lists",
        "activity"
      ]
    }
  ]
}
```

### 5. Add Custom Workspace Components

Use UI Builder to create custom components:

```javascript
// Create custom dashboard component
{
  type: 'uib_component',
  config: {
    name: 'workspace_kpi_dashboard',
    category: 'workspace_custom',

    // Component template
    template: `
      <div class="workspace-kpi">
        <div class="kpi-card" ng-repeat="kpi in data.kpis">
          <h3>{{kpi.value}}</h3>
          <p>{{kpi.label}}</p>
        </div>
      </div>
    `,

    // Data broker for KPIs
    data_broker: {
      script: `
        var kpis = [];

        // Count open incidents
        var incGr = new GlideRecord('incident');
        incGr.addQuery('active', true);
        incGr.query();
        kpis.push({
          label: 'Open Incidents',
          value: incGr.getRowCount()
        });

        // Count pending changes
        var chgGr = new GlideRecord('change_request');
        chgGr.addQuery('state', 'IN', '-5,-4,-3');
        chgGr.query();
        kpis.push({
          label: 'Pending Changes',
          value: chgGr.getRowCount()
        });

        return {kpis: kpis};
      `
    }
  }
}
```

### 6. Configure Permissions

Set up proper ACLs for workspace:

```javascript
// Create workspace ACL
{
  type: 'experience',
  name: 'it_support_workspace',
  roles: 'itil,it_support',
  condition: 'gs.hasRole("itil") || gs.hasRole("it_support")',
  script: ''  // Additional validation if needed
}
```

### 7. Test Workspace

1. Access workspace URL: `/now/workspace/agent/[workspace_name]`
2. Verify:
   - ✅ Navigation menu displays all tables
   - ✅ Lists load with correct fields and filters
   - ✅ Search works across configured tables
   - ✅ Quick create actions function
   - ✅ Record pages open correctly
   - ✅ Contextual panels show relevant data
   - ✅ Permissions restrict properly

### 8. Validate Configuration

Use validation tool:

```javascript
{
  workspace_id: "<experience_sys_id>"
}
```

Checks:
- ✅ All required components exist
- ✅ Routes are properly configured
- ✅ List configurations are valid
- ✅ Permissions are set correctly
- ✅ No broken references
- ✅ Best practices followed

## Common Workspace Patterns

### IT Support Workspace
```javascript
{
  workspace_name: "IT Support Workspace",
  tables: ["incident", "change_request", "problem", "sc_request", "kb_knowledge"],
  roles: ["itil", "it_support"],
  features: {
    enableSearch: true,
    enableQuickCreate: true,
    enableKnowledgePanel: true
  }
}
```

### HR Service Workspace
```javascript
{
  workspace_name: "HR Service Workspace",
  tables: ["sn_hr_core_case", "hr_task", "sn_hr_core_profile"],
  roles: ["sn_hr_core.basic", "sn_hr_core.admin"],
  features: {
    enableEmployeeSearch: true,
    enableCaseManagement: true
  }
}
```

### Customer Service Workspace
```javascript
{
  workspace_name: "Customer Service Workspace",
  tables: ["sn_customerservice_case", "interaction", "account"],
  roles: ["sn_customerservice_agent"],
  features: {
    enableCustomerLookup: true,
    enableCaseTimeline: true,
    enableKnowledgeIntegration: true
  }
}
```

## Advanced Features

### Multi-Table Workspaces

Configure workspace to handle multiple related tables:

```javascript
{
  workspace_name: "ITSM Workspace",
  primary_tables: ["incident", "change_request"],
  related_tables: {
    incident: ["task", "problem", "cmdb_ci"],
    change_request: ["task", "cmdb_ci", "change_task"]
  },
  relationship_config: {
    show_related_lists: true,
    enable_quick_navigation: true
  }
}
```

### Custom Landing Page

Create custom home page for workspace:

```javascript
// Use UI Builder to create landing page
{
  type: 'uib_page',
  config: {
    name: 'workspace_home',
    title: 'Home',

    // Add components
    elements: [
      {
        component: 'workspace_kpi_dashboard',
        position: {row: 1, col: 1, colspan: 12}
      },
      {
        component: 'recent_activity_feed',
        position: {row: 2, col: 1, colspan: 6}
      },
      {
        component: 'assigned_tasks_list',
        position: {row: 2, col: 7, colspan: 6}
      }
    ]
  }
}

// Set as landing page
{
  app_config_id: "<app_config_sys_id>",
  landing_page: "workspace_home"
}
```

### Workspace Automation

Add automated actions and notifications:

```javascript
{
  workspace_id: "<experience_sys_id>",
  automations: [
    {
      name: "Auto-assign incidents",
      trigger: "incident.insert",
      condition: "assigned_to is empty",
      action: "assign_to_group"
    },
    {
      name: "SLA breach notification",
      trigger: "incident.update",
      condition: "sla_due < now AND state != closed",
      action: "notify_manager"
    }
  ]
}
```

## Workspace Configuration Best Practices

1. **Start Simple**: Begin with core tables, add features incrementally
2. **User Testing**: Test with actual agents before full deployment
3. **Performance**: Limit initial list loads to 50-100 records
4. **Mobile Support**: Ensure workspace works on tablets
5. **Training**: Document workspace usage for agents
6. **Monitoring**: Track workspace usage and performance
7. **Updates**: Plan for regular feature additions based on feedback

## Troubleshooting

**Workspace doesn't appear:**
- Check experience is active
- Verify user has required roles
- Check app route configuration

**Lists don't load:**
- Verify table permissions
- Check list configuration fields exist
- Validate filter conditions

**Navigation broken:**
- Check app route paths
- Verify page registrations
- Validate URL parameters

**Performance issues:**
- Reduce initial list load size
- Optimize list field selection
- Enable client-side caching

## Success Criteria

Workspace is complete when:
1. ✅ All required tables accessible
2. ✅ Navigation works smoothly
3. ✅ Search returns relevant results
4. ✅ Quick create actions work
5. ✅ Record pages display correctly
6. ✅ Contextual panels show related data
7. ✅ Permissions properly restrict access
8. ✅ Performance is acceptable (< 3s load)
9. ✅ Mobile/tablet compatible
10. ✅ User acceptance testing passed
