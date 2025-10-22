"use strict";
/**
 * UI Builder Tools - Export all UI Builder tool modules
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.snow_debug_widget_fetch_exec = exports.snow_debug_widget_fetch_def = exports.snow_create_workspace_exec = exports.snow_create_workspace_def = exports.snow_create_uib_page_registry_exec = exports.snow_create_uib_page_registry_def = exports.snow_create_uib_event_exec = exports.snow_create_uib_event_def = exports.snow_create_uib_data_broker_exec = exports.snow_create_uib_data_broker_def = exports.snow_create_uib_client_state_exec = exports.snow_create_uib_client_state_def = exports.snow_create_uib_client_script_exec = exports.snow_create_uib_client_script_def = exports.snow_configure_uib_data_broker_exec = exports.snow_configure_uib_data_broker_def = exports.snow_analyze_uib_page_performance_exec = exports.snow_analyze_uib_page_performance_def = exports.snow_uib_component_manage_exec = exports.snow_uib_component_manage_def = exports.snow_uib_discover_exec = exports.snow_uib_discover_def = exports.snow_uib_page_manage_exec = exports.snow_uib_page_manage_def = void 0;
// Merged Page Management Tools (v8.2.0 Phase 2)
// Replaces: create_uib_page, delete_uib_page, add_uib_page_element, remove_uib_page_element (4 → 1)
var snow_uib_page_manage_js_1 = require("./snow_uib_page_manage.js");
Object.defineProperty(exports, "snow_uib_page_manage_def", { enumerable: true, get: function () { return snow_uib_page_manage_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_uib_page_manage_exec", { enumerable: true, get: function () { return snow_uib_page_manage_js_1.execute; } });
// Merged Discovery Tools (v8.2.0 Phase 2)
// Replaces: discover_uib_components, discover_uib_page_usage, discover_uib_pages, discover_uib_routes (4 → 1)
var snow_uib_discover_js_1 = require("./snow_uib_discover.js");
Object.defineProperty(exports, "snow_uib_discover_def", { enumerable: true, get: function () { return snow_uib_discover_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_uib_discover_exec", { enumerable: true, get: function () { return snow_uib_discover_js_1.execute; } });
// Merged Component Management Tools (v8.2.0 Phase 3)
// Replaces: create_uib_component, clone_uib_component (2 → 1)
var snow_uib_component_manage_js_1 = require("./snow_uib_component_manage.js");
Object.defineProperty(exports, "snow_uib_component_manage_def", { enumerable: true, get: function () { return snow_uib_component_manage_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_uib_component_manage_exec", { enumerable: true, get: function () { return snow_uib_component_manage_js_1.execute; } });
// UI Builder Operations (kept)
var snow_analyze_uib_page_performance_js_1 = require("./snow_analyze_uib_page_performance.js");
Object.defineProperty(exports, "snow_analyze_uib_page_performance_def", { enumerable: true, get: function () { return snow_analyze_uib_page_performance_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_analyze_uib_page_performance_exec", { enumerable: true, get: function () { return snow_analyze_uib_page_performance_js_1.execute; } });
var snow_configure_uib_data_broker_js_1 = require("./snow_configure_uib_data_broker.js");
Object.defineProperty(exports, "snow_configure_uib_data_broker_def", { enumerable: true, get: function () { return snow_configure_uib_data_broker_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_configure_uib_data_broker_exec", { enumerable: true, get: function () { return snow_configure_uib_data_broker_js_1.execute; } });
var snow_create_uib_client_script_js_1 = require("./snow_create_uib_client_script.js");
Object.defineProperty(exports, "snow_create_uib_client_script_def", { enumerable: true, get: function () { return snow_create_uib_client_script_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_create_uib_client_script_exec", { enumerable: true, get: function () { return snow_create_uib_client_script_js_1.execute; } });
var snow_create_uib_client_state_js_1 = require("./snow_create_uib_client_state.js");
Object.defineProperty(exports, "snow_create_uib_client_state_def", { enumerable: true, get: function () { return snow_create_uib_client_state_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_create_uib_client_state_exec", { enumerable: true, get: function () { return snow_create_uib_client_state_js_1.execute; } });
var snow_create_uib_data_broker_js_1 = require("./snow_create_uib_data_broker.js");
Object.defineProperty(exports, "snow_create_uib_data_broker_def", { enumerable: true, get: function () { return snow_create_uib_data_broker_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_create_uib_data_broker_exec", { enumerable: true, get: function () { return snow_create_uib_data_broker_js_1.execute; } });
var snow_create_uib_event_js_1 = require("./snow_create_uib_event.js");
Object.defineProperty(exports, "snow_create_uib_event_def", { enumerable: true, get: function () { return snow_create_uib_event_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_create_uib_event_exec", { enumerable: true, get: function () { return snow_create_uib_event_js_1.execute; } });
var snow_create_uib_page_registry_js_1 = require("./snow_create_uib_page_registry.js");
Object.defineProperty(exports, "snow_create_uib_page_registry_def", { enumerable: true, get: function () { return snow_create_uib_page_registry_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_create_uib_page_registry_exec", { enumerable: true, get: function () { return snow_create_uib_page_registry_js_1.execute; } });
var snow_create_workspace_js_1 = require("./snow_create_workspace.js");
Object.defineProperty(exports, "snow_create_workspace_def", { enumerable: true, get: function () { return snow_create_workspace_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_create_workspace_exec", { enumerable: true, get: function () { return snow_create_workspace_js_1.execute; } });
var snow_debug_widget_fetch_js_1 = require("./snow_debug_widget_fetch.js");
Object.defineProperty(exports, "snow_debug_widget_fetch_def", { enumerable: true, get: function () { return snow_debug_widget_fetch_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_debug_widget_fetch_exec", { enumerable: true, get: function () { return snow_debug_widget_fetch_js_1.execute; } });
//# sourceMappingURL=index.js.map