/**
 * Flow Designer Tools - v8.3.0 Architecture
 *
 * Tools:
 * - snow_flow_query: Query flows, get details, execution status/history (merged 4 → 1)
 * - snow_manage_flow: Unified flow management (create/update/delete/clone/activate/etc.) (EXPERIMENTAL)
 * - snow_flow_discover: Discover available triggers, actions, subflows, spokes
 * - snow_execute_flow: Execute existing flows
 * - snow_flow_connectivity_test: Test flow connectivity
 * - snow_import_flow_from_xml: Import flows from XML update sets
 *
 * Features (v8.3.0):
 * - Xanadu+ compression support (GlideCompressionUtil compatible)
 * - Nested actions within conditions and loops
 * - Parent-child relationship management
 * - Automatic version detection (V1/V2 tables)
 */

// Query Tools (v8.2.0)
export { toolDefinition as snow_flow_query_def, execute as snow_flow_query_exec } from './snow_flow_query.js';

// Flow Management (v8.3.0 - EXPERIMENTAL)
export { toolDefinition as snow_manage_flow_def, execute as snow_manage_flow_exec } from './snow_manage_flow.js';
export { toolDefinition as snow_flow_discover_def, execute as snow_flow_discover_exec } from './snow_flow_discover.js';

// Flow Operations
export { toolDefinition as snow_execute_flow_def, execute as snow_execute_flow_exec } from './snow_execute_flow.js';
export { toolDefinition as snow_flow_connectivity_test_def, execute as snow_flow_connectivity_test_exec } from './snow_flow_connectivity_test.js';
export { toolDefinition as snow_import_flow_from_xml_def, execute as snow_import_flow_from_xml_exec } from './snow_import_flow_from_xml.js';