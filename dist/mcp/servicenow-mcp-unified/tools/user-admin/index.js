"use strict";
/**
 * User Administration Tools - v8.2.0 Merged Architecture
 *
 * Tools merged: 5 → 2 (-3 tools)
 * - snow_user_manage: Replaces create_user, deactivate_user (2 → 1)
 * - snow_role_group_manage: Replaces create_role, assign_role, create_group (3 → 1)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.snow_role_group_manage_exec = exports.snow_role_group_manage_def = exports.snow_user_manage_exec = exports.snow_user_manage_def = void 0;
// Merged Tools (v8.2.0)
var snow_user_manage_js_1 = require("./snow_user_manage.js");
Object.defineProperty(exports, "snow_user_manage_def", { enumerable: true, get: function () { return snow_user_manage_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_user_manage_exec", { enumerable: true, get: function () { return snow_user_manage_js_1.execute; } });
var snow_role_group_manage_js_1 = require("./snow_role_group_manage.js");
Object.defineProperty(exports, "snow_role_group_manage_def", { enumerable: true, get: function () { return snow_role_group_manage_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_role_group_manage_exec", { enumerable: true, get: function () { return snow_role_group_manage_js_1.execute; } });
//# sourceMappingURL=index.js.map