"use strict";
/**
 * Update Set Tools - v8.2.0 Merged Tool Architecture
 *
 * Tools merged: 8 → 3 (-5 tools)
 * - snow_update_set_manage: Replaces create, switch, complete, export, preview, add_artifact (6 tools → 1)
 * - snow_update_set_query: Replaces current, list (2 tools → 1)
 * - snow_ensure_active_update_set: Kept (complex logic)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.snow_ensure_active_update_set_exec = exports.snow_ensure_active_update_set_def = exports.snow_update_set_query_exec = exports.snow_update_set_query_def = exports.snow_update_set_manage_exec = exports.snow_update_set_manage_def = void 0;
// Merged Tools (v8.2.0)
var snow_update_set_manage_js_1 = require("./snow_update_set_manage.js");
Object.defineProperty(exports, "snow_update_set_manage_def", { enumerable: true, get: function () { return snow_update_set_manage_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_update_set_manage_exec", { enumerable: true, get: function () { return snow_update_set_manage_js_1.execute; } });
var snow_update_set_query_js_1 = require("./snow_update_set_query.js");
Object.defineProperty(exports, "snow_update_set_query_def", { enumerable: true, get: function () { return snow_update_set_query_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_update_set_query_exec", { enumerable: true, get: function () { return snow_update_set_query_js_1.execute; } });
// Complex Logic Tools (Kept)
var snow_ensure_active_update_set_js_1 = require("./snow_ensure_active_update_set.js");
Object.defineProperty(exports, "snow_ensure_active_update_set_def", { enumerable: true, get: function () { return snow_ensure_active_update_set_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_ensure_active_update_set_exec", { enumerable: true, get: function () { return snow_ensure_active_update_set_js_1.execute; } });
//# sourceMappingURL=index.js.map