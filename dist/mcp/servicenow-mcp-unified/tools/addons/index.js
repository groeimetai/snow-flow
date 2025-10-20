"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.snow_clone_instance_exec = exports.snow_clone_instance_def = exports.snow_backup_instance_exec = exports.snow_backup_instance_def = exports.snow_cicd_deploy_exec = exports.snow_cicd_deploy_def = void 0;
var snow_cicd_deploy_js_1 = require("./snow_cicd_deploy.js");
Object.defineProperty(exports, "snow_cicd_deploy_def", { enumerable: true, get: function () { return snow_cicd_deploy_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_cicd_deploy_exec", { enumerable: true, get: function () { return snow_cicd_deploy_js_1.execute; } });
var snow_backup_instance_js_1 = require("./snow_backup_instance.js");
Object.defineProperty(exports, "snow_backup_instance_def", { enumerable: true, get: function () { return snow_backup_instance_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_backup_instance_exec", { enumerable: true, get: function () { return snow_backup_instance_js_1.execute; } });
var snow_clone_instance_js_1 = require("./snow_clone_instance.js");
Object.defineProperty(exports, "snow_clone_instance_def", { enumerable: true, get: function () { return snow_clone_instance_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_clone_instance_exec", { enumerable: true, get: function () { return snow_clone_instance_js_1.execute; } });
//# sourceMappingURL=index.js.map