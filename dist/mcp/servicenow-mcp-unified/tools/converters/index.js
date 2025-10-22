"use strict";
/**
 * Data Conversion Tools - v8.2.0 Merged Architecture
 *
 * Phase 3: 4 → 1 (-3 tools)
 * - snow_data_convert: Replaces csv_to_json, json_to_csv, json_to_xml, xml_to_json (4 → 1)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.snow_data_convert_exec = exports.snow_data_convert_def = void 0;
// Merged Tools (v8.2.0 Phase 3)
var snow_data_convert_js_1 = require("./snow_data_convert.js");
Object.defineProperty(exports, "snow_data_convert_def", { enumerable: true, get: function () { return snow_data_convert_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_data_convert_exec", { enumerable: true, get: function () { return snow_data_convert_js_1.execute; } });
//# sourceMappingURL=index.js.map