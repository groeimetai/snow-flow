# Ui Frameworks

Tools for ui-frameworks

**Total Tools:** 19 | **Read:** 4 | **Write:** 15

---

## snow_configure_mobile_app

Configure ServiceNow mobile app

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_configure_mobile_app
const result = await snow_configure_mobile_app({
});
```

---

## snow_configure_offline_sync

Configure offline synchronization settings for mobile applications. Controls which data is available offline.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_configure_offline_sync
const result = await snow_configure_offline_sync({
});
```

---

## snow_create_complete_workspace

Create Complete UX Workspace - Executes all 6 steps automatically: Experience → App Config → Page Macroponent → Page Registry → Route → Landing Page Route. Creates a fully functional workspace.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_complete_workspace
const result = await snow_create_complete_workspace({
});
```

---

## snow_create_configurable_agent_workspace

Create Configurable Agent Workspace using UX App architecture (sys_ux_app_route, sys_ux_screen_type). Creates workspace with screen collections for multiple tables.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_configurable_agent_workspace
const result = await snow_create_configurable_agent_workspace({
});
```

---

## snow_create_mobile_action

Creates a mobile action that users can trigger from the mobile app. Actions can navigate, execute scripts, or open forms.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_mobile_action
const result = await snow_create_mobile_action({
});
```

---

## snow_create_mobile_layout

Creates a custom mobile layout for forms and lists in the mobile app.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_mobile_layout
const result = await snow_create_mobile_layout({
});
```

---

## snow_create_sp_page

Create Service Portal page

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_sp_page
const result = await snow_create_sp_page({
});
```

---

## snow_create_sp_widget

Create Service Portal widget

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_sp_widget
const result = await snow_create_sp_widget({
});
```

---

## snow_create_ux_app_config

STEP 2: Create UX App Configuration Record (sys_ux_app_config) - Contains workspace settings and links to the experience from Step 1.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_ux_app_config
const result = await snow_create_ux_app_config({
});
```

---

## snow_create_ux_app_route

STEP 5: Create Route Record (sys_ux_app_route) - Defines the URL slug that leads to the page.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_ux_app_route
const result = await snow_create_ux_app_route({
});
```

---

## snow_create_ux_experience

STEP 1: Create UX Experience Record (sys_ux_experience) - The top-level container for the workspace. ⚠️ REQUIRES: Now Experience Framework (UXF) enabled. ALTERNATIVE: Use traditional form/list configurations if UXF unavailable.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_ux_experience
const result = await snow_create_ux_experience({
});
```

---

## snow_create_ux_page_macroponent

STEP 3: Create Page Macroponent Record (sys_ux_macroponent) - Defines the actual page content that will be displayed.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_ux_page_macroponent
const result = await snow_create_ux_page_macroponent({
});
```

---

## snow_create_ux_page_registry

STEP 4: Create Page Registry Record (sys_ux_page_registry) - Registers the page for use within the workspace configuration.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_ux_page_registry
const result = await snow_create_ux_page_registry({
});
```

---

## snow_discover_all_workspaces

Discover all workspaces (UX Experiences, Agent Workspaces, UI Builder pages) with comprehensive details and usage analytics.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_discover_all_workspaces
const result = await snow_discover_all_workspaces({
});
```

---

## snow_discover_va_topics

Discovers available Virtual Agent topics and their configurations.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_discover_va_topics
const result = await snow_discover_va_topics({
});
```

---

## snow_uib_component_manage

Unified UIB component management (create, clone)

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | advanced |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_uib_component_manage
const result = await snow_uib_component_manage({
});
```

---

## snow_uib_discover

Unified UI Builder discovery (pages, components, routes, page_usage)

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_uib_discover
const result = await snow_uib_discover({
});
```

---

## snow_update_ux_app_config_landing_page

STEP 6: Update App Configuration with Landing Page Route - Sets the default landing page for the workspace.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_update_ux_app_config_landing_page
const result = await snow_update_ux_app_config_landing_page({
});
```

---

## snow_validate_workspace_configuration

Validate workspace configuration for completeness, best practices, and potential issues across all workspace types.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | advanced |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_validate_workspace_configuration
const result = await snow_validate_workspace_configuration({
});
```

---

