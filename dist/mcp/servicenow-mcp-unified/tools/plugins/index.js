"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.snow_list_plugins_exec = exports.snow_list_plugins_def = exports.snow_activate_plugin_exec = exports.snow_activate_plugin_def = exports.snow_custom_plugin_exec = exports.snow_custom_plugin_def = void 0;
var snow_custom_plugin_js_1 = require("./snow_custom_plugin.js");
Object.defineProperty(exports, "snow_custom_plugin_def", { enumerable: true, get: function () { return snow_custom_plugin_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_custom_plugin_exec", { enumerable: true, get: function () { return snow_custom_plugin_js_1.execute; } });
var snow_activate_plugin_js_1 = require("./snow_activate_plugin.js");
Object.defineProperty(exports, "snow_activate_plugin_def", { enumerable: true, get: function () { return snow_activate_plugin_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_activate_plugin_exec", { enumerable: true, get: function () { return snow_activate_plugin_js_1.execute; } });
var snow_list_plugins_js_1 = require("./snow_list_plugins.js");
Object.defineProperty(exports, "snow_list_plugins_def", { enumerable: true, get: function () { return snow_list_plugins_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_list_plugins_exec", { enumerable: true, get: function () { return snow_list_plugins_js_1.execute; } });
//# sourceMappingURL=index.js.map