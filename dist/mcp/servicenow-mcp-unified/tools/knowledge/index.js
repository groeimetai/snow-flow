"use strict";
/**
 * Knowledge Management Tools
 *
 * Tools for managing ServiceNow Knowledge Base articles, knowledge bases,
 * categories, and search functionality.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.snow_discover_knowledge_bases_exec = exports.snow_discover_knowledge_bases_def = exports.snow_create_knowledge_base_exec = exports.snow_create_knowledge_base_def = exports.snow_knowledge_article_manage_exec = exports.snow_knowledge_article_manage_def = exports.snow_create_catalog_item_exec = exports.snow_create_catalog_item_def = void 0;
// Legacy tools (kept for backward compatibility)
var snow_create_catalog_item_js_1 = require("./snow_create_catalog_item.js");
Object.defineProperty(exports, "snow_create_catalog_item_def", { enumerable: true, get: function () { return snow_create_catalog_item_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_create_catalog_item_exec", { enumerable: true, get: function () { return snow_create_catalog_item_js_1.execute; } });
// Merged Knowledge Article Management (v8.2.0)
// Replaces: create, update, get_details, publish, retire, search (6 → 1)
var snow_knowledge_article_manage_js_1 = require("./snow_knowledge_article_manage.js");
Object.defineProperty(exports, "snow_knowledge_article_manage_def", { enumerable: true, get: function () { return snow_knowledge_article_manage_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_knowledge_article_manage_exec", { enumerable: true, get: function () { return snow_knowledge_article_manage_js_1.execute; } });
// Knowledge Base Management
var snow_create_knowledge_base_js_1 = require("./snow_create_knowledge_base.js");
Object.defineProperty(exports, "snow_create_knowledge_base_def", { enumerable: true, get: function () { return snow_create_knowledge_base_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_create_knowledge_base_exec", { enumerable: true, get: function () { return snow_create_knowledge_base_js_1.execute; } });
var snow_discover_knowledge_bases_js_1 = require("./snow_discover_knowledge_bases.js");
Object.defineProperty(exports, "snow_discover_knowledge_bases_def", { enumerable: true, get: function () { return snow_discover_knowledge_bases_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_discover_knowledge_bases_exec", { enumerable: true, get: function () { return snow_discover_knowledge_bases_js_1.execute; } });
//# sourceMappingURL=index.js.map