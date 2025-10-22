"use strict";
/**
 * Change Management Tools - v8.2.0 Merged Architecture
 *
 * Tools merged: 8 → 2 (-6 tools)
 * - snow_change_manage: Replaces create, update_state, approve, create_task, schedule_cab (5 → 1)
 * - snow_change_query: Replaces get, search, assess_risk (3 → 1)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.snow_change_query_exec = exports.snow_change_query_def = exports.snow_change_manage_exec = exports.snow_change_manage_def = void 0;
// Merged Tools (v8.2.0)
var snow_change_manage_js_1 = require("./snow_change_manage.js");
Object.defineProperty(exports, "snow_change_manage_def", { enumerable: true, get: function () { return snow_change_manage_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_change_manage_exec", { enumerable: true, get: function () { return snow_change_manage_js_1.execute; } });
var snow_change_query_js_1 = require("./snow_change_query.js");
Object.defineProperty(exports, "snow_change_query_def", { enumerable: true, get: function () { return snow_change_query_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_change_query_exec", { enumerable: true, get: function () { return snow_change_query_js_1.execute; } });
//# sourceMappingURL=index.js.map