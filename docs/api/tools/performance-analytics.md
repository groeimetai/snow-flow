# Performance Analytics

Tools for performance-analytics

**Total Tools:** 3 | **Read:** 2 | **Write:** 1

---

## snow_pa_create

Unified PA creation (indicator, breakdown, threshold, widget, visualization, scheduled_report)

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_pa_create
const result = await snow_pa_create({
});
```

---

## snow_pa_discover

Unified PA discovery (indicators, report_fields, reporting_tables)

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_pa_discover
const result = await snow_pa_discover({
});
```

---

## snow_pa_operate

Unified PA operations (collect_data, export_report, generate_insights, get_scores)

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_pa_operate
const result = await snow_pa_operate({
});
```

---

