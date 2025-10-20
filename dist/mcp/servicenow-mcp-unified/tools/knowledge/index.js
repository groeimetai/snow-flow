"use strict";
/**
 * Knowledge Management Tools
 *
 * Tools for managing ServiceNow Knowledge Base articles, knowledge bases,
 * categories, and search functionality.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.snow_update_knowledge_article_exec = exports.snow_update_knowledge_article_def = exports.snow_search_knowledge_exec = exports.snow_search_knowledge_def = exports.snow_retire_knowledge_article_exec = exports.snow_retire_knowledge_article_def = exports.snow_get_knowledge_article_details_exec = exports.snow_get_knowledge_article_details_def = exports.snow_discover_knowledge_bases_exec = exports.snow_discover_knowledge_bases_def = exports.snow_create_knowledge_base_exec = exports.snow_create_knowledge_base_def = exports.snow_create_knowledge_article_exec = exports.snow_create_knowledge_article_def = exports.snow_order_catalog_item_exec = exports.snow_order_catalog_item_def = exports.snow_create_catalog_item_exec = exports.snow_create_catalog_item_def = exports.snow_search_kb_exec = exports.snow_search_kb_def = exports.snow_create_kb_article_exec = exports.snow_create_kb_article_def = void 0;
// Legacy tools (kept for backward compatibility)
var snow_create_kb_article_js_1 = require("./snow_create_kb_article.js");
Object.defineProperty(exports, "snow_create_kb_article_def", { enumerable: true, get: function () { return snow_create_kb_article_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_create_kb_article_exec", { enumerable: true, get: function () { return snow_create_kb_article_js_1.execute; } });
var snow_search_kb_js_1 = require("./snow_search_kb.js");
Object.defineProperty(exports, "snow_search_kb_def", { enumerable: true, get: function () { return snow_search_kb_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_search_kb_exec", { enumerable: true, get: function () { return snow_search_kb_js_1.execute; } });
var snow_create_catalog_item_js_1 = require("./snow_create_catalog_item.js");
Object.defineProperty(exports, "snow_create_catalog_item_def", { enumerable: true, get: function () { return snow_create_catalog_item_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_create_catalog_item_exec", { enumerable: true, get: function () { return snow_create_catalog_item_js_1.execute; } });
var snow_order_catalog_item_js_1 = require("./snow_order_catalog_item.js");
Object.defineProperty(exports, "snow_order_catalog_item_def", { enumerable: true, get: function () { return snow_order_catalog_item_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_order_catalog_item_exec", { enumerable: true, get: function () { return snow_order_catalog_item_js_1.execute; } });
// New comprehensive knowledge tools
var snow_create_knowledge_article_js_1 = require("./snow_create_knowledge_article.js");
Object.defineProperty(exports, "snow_create_knowledge_article_def", { enumerable: true, get: function () { return snow_create_knowledge_article_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_create_knowledge_article_exec", { enumerable: true, get: function () { return snow_create_knowledge_article_js_1.execute; } });
var snow_create_knowledge_base_js_1 = require("./snow_create_knowledge_base.js");
Object.defineProperty(exports, "snow_create_knowledge_base_def", { enumerable: true, get: function () { return snow_create_knowledge_base_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_create_knowledge_base_exec", { enumerable: true, get: function () { return snow_create_knowledge_base_js_1.execute; } });
var snow_discover_knowledge_bases_js_1 = require("./snow_discover_knowledge_bases.js");
Object.defineProperty(exports, "snow_discover_knowledge_bases_def", { enumerable: true, get: function () { return snow_discover_knowledge_bases_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_discover_knowledge_bases_exec", { enumerable: true, get: function () { return snow_discover_knowledge_bases_js_1.execute; } });
var snow_get_knowledge_article_details_js_1 = require("./snow_get_knowledge_article_details.js");
Object.defineProperty(exports, "snow_get_knowledge_article_details_def", { enumerable: true, get: function () { return snow_get_knowledge_article_details_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_get_knowledge_article_details_exec", { enumerable: true, get: function () { return snow_get_knowledge_article_details_js_1.execute; } });
var snow_retire_knowledge_article_js_1 = require("./snow_retire_knowledge_article.js");
Object.defineProperty(exports, "snow_retire_knowledge_article_def", { enumerable: true, get: function () { return snow_retire_knowledge_article_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_retire_knowledge_article_exec", { enumerable: true, get: function () { return snow_retire_knowledge_article_js_1.execute; } });
var snow_search_knowledge_js_1 = require("./snow_search_knowledge.js");
Object.defineProperty(exports, "snow_search_knowledge_def", { enumerable: true, get: function () { return snow_search_knowledge_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_search_knowledge_exec", { enumerable: true, get: function () { return snow_search_knowledge_js_1.execute; } });
var snow_update_knowledge_article_js_1 = require("./snow_update_knowledge_article.js");
Object.defineProperty(exports, "snow_update_knowledge_article_def", { enumerable: true, get: function () { return snow_update_knowledge_article_js_1.toolDefinition; } });
Object.defineProperty(exports, "snow_update_knowledge_article_exec", { enumerable: true, get: function () { return snow_update_knowledge_article_js_1.execute; } });
//# sourceMappingURL=index.js.map