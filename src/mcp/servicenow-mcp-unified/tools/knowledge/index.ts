/**
 * Knowledge Management Tools
 *
 * Tools for managing ServiceNow Knowledge Base articles, knowledge bases,
 * categories, and search functionality.
 */

// Legacy tools (kept for backward compatibility)
export { toolDefinition as snow_create_kb_article_def, execute as snow_create_kb_article_exec } from './snow_create_kb_article.js';
export { toolDefinition as snow_search_kb_def, execute as snow_search_kb_exec } from './snow_search_kb.js';
export { toolDefinition as snow_create_catalog_item_def, execute as snow_create_catalog_item_exec } from './snow_create_catalog_item.js';
export { toolDefinition as snow_order_catalog_item_def, execute as snow_order_catalog_item_exec } from './snow_order_catalog_item.js';

// New comprehensive knowledge tools
export { toolDefinition as snow_create_knowledge_article_def, execute as snow_create_knowledge_article_exec } from './snow_create_knowledge_article.js';
export { toolDefinition as snow_create_knowledge_base_def, execute as snow_create_knowledge_base_exec } from './snow_create_knowledge_base.js';
export { toolDefinition as snow_discover_knowledge_bases_def, execute as snow_discover_knowledge_bases_exec } from './snow_discover_knowledge_bases.js';
export { toolDefinition as snow_get_knowledge_article_details_def, execute as snow_get_knowledge_article_details_exec } from './snow_get_knowledge_article_details.js';
export { toolDefinition as snow_retire_knowledge_article_def, execute as snow_retire_knowledge_article_exec } from './snow_retire_knowledge_article.js';
export { toolDefinition as snow_search_knowledge_def, execute as snow_search_knowledge_exec } from './snow_search_knowledge.js';
export { toolDefinition as snow_update_knowledge_article_def, execute as snow_update_knowledge_article_exec } from './snow_update_knowledge_article.js';
