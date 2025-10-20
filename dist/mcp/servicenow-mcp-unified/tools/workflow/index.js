"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.snow_execute_workflow_exec = exports.snow_execute_workflow_def = exports.snow_create_workflow_activity_exec = exports.snow_create_workflow_activity_def = exports.snow_create_workflow_exec = exports.snow_create_workflow_def = void 0;
var snow_create_workflow_js_1 = require("./snow_create_workflow.js");
Object.defineProperty(exports, "snow_create_workflow_def", { enumerable: true, get: function () { return snow_create_workflow_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_create_workflow_exec", { enumerable: true, get: function () { return snow_create_workflow_js_1.execute; } });
var snow_create_workflow_activity_js_1 = require("./snow_create_workflow_activity.js");
Object.defineProperty(exports, "snow_create_workflow_activity_def", { enumerable: true, get: function () { return snow_create_workflow_activity_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_create_workflow_activity_exec", { enumerable: true, get: function () { return snow_create_workflow_activity_js_1.execute; } });
var snow_execute_workflow_js_1 = require("./snow_execute_workflow.js");
Object.defineProperty(exports, "snow_execute_workflow_def", { enumerable: true, get: function () { return snow_execute_workflow_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_execute_workflow_exec", { enumerable: true, get: function () { return snow_execute_workflow_js_1.execute; } });
//# sourceMappingURL=index.js.map