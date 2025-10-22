"use strict";
/**
 * Performance Analytics Tools - v8.2.0 Merged Architecture
 *
 * Phase 2: 14 → 6 (-8 tools)
 * - snow_pa_create: Replaces indicator, kpi, breakdown, threshold, widget, visualization, scheduled_report (7 → 1)
 * - snow_pa_discover: Replaces discover_pa_indicators, discover_report_fields, discover_reporting_tables (3 → 1)
 *
 * Phase 3: 6 → 3 (-3 tools)
 * - snow_pa_operate: Replaces collect_pa_data, export_report_data, generate_insights, get_pa_scores (4 → 1)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.snow_pa_operate_exec = exports.snow_pa_operate_def = exports.snow_pa_discover_exec = exports.snow_pa_discover_def = exports.snow_pa_create_exec = exports.snow_pa_create_def = void 0;
// Merged Tools (v8.2.0 Phase 2)
var snow_pa_create_js_1 = require("./snow_pa_create.js");
Object.defineProperty(exports, "snow_pa_create_def", { enumerable: true, get: function () { return snow_pa_create_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_pa_create_exec", { enumerable: true, get: function () { return snow_pa_create_js_1.execute; } });
var snow_pa_discover_js_1 = require("./snow_pa_discover.js");
Object.defineProperty(exports, "snow_pa_discover_def", { enumerable: true, get: function () { return snow_pa_discover_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_pa_discover_exec", { enumerable: true, get: function () { return snow_pa_discover_js_1.execute; } });
// Merged Tools (v8.2.0 Phase 3)
var snow_pa_operate_js_1 = require("./snow_pa_operate.js");
Object.defineProperty(exports, "snow_pa_operate_def", { enumerable: true, get: function () { return snow_pa_operate_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_pa_operate_exec", { enumerable: true, get: function () { return snow_pa_operate_js_1.execute; } });
//# sourceMappingURL=index.js.map