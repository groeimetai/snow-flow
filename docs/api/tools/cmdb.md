# CMDB

Configuration item management and relationships

**Total Tools:** 14 | **Read:** 10 | **Write:** 4

---

## snow_ci_health_check

Check CI health and compliance status

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_ci_health_check
const result = await snow_ci_health_check({
});
```

---

## snow_cmdb_search

Searches Configuration Management Database (CMDB) for configuration items with relationship mapping

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_cmdb_search
const result = await snow_cmdb_search({
});
```

---

## snow_create_ci

Create Configuration Item in CMDB

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_ci
const result = await snow_create_ci({
});
```

---

## snow_create_ci_relationship

Create relationship between Configuration Items

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_ci_relationship
const result = await snow_create_ci_relationship({
});
```

---

## snow_get_ci_details

Retrieve Configuration Item details including relationships and history

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_ci_details
const result = await snow_get_ci_details({
});
```

---

## snow_get_ci_history

Get Configuration Item change history

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_ci_history
const result = await snow_get_ci_history({
});
```

---

## snow_get_ci_impact

Calculate impact analysis for CI outage

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_ci_impact
const result = await snow_get_ci_impact({
});
```

---

## snow_get_ci_relationships

Get all relationships for a Configuration Item

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_ci_relationships
const result = await snow_get_ci_relationships({
});
```

---

## snow_get_event_correlation

Get event correlation results showing how events are grouped into alerts

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | advanced |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_event_correlation
const result = await snow_get_event_correlation({
});
```

---

## snow_impact_analysis

Perform impact analysis to identify affected services when a CI changes

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | advanced |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_impact_analysis
const result = await snow_impact_analysis({
});
```

---

## snow_reconcile_ci

Reconcile CI data from multiple sources

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | advanced |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_reconcile_ci
const result = await snow_reconcile_ci({
});
```

---

## snow_run_discovery

Trigger CMDB discovery scan

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_run_discovery
const result = await snow_run_discovery({
});
```

---

## snow_search_cmdb

Search the CMDB for Configuration Items with various filters

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_search_cmdb
const result = await snow_search_cmdb({
});
```

---

## snow_update_ci

Update Configuration Item attributes

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_update_ci
const result = await snow_update_ci({
});
```

---

