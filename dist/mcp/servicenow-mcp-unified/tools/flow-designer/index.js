"use strict";
/**
 * Flow Designer Tools - v8.2.0 Merged Architecture
 *
 * Tools merged: 4 → 1 (-3 tools)
 * - snow_flow_query: Replaces list_flows, get_flow_details, get_flow_execution_history, get_flow_execution_status (4 → 1)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.snow_import_flow_from_xml_exec = exports.snow_import_flow_from_xml_def = exports.snow_flow_connectivity_test_exec = exports.snow_flow_connectivity_test_def = exports.snow_execute_flow_exec = exports.snow_execute_flow_def = exports.snow_flow_query_exec = exports.snow_flow_query_def = void 0;
// Merged Tools (v8.2.0)
var snow_flow_query_js_1 = require("./snow_flow_query.js");
Object.defineProperty(exports, "snow_flow_query_def", { enumerable: true, get: function () { return snow_flow_query_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_flow_query_exec", { enumerable: true, get: function () { return snow_flow_query_js_1.execute; } });
// Flow Operations (kept)
var snow_execute_flow_js_1 = require("./snow_execute_flow.js");
Object.defineProperty(exports, "snow_execute_flow_def", { enumerable: true, get: function () { return snow_execute_flow_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_execute_flow_exec", { enumerable: true, get: function () { return snow_execute_flow_js_1.execute; } });
var snow_flow_connectivity_test_js_1 = require("./snow_flow_connectivity_test.js");
Object.defineProperty(exports, "snow_flow_connectivity_test_def", { enumerable: true, get: function () { return snow_flow_connectivity_test_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_flow_connectivity_test_exec", { enumerable: true, get: function () { return snow_flow_connectivity_test_js_1.execute; } });
var snow_import_flow_from_xml_js_1 = require("./snow_import_flow_from_xml.js");
Object.defineProperty(exports, "snow_import_flow_from_xml_def", { enumerable: true, get: function () { return snow_import_flow_from_xml_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_import_flow_from_xml_exec", { enumerable: true, get: function () { return snow_import_flow_from_xml_js_1.execute; } });
//# sourceMappingURL=index.js.map